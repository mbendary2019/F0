/**
 * Phase 39 - Graph Query Helpers
 * Query graph edges and confidence for governance decisions
 */

import * as admin from 'firebase-admin';
const db = admin.firestore();

/**
 * Check if an edge exists with optional weight threshold
 */
export async function hasEdge(
  kind: string,
  src: string,
  dst: string,
  weightGt?: number
): Promise<boolean> {
  const q = db
    .collection('ops_graph_edges')
    .where('kind', '==', kind)
    .where('src', '==', src)
    .where('dst', '==', dst);

  const snap = await q.get();
  if (snap.empty) return false;
  if (weightGt == null) return true;

  return snap.docs.some((d) => (d.data() as any).weight > weightGt);
}

/**
 * Get confidence score by key
 */
export async function getConfidence(key: string): Promise<number | undefined> {
  const doc = await db.collection('ops_confidence').doc(key).get();
  return doc.exists ? (doc.data() as any).score : undefined;
}
