import { Timestamp, type FirestoreDataConverter } from 'firebase/firestore';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'shared';

/** بطاقة مشاركة منشور/ريل داخل الدردشة */
export type SharedPostRef = {
  id: string;
  kind: 'tweet' | 'reel';
  authorName: string | null;
  authorUsername: string | null;
  authorPhoto: string | null;
  text: string | null;
  thumbnail: string | null;
};

/** اسم المستخدم المعجب لكل emoji */
export type MessageReactions = Record<string, string>;

export type MessageMedia = {
  src: string;
  alt: string;
  type: string;
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
  media: MessageMedia[] | null;
  audio: VoiceData | null;
  replyTo: ReplyData | null;
  sharedPost: SharedPostRef | null;
  /** تفاعلات الرسالة: بمعرف المستخدم الإيموجي الذي وضعه */
  reactions: MessageReactions;
  createdAt: Timestamp;
  seenBy: string[];
};

export type LastMessage = {
  text: string;
  type: MessageType;
  senderId: string;
  createdAt: Timestamp;
};

export type Conversation = {
  id: string;
  participants: string[];
  lastMessage: LastMessage | null;
  /** Unread messages count per participant id */
  unread: Record<string, number>;
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
