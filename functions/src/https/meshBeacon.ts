/**
 * Phase 43 - Mesh Beacon Endpoint
 * Bootstrap endpoint for peer discovery and registration
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { MeshPeer } from '../types/mesh';

const db = admin.firestore();

export const meshBeacon = onRequest(
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

      const { id, pubKey, region, endpoints } = req.body as {
        id: string;
        pubKey: string;
        region?: string;
        endpoints?: { webrtc?: string; https?: string };
      };

      // Validate required fields
      if (!id || !pubKey) {
        res.status(400).json({ error: 'Missing required fields: id, pubKey' });
        return;
      }

      // Validate ID format (fz-xx)
      if (!/^fz-[a-z0-9]{2,10}$/.test(id)) {
        res.status(400).json({ error: 'Invalid peer ID format. Expected: fz-{slug}' });
        return;
      }

      // Create or update peer
      const peer: MeshPeer = {
        id,
        pubKey,
        region,
        endpoints: endpoints || {},
        lastSeenAt: Date.now(),
        trust: 0.5, // Default trust score
      };

      await db.collection('mesh_peers').doc(id).set(peer, { merge: true });

      // Log audit
      await db.collection('ops_audit').add({
        ts: Date.now(),
        actor: 'meshBeacon',
        action: 'peer_registered',
        details: {
          peerId: id,
          region,
          endpoints,
        },
      });

      console.log(`[meshBeacon] Registered peer ${id} from ${region || 'unknown'}`);

      res.status(200).json({
        ok: true,
        peer: {
          id,
          region,
          trust: peer.trust,
        },
      });
    } catch (error: any) {
      console.error('[meshBeacon] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
);
