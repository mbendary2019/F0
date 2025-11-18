import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';

export function subscribePhaseProgress(projectId: string, phaseId: string, cb: (progress: number) => void) {
  const db = getFirestore();
  const q = query(collection(db, `projects/${projectId}/tasks`), where('phaseId', '==', phaseId));
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map(d => d.data() as any);
    if (!docs.length) return cb(0);
    const done = docs.filter(d => d.status === 'done').length;
    cb(Math.round((done / docs.length) * 100));
  });
}
