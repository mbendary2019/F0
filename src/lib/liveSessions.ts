// src/lib/liveSessions.ts
import { auth, db } from '@/lib/firebaseClient';
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

export async function createLiveSession(
  projectId: string,
  projectName?: string
) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  const ref = await addDoc(collection(db, 'liveSessions'), {
    ownerUid: user.uid,
    projectId,
    projectName: projectName || null,
    status: 'active',
    createdAt: serverTimestamp(),
    endedAt: null,
  });

  // أول event "Session started"
  await addDoc(collection(db, 'liveSessions', ref.id, 'events'), {
    ownerUid: user.uid,
    sessionId: ref.id,
    type: 'system',
    message: 'Live coding session started',
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

export async function endLiveSession(sessionId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  const ref = doc(db, 'liveSessions', sessionId);

  await updateDoc(ref, {
    status: 'ended',
    endedAt: serverTimestamp(),
  });

  await addDoc(collection(db, 'liveSessions', sessionId, 'events'), {
    ownerUid: user.uid,
    sessionId,
    type: 'system',
    message: 'Session ended',
    createdAt: serverTimestamp(),
  });
}

export async function logLiveSessionEvent(
  sessionId: string,
  type: 'system' | 'agent' | 'user' | 'deploy' | 'patch',
  message: string,
  meta?: Record<string, any>
) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  await addDoc(collection(db, 'liveSessions', sessionId, 'events'), {
    ownerUid: user.uid,
    sessionId,
    type,
    message,
    meta: meta || null,
    createdAt: serverTimestamp(),
  });
}
