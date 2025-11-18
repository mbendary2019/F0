import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function logActivity(projectId: string, title: string, meta: any = {}) {
  await addDoc(collection(db, `projects/${projectId}/activity`), {
    title,
    meta,
    createdAt: serverTimestamp(),
    type: 'system'
  });
}
