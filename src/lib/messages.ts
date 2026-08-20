import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  limit,
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
    media = uploaded.map(({ src, alt, type: mediaType }) => ({
      src,
      alt,
      type: mediaType ?? ''
    }));
  }

  await addDoc(conversationMessagesCollection(id), {
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

  await updateDoc(doc(db, 'conversations', id), {
    lastMessage: {
      text: type === 'text' ? (text as string) : lastMessageLabels[type],
      type,
      senderId,
      createdAt: Timestamp.now()
    },
    updatedAt: serverTimestamp(),
    [`unread.${senderId}`]: 0,
    ...othersUnread
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

  const peer = (conversationDoc.data() as Conversation).participants.find(
    (id) => id !== userId
  );

  await updateDoc(doc(conversationsCollection, conversationId), {
    ...(peer ? { [`unread.${peer}`]: increment(1) } : {}),
    lastMessage: {
      senderId: userId,
      type: 'text',
      text: `تفاعل بـ ${emoji} على رسالتك`,
      createdAt: serverTimestamp()
    }
  });
}

/** ترحيل الرسائل القديمة: إضافة حقل participants لتظهر في استعلام الدردشة
 *  المُفلتر بالمشاركين (القواعد تسمح بتحديث participants/seenBy/reactions فقط).
 *  يعمل تلقائيًا عند فتح محادثة قديمة ويتجاهل أي رسالة تفشل. */
export async function backfillMessageParticipants(
  conversationId: string,
  participants: string[]
): Promise<void> {
  // استعلام بدون where حتى يعمل حتى لو كانت القاعدة المنشورة لا تزال
  // تستخدم get() — فهي تسمح بقراءة مستندات مفردة وترفض قواعد-القوائم
  const snapshot = await getDocs(
    query(conversationMessagesCollection(conversationId), limit(300))
  );
  await Promise.all(
    snapshot.docs
      .filter((messageDoc) => !messageDoc.data().participants?.length)
      .map((messageDoc) =>
        updateDoc(messageDoc.ref, { participants }).catch(() => undefined)
      )
  );
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
