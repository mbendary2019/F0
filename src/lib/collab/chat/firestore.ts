import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { ChatMessage, ChatSendPayload } from './types';
import { db } from '@/lib/firebaseClient';
const MESSAGES = 'ops_collab_messages';

export function listenRoomMessages(roomId: string, onData: (msgs: ChatMessage[]) => void) {
  const q = query(
    collection(db, MESSAGES),
    where('roomId', '==', roomId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snap) => {
    const items: ChatMessage[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      items.push({
        id: d.id,
        roomId: data.roomId,
        userId: data.userId,
        userName: data.userName,
        userColor: data.userColor,
        text: data.text,
        createdAt: (data.createdAt instanceof Timestamp)
          ? data.createdAt.toMillis()
          : data.createdAt ?? Date.now(),
      });
    });
    // Sort ascending for display (oldest first)
    onData(items.sort((a, b) => a.createdAt - b.createdAt));
  });
}

export async function sendMessage(payload: ChatSendPayload) {
  const createdAt = serverTimestamp();
  await addDoc(collection(db, MESSAGES), {
    ...payload,
    createdAt,
  });
}
