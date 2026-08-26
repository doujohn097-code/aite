import { Timestamp, type FirestoreDataConverter } from 'firebase/firestore';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'shared';

/** بطاقة مشاركة منشور/ريل/ملف شخصي داخل الدردشة */
export type SharedPostRef = {
  id: string;
  kind: 'tweet' | 'reel' | 'profile';
  authorName: string | null;
  authorUsername: string | null;
  authorPhoto: string | null;
  text: string | null;
  thumbnail: string | null;
  verified?: boolean | null;
  followers?: number | null;
};

/** اسم المستخدم المعجب لكل emoji */
export type MessageReactions = Record<string, string>;

export type MessageMedia = {
  src: string;
  alt: string;
  type: string;
  thumbnail?: string | null;
};

export type VoiceData = {
  src: string;
  /** Duration in seconds */
  duration: number;
  /** Normalized waveform amplitudes (0..1) used to draw the bars */
  peaks: number[];
};

export type ReplyData = {
  id: string;
  senderId: string;
  senderName: string | null;
  text: string | null;
  type: MessageType;
};

export type Message = {
  id: string;
  senderId: string;
  type: MessageType;
  text: string | null;
  font?: string | null;
  media: MessageMedia[] | null;
  audio: VoiceData | null;
  replyTo: ReplyData | null;
  sharedPost: SharedPostRef | null;
  /** تفاعلات الرسالة: بمعرف المستخدم الإيموجي الذي وضعه */
  reactions: MessageReactions;
  /** نسخة من مشاركي المحادثة — تتيح لقواعد الأمان فحص العضوية دون get() */
  participants: string[];
  createdAt: Timestamp;
  seenBy: string[];
  /** Soft deletion keeps a clear, synchronized placeholder in the chat. */
  deletedAt?: Timestamp | null;
  /** تم تعديل نص الرسالة بعد إرسالها */
  edited?: boolean;
  editedAt?: Timestamp | null;
};

export type LastMessage = {
  text: string;
  type: MessageType;
  senderId: string;
  createdAt: Timestamp;
  /** آخر رسالة معدّلة — يظهر معها وسم «معدّل» في قائمة المحادثات */
  edited?: boolean;
};

export type Conversation = {
  id: string;
  participants: string[];
  lastMessage: LastMessage | null;
  /** Unread messages count per participant id */
  unread: Record<string, number>;
  /** معرف المستخدم الذي يكتب الآن */
  typing?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export const messageConverter: FirestoreDataConverter<Message> = {
  toFirestore(data) {
    const message = { ...data } as Record<string, unknown>;
    delete message.id;
    return message;
  },
  fromFirestore(snapshot, options) {
    const { id } = snapshot;
    const data = snapshot.data(options);
    return {
      id,
      senderId: '',
      type: 'text',
      text: null,
      media: null,
      audio: null,
      replyTo: null,
      sharedPost: null,
      reactions: {},
      participants: [],
      createdAt: Timestamp.now(),
      seenBy: [],
      ...data
    } as Message;
  }
};

export const conversationConverter: FirestoreDataConverter<Conversation> = {
  toFirestore(data) {
    const conversation = { ...data } as Record<string, unknown>;
    delete conversation.id;
    return conversation;
  },
  fromFirestore(snapshot, options) {
    const { id } = snapshot;
    const data = snapshot.data(options);
    return {
      id,
      participants: [],
      lastMessage: null,
      unread: {},
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...data
    } as Conversation;
  }
};
