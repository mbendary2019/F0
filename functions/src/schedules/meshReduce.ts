/**
 * Phase 43 - Mesh Reduce Scheduler
 * CRDT reduction: merge gossip into latest snapshot
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { GossipEnvelope } from '../types/mesh';
import { Obj, mergeMany, toSnapshot } from '../mesh/crdt';

const db = admin.firestore();

export const meshReduce = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'UTC',
    retryCount: 2,
  },
  async (event) => {
    try {
      console.log('[meshReduce] Starting gossip reduction...');

      // Get latest gossip (last 500 messages)
      const gossipSnap = await db
        .collection('mesh_gossip')
        .orderBy('ts', 'desc')
        .limit(500)
        .get();

      console.log(`[meshReduce] Processing ${gossipSnap.size} gossip messages`);

      // Convert to CRDT objects
      const objects: Obj[] = [];

      for (const doc of gossipSnap.docs) {
        const gossip = doc.data() as GossipEnvelope;

        // Extract object from payload
        const obj: Obj = {
          id: gossip.payload?.id || gossip.id,
          ts: gossip.ts,
          kind: gossip.kind,
          body: gossip.payload,
        };

        objects.push(obj);
      }

      // Merge using LWW-CRDT
      const state = mergeMany(objects);
      const snapshot = toSnapshot(state);

      // Save snapshot
      await db.collection('mesh_snapshots').doc('latest').set({
        ts: Date.now(),
        state: snapshot,
        objectCount: state.size,
        gossipCount: gossipSnap.size,
      });

      console.log(`[meshReduce] Reduced ${gossipSnap.size} gossip → ${state.size} objects`);

      // Log summary by kind
      const kindCounts: Record<string, number> = {};
      for (const obj of objects) {
        kindCounts[obj.kind] = (kindCounts[obj.kind] || 0) + 1;
      }

      console.log('[meshReduce] Summary by kind:', kindCounts);

      // Cleanup old gossip (older than 24 hours)
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const oldGossip = await db
        .collection('mesh_gossip')
        .where('ts', '<', cutoff)
        .limit(100)
        .get();

      if (oldGossip.size > 0) {
        const batch = db.batch();
        oldGossip.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        console.log(`[meshReduce] Cleaned up ${oldGossip.size} old gossip messages`);
      }

      console.log('[meshReduce] Complete');
    } catch (error) {
      console.error('[meshReduce] Error:', error);
      throw error;
    }
  }
);
