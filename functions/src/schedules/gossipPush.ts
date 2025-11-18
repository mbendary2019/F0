/**
 * Phase 43.1 - Gossip Push Scheduler
 * Periodically push telemetry/updates to weighted fanout peers
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import { pickFanout, getPeerEndpoints } from '../mesh/weightedGossip';

const db = admin.firestore();

export const gossipPush = onSchedule(
  {
    schedule: 'every 2 minutes',
    timeZone: 'UTC',
    retryCount: 2,
    memory: '256MiB',
  },
  async (event) => {
    try {
      const from = process.env.F0_INSTANCE_ID || 'fz-local';

      console.log(`[gossipPush] Starting gossip push from ${from}`);

      // Select weighted fanout peers (max 3)
      const selectedPeers = await pickFanout(from, 3);

      if (selectedPeers.length === 0) {
        console.log('[gossipPush] No peers available for fanout');
        return;
      }

      // Create telemetry envelope
      const envelope = {
        id: `ge_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        ts: Date.now(),
        kind: 'telemetry',
        payload: {
          id: 'gossip-push:2m',
          component: 'mesh-scheduler',
          metrics: {
            peersAvailable: selectedPeers.length,
            lastPush: Date.now(),
          },
        },
        from,
        sig: '', // TODO: Sign with Ed25519
      };

      console.log('[gossipPush] Envelope:', envelope);

      // Push to selected peers
      const results = await Promise.allSettled(
        selectedPeers.map(async (peerId) => {
          const endpoints = await getPeerEndpoints(peerId);

          if (!endpoints) {
            console.warn(`[gossipPush] No endpoints for peer ${peerId}`);
            return { peerId, status: 'no-endpoints' };
          }

          // Try WebRTC endpoint first, fallback to HTTPS
          const targetUrl =
            endpoints.webrtc ||
            endpoints.https ||
            `https://meshgossip-vpxyxgcfbq-uc.a.run.app`;

          console.log(`[gossipPush] Pushing to ${peerId} via ${targetUrl}`);

          try {
            const response = await fetch(targetUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(envelope),
              timeout: 5000,
            } as any);

            if (response.ok) {
              console.log(`[gossipPush] ✅ Success: ${peerId}`);
              return { peerId, status: 'success' };
            } else {
              console.warn(`[gossipPush] ⚠️ Failed: ${peerId} (${response.status})`);
              return { peerId, status: 'failed', code: response.status };
            }
          } catch (error: any) {
            console.error(`[gossipPush] ❌ Error pushing to ${peerId}:`, error.message);
            return { peerId, status: 'error', error: error.message };
          }
        })
      );

      // Count actual success/failure from the returned status
      let okCount = 0;
      let failCount = 0;

      results.forEach((r) => {
        if (r.status === 'fulfilled' && (r.value as any).status === 'success') {
          okCount++;
        } else {
          failCount++;
        }
      });

      console.log(
        `[gossipPush] Complete: ${okCount}/${selectedPeers.length} succeeded, ${failCount} failed`
      );

      // Store push audit log
      await db.collection('mesh_gossip_audit').add({
        ts: Date.now(),
        from,
        fanout: selectedPeers,
        succeeded: okCount,
        failed: failCount,
        envelopeId: envelope.id,
      });
    } catch (error) {
      console.error('[gossipPush] Fatal error:', error);
      throw error;
    }
  }
);
