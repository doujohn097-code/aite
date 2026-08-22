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
import type { DocumentReference, DocumentData } from 'firebase/firestore';
import { collectionsFor } from '@lib/firebase/collections';
import { getFirebase, getActiveProject } from '@lib/firebase/app';
import { resolveConversationProject } from '@lib/dual';
import { uploadImages } from '@lib/firebase/utils';
import { sendPushNotification } from '@lib/push';
import { getRandomId } from '@lib/random';
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

/** Resolves the project a conversation lives in and returns its collections. */
async function colsOfConversation(
  conversationId: string
): Promise<ReturnType<typeof collectionsFor>> {
  return collectionsFor(await resolveConversationProject(conversationId));
}
function activeCols(): ReturnType<typeof collectionsFor> {
  return collectionsFor(getActiveProject());
}

export function getConversationId(userA: string, userB: string): string {
  return [userA, userB].sort().join('_');
}

export async function getOrCreateConversation(
  userId: string,
  targetId: string
): Promise<Conversation> {
  const id = getConversationId(userId, targetId);
  const colsA = collectionsFor('a');
  const colsB = collectionsFor('b');

  // The conversation may have been created in either round-robin database
  // (the id is deterministic, both participants compute the same one).
  const [snapA, snapB] = await Promise.all([
    getDoc(doc(colsA.conversations, id)).catch(() => null),
    getDoc(doc(colsB.conversations, id)).catch(() => null)
  ]);
  if (snapA?.exists()) return snapA.data();
  if (snapB?.exists()) return snapB.data();

  const conversation: Omit<Conversation, 'id'> = {
    participants: [userId, targetId],
    lastMessage: null,
    unread: { [userId]: 0, [targetId]: 0 },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  // New conversations are created in the initiator's round-robin database.
  try {
    await setDoc(doc(activeCols().conversations, id), conversation);
  } catch {
    /* ربما أنشأها الطرف الآخر في نفس اللحظة */
  }

  return { id, ...conversation };
}

export type SendPayload = { replyTo?: ReplyData | null } & (
  | { type: 'text'; text: string }
  | { type: 'image' | 'video'; files: FilesWithId }
  | { type: 'audio'; blob: Blob; duration: number; peaks: number[] }
  | { type: 'shared'; post: SharedPostRef }
);

const lastMessageLabels: Record<MessageType, string> = {
  text: '',
  image: 'صورة',
  video: 'فيديو',
  audio: 'رسالة صوتية',
  shared: 'شارك منشورًا'
};

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
    const file = new File([payload.blob], `voice-${getRandomId()}.webm`, {
      type: payload.blob.type || 'audio/webm'
    });
    const [uploaded] =
      (await uploadImages(senderId, [
        Object.assign(file, { id: getRandomId() })
      ] as FilesWithId)) ?? [];
    if (!uploaded) throw new Error('تعذر رفع الرسالة الصوتية');
    audio = {
      src: uploaded.src,
      duration: payload.duration,
      peaks: payload.peaks
    };
  } else {
    type = payload.type;
    if (!payload.files.length) return;
    const uploaded = await uploadImages(senderId, payload.files);
    if (!uploaded?.length) throw new Error('تعذر رفع الوسائط');
    media = uploaded.map(({ src, alt, type: mediaType, thumbnail }) => ({
      src,
      alt,
      type: mediaType ?? '',
      thumbnail: thumbnail ?? null
    }));
  }

  const cols = await colsOfConversation(id);

  await addDoc(cols.conversationMessages(id), {
    id: '',
    senderId,
    type,
    text,
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

  await updateDoc(
    doc(cols.conversations, id) as DocumentReference<DocumentData>,
    {
      lastMessage: {
        text: type === 'text' ? (text as string) : lastMessageLabels[type],
        type,
        senderId,
        createdAt: Timestamp.now()
      },
      updatedAt: serverTimestamp(),
      [`unread.${senderId}`]: 0,
      ...othersUnread
    }
  );

  sendPushNotification({
    kind: 'message',
    conversationId: id,
    preview: type === 'text' ? (text as string) : lastMessageLabels[type]
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

  const cols = await colsOfConversation(conversationId);

  await updateDoc(
    doc(cols.conversationMessages(conversationId), messageId),
    removing
      ? { [`reactions.${userId}`]: deleteField() }
      : { [`reactions.${userId}`]: emoji }
  );

  if (removing) return;

  const conversationDoc = await getDoc(doc(cols.conversations, conversationId));
  if (!conversationDoc.exists()) return;

  const peer = conversationDoc.data().participants.find((id) => id !== userId);

  await updateDoc(doc(cols.conversations, conversationId), {
    ...(peer ? { [`unread.${peer}`]: increment(1) } : {}),
    lastMessage: {
      senderId: userId,
      type: 'text',
      text: `تفاعل بـ ${emoji} على رسالتك`,
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
  const cols = await colsOfConversation(conversationId);
  await updateDoc(doc(cols.conversations, conversationId), {
    typing: userId
  });
}

/** حذف للطرفين مع إبقاء إشعار واضح ومتزامن داخل المحادثة. */
export async function deleteMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  const cols = await colsOfConversation(conversationId);
  await updateDoc(
    doc(
      cols.conversations,
      conversationId,
      'messages',
      messageId
    ) as DocumentReference<DocumentData>,
    {
      text: 'تم حذف هذه الرسالة',
      media: null,
      audio: null,
      replyTo: null,
      sharedPost: null,
      reactions: {},
      deletedAt: serverTimestamp()
    }
  );
}

export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<void> {
  const cols = await colsOfConversation(conversationId);
  await updateDoc(doc(cols.conversations, conversationId), {
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
  const cols = await colsOfConversation(conversationId);
  await updateDoc(
    doc(
      cols.conversations,
      conversationId,
      'messages',
      messageId
    ) as DocumentReference<DocumentData>,
    { seenBy: [...seenBy, userId] }
  );
}
