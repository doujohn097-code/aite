import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  increment
} from 'firebase/firestore';
import {
  conversationsCollection,
  conversationMessagesCollection
} from '@lib/firebase/collections';
import { db } from '@lib/firebase/app';
import { uploadImages } from '@lib/firebase/utils';
import { sendPushNotification } from '@lib/push';
import {
  formatFileSize,
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_VOICE_DURATION_SECONDS,
  normalizeMediaType
} from '@lib/media-limits';
import { getRandomId } from '@lib/random';
import { tx } from '@lib/i18n/tx';
import type { FilesWithId } from '@lib/types/file';
import { deleteField } from 'firebase/firestore';
import type {
  Conversation,
  MessageMedia,
  MessageType,
  ReplyData,
  SharedPostRef,
  VoiceData
} from '@lib/types/message';

export function getConversationId(userA: string, userB: string): string {
  return [userA, userB].sort().join('_');
}

export async function getOrCreateConversation(
  userId: string,
  targetId: string
): Promise<Conversation> {
  const id = getConversationId(userId, targetId);
  const ref = doc(conversationsCollection, id);

  // قراءة مستند محادثة غير موجود تُرفض من قواعد الأمان (resource فارغ)،
  // لذلك نتجاهل فشل القراءة وننتقل مباشرة إلى الإنشاء
  try {
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) return snapshot.data();
  } catch {
    /* المستند غير موجود أو القراءة مرفوضة — ننشئ أدناه */
  }

  const conversation: Omit<Conversation, 'id'> = {
    participants: [userId, targetId],
    lastMessage: null,
    unread: { [userId]: 0, [targetId]: 0 },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  try {
    await setDoc(ref, conversation);
  } catch {
    /* ربما أنشأها الطرف الآخر في نفس اللحظة */
  }

  return { id, ...conversation };
}

export type SendPayload = { replyTo?: ReplyData | null; font?: string | null } & (
  | { type: 'text'; text: string }
  | { type: 'image' | 'video'; files: FilesWithId }
  | { type: 'audio'; blob: Blob; duration: number; peaks: number[] }
  | { type: 'shared'; post: SharedPostRef }
);

function lastMessageLabel(type: MessageType): string {
  if (type === 'image') return tx('messages.image');
  if (type === 'video') return tx('messages.video');
  if (type === 'audio') return tx('messages.voice');
  if (type === 'shared') return tx('messages.shared');
  return '';
}

export async function sendMessage(
  conversation: Conversation,
  senderId: string,
  payload: SendPayload
): Promise<void> {
  const { id, participants } = conversation;

  let type: MessageType = 'text';
  let text: string | null = null;
  let media: MessageMedia[] | null = null;
  let audio: VoiceData | null = null;
  let sharedPost: SharedPostRef | null = null;

  if (payload.type === 'shared') {
    type = 'shared';
    sharedPost = payload.post;
  } else if (payload.type === 'text') {
    text = payload.text.trim();
    if (!text) return;
  } else if (payload.type === 'audio') {
    type = 'audio';
    if (payload.blob.size <= 0) throw new Error(tx('messages.voiceEmpty'));
    if (payload.blob.size > MAX_AUDIO_UPLOAD_BYTES)
      throw new Error(
        tx('messages.voiceTooBig', {
          size: formatFileSize(payload.blob.size)
        })
      );
    if (payload.duration > MAX_VOICE_DURATION_SECONDS + 2)
      throw new Error(tx('messages.voiceLong'));

    const normalizedType = normalizeMediaType(
      payload.blob.type || 'audio/webm'
    );
    const audioType = normalizedType || 'audio/webm';
    const extension =
      normalizedType === 'audio/mp4'
        ? 'm4a'
        : normalizedType === 'audio/ogg'
        ? 'ogg'
        : normalizedType === 'audio/aac'
        ? 'aac'
        : 'webm';
    const file = new File(
      [payload.blob],
      `voice-${getRandomId()}.${extension}`,
      { type: audioType }
    );
    const [uploaded] =
      (await uploadImages(senderId, [
        Object.assign(file, { id: getRandomId() })
      ] as FilesWithId)) ?? [];
    if (!uploaded) throw new Error(tx('messages.voiceUpload'));
    audio = {
      src: uploaded.src,
      duration: payload.duration,
      peaks: payload.peaks
    };
  } else {
    type = payload.type;
    if (!payload.files.length) return;
    const uploaded = await uploadImages(senderId, payload.files);
    if (!uploaded?.length) throw new Error(tx('messages.mediaUpload'));
    media = uploaded.map(({ src, alt, type: mediaType, thumbnail }) => ({
      src,
      alt,
      type: mediaType ?? '',
      thumbnail: thumbnail ?? null
    }));
  }

  await addDoc(conversationMessagesCollection(id), {
    id: '',
    senderId,
    type,
    text,
    font: payload.font ?? null,
    media,
    audio,
    replyTo: payload.replyTo ?? null,
    sharedPost,
    reactions: {},
    participants,
    createdAt: serverTimestamp() as Timestamp,
    seenBy: [senderId]
  });

  const othersUnread = participants
    .filter((participant) => participant !== senderId)
    .reduce<Record<string, ReturnType<typeof increment>>>(
      (acc, participant) => ({
        ...acc,
        [`unread.${participant}`]: increment(1)
      }),
      {}
    );

  await updateDoc(doc(db, 'conversations', id), {
    lastMessage: {
      text: type === 'text' ? (text as string) : lastMessageLabel(type),
      type,
      senderId,
      createdAt: Timestamp.now()
    },
    updatedAt: serverTimestamp(),
    [`unread.${senderId}`]: 0,
    ...othersUnread
  });

  sendPushNotification({
    kind: 'message',
    conversationId: id,
    preview: type === 'text' ? (text as string) : lastMessageLabel(type)
  });
}

/** تبديل تفاعل إيموجي — تمرير نفس الإيموجي يحذفه.
 *  عند إضافة تفاعل نحدّث آخر رسالة وعداد غير المقروء كإشعار (أسلوب إنستغرام) */
export async function toggleMessageReaction(
  conversationId: string,
  messageId: string,
  userId: string,
  currentEmoji: string | null,
  emoji: string
): Promise<void> {
  const removing = currentEmoji === emoji;

  await updateDoc(
    doc(conversationMessagesCollection(conversationId), messageId),
    removing
      ? { [`reactions.${userId}`]: deleteField() }
      : { [`reactions.${userId}`]: emoji }
  );

  if (removing) return;

  const conversationDoc = await getDoc(
    doc(conversationsCollection, conversationId)
  );
  if (!conversationDoc.exists()) return;

  const peer = conversationDoc.data().participants.find((id) => id !== userId);

  await updateDoc(doc(conversationsCollection, conversationId), {
    ...(peer ? { [`unread.${peer}`]: increment(1) } : {}),
    lastMessage: {
      senderId: userId,
      type: 'text',
      text: tx('messages.reacted', { emoji }),
      createdAt: serverTimestamp()
    }
  });

  sendPushNotification({ kind: 'messageReaction', conversationId, emoji });
}

/** يعلم الطرف الآخر أنني أكتب (null = توقف) — يُمسح تلقائياً بعد بضع ثوانٍ */
export async function setTyping(
  conversationId: string,
  userId: string | null
): Promise<void> {
  await updateDoc(doc(db, 'conversations', conversationId), {
    typing: userId
  });
}

/** حذف للطرفين مع إبقاء إشعار واضح ومتزامن داخل المحادثة. */
export async function deleteMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  await updateDoc(
    doc(db, 'conversations', conversationId, 'messages', messageId),
    {
      text: tx('messages.deleted'),
      media: null,
      audio: null,
      replyTo: null,
      sharedPost: null,
      reactions: {},
      deletedAt: serverTimestamp()
    }
  );
}

/**
 * تعديل نص رسالة نصية أرسلها المستخدم نفسه.
 * إن كانت آخر رسالة في المحادثة يُحدَّث المعاينة في قائمة المحادثات أيضًا.
 */
export async function editMessage(
  conversationId: string,
  messageId: string,
  text: string,
  options?: { isLastMessage?: boolean }
): Promise<void> {
  const trimmed = text.trim();

  if (!trimmed) throw new Error('لا يمكن ترك الرسالة فارغة');
  if (trimmed.length > 4000) throw new Error('الرسالة طويلة جدًا');

  await updateDoc(
    doc(db, 'conversations', conversationId, 'messages', messageId),
    {
      text: trimmed,
      edited: true,
      editedAt: serverTimestamp()
    }
  );

  if (options?.isLastMessage)
    await updateDoc(doc(db, 'conversations', conversationId), {
      'lastMessage.text': trimmed,
      'lastMessage.edited': true,
      updatedAt: serverTimestamp()
    });
}

export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<void> {
  await updateDoc(doc(db, 'conversations', conversationId), {
    [`unread.${userId}`]: 0
  });
}

export async function markMessageSeen(
  conversationId: string,
  messageId: string,
  userId: string,
  seenBy: string[]
): Promise<void> {
  if (seenBy.includes(userId)) return;
  await updateDoc(
    doc(db, `conversations/${conversationId}/messages`, messageId),
    { seenBy: [...seenBy, userId] }
  );
}
