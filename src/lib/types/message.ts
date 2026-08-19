import { Timestamp, type FirestoreDataConverter } from 'firebase/firestore';
import type { ImagesPreview } from './file';

export type ReplyTo = {
  id: string;
  text: string | null;
  senderId: string;
};

export type AudioData = {
  src: string;
  duration: number;
};

export type Message = {
  id: string;
  conversationId: string;
  participants: string[];
  senderId: string;
  text: string | null;
  images: ImagesPreview | null;
  replyTo: ReplyTo | null;
  audio: AudioData | null;
  likes: string[];
  reactions: Record<string, string>;
  createdAt: Timestamp;
  updatedAt: Timestamp | null;
};

export type ParticipantData = {
  name: string;
  username: string;
  photoURL: string;
  verified?: boolean;
};

export type Conversation = {
  id: string;
  participants: string[];
  participantData: Record<string, ParticipantData>;
  lastMessage: string | null;
  lastMessageSenderId: string | null;
  lastMessageAt: Timestamp | null;
  unreadCount: Record<string, number>;
  createdAt: Timestamp;
  updatedAt: Timestamp | null;
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
      conversationId: '',
      participants: [],
      senderId: '',
      text: null,
      images: null,
      replyTo: null,
      audio: null,
      likes: [],
      reactions: {},
      createdAt: Timestamp.now(),
      updatedAt: null,
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
      participantData: {},
      lastMessage: null,
      lastMessageSenderId: null,
      lastMessageAt: null,
      unreadCount: {},
      createdAt: Timestamp.now(),
      updatedAt: null,
      ...data
    } as Conversation;
  }
};
