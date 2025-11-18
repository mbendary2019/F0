/**
 * Phase 43 - Mesh Gossip Endpoint
 * Receive gossip messages from mesh peers
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { GossipEnvelope } from '../types/mesh';

const db = admin.firestore();

export const meshGossip = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      const envelope = req.body as GossipEnvelope;

      // Validate required fields
      if (!envelope || !envelope.kind || !envelope.from) {
        res.status(400).json({ error: 'Missing required fields: kind, from' });
        return;
      }

      // Validate kind
      if (!['proposal', 'vote', 'risk', 'telemetry'].includes(envelope.kind)) {
        res.status(400).json({ error: 'Invalid kind. Must be: proposal, vote, risk, or telemetry' });
        return;
      }

      // Verify peer is registered
      const peerSnap = await db.collection('mesh_peers').doc(envelope.from).get();
      if (!peerSnap.exists) {
        res.status(403).json({ error: 'Unknown peer. Register via meshBeacon first.' });
        return;
      }

      // TODO: Verify signature using peer's pubKey
      // For MVP, skip signature verification
      // const peerData = peerSnap.data();
      // if (envelope.sig && peerData.pubKey) {
      //   const valid = await verifyGossipSignature(envelope, peerData.pubKey);
      //   if (!valid) {
      //     return res.status(403).json({ error: 'Invalid signature' });
      //   }
      // }

      // Store gossip envelope
      const gossipId = envelope.id || `ge_${Date.now()}_${envelope.from}`;
      const gossipDoc: GossipEnvelope = {
        ...envelope,
        id: gossipId,
        ts: envelope.ts || Date.now(),
      };

      await db.collection('mesh_gossip').doc(gossipId).set(gossipDoc);

      // Update peer lastSeenAt
      await db.collection('mesh_peers').doc(envelope.from).update({
        lastSeenAt: Date.now(),
      });

      console.log(`[meshGossip] Received ${envelope.kind} from ${envelope.from}`);

      res.status(200).json({
        ok: true,
        id: gossipId,
      });
    } catch (error: any) {
      console.error('[meshGossip] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
);
