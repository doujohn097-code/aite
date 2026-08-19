import {
  collection,
  doc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '@lib/firebase/app';
import {
  conversationsCollection,
  messagesCollection
} from '@lib/firebase/collections';

/**
 * Completely removes a conversation and every message it contains —
 * nothing survives.
 */
export async function deleteConversation(
  conversationId: string
): Promise<void> {
  const batch = writeBatch(db);

  const messages = await getDocs(messagesCollection(conversationId));
  messages.forEach((messageDoc) => batch.delete(messageDoc.ref));

  batch.delete(doc(conversationsCollection, conversationId));

  await batch.commit();
}
