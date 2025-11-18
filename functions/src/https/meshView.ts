/**
 * Phase 43 - Mesh View (Public demo endpoint)
 * Public read-only view of mesh state for testing
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const meshView = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      const { method, url } = req;
      const path = new URL(url || '', `http://${req.headers.host}`).pathname;

      // GET /meshView/peers - List all peers
      if (method === 'GET' && (path.endsWith('/peers') || path === '/')) {
        const peersSnap = await db
          .collection('mesh_peers')
          .orderBy('lastSeenAt', 'desc')
          .limit(100)
          .get();

        const peers = peersSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        res.status(200).json({ peers, count: peers.length });
        return;
      }

      // GET /meshView/gossip - List recent gossip
      if (method === 'GET' && path.endsWith('/gossip')) {
        const gossipSnap = await db
          .collection('mesh_gossip')
          .orderBy('ts', 'desc')
          .limit(50)
          .get();

        const gossip = gossipSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        res.status(200).json({ gossip, count: gossip.length });
        return;
      }

      // GET /meshView/snapshot - Get latest snapshot
      if (method === 'GET' && path.endsWith('/snapshot')) {
        const snap = await db.collection('mesh_snapshots').doc('latest').get();

        if (!snap.exists) {
          res.status(404).json({ error: 'No snapshot yet - wait for meshReduce to run (every 5 min)' });
          return;
        }

        res.status(200).json(snap.data());
        return;
      }

      // GET /meshView/links - List mesh links
      if (method === 'GET' && path.endsWith('/links')) {
        const linksSnap = await db
          .collection('mesh_links')
          .orderBy('ts', 'desc')
          .limit(100)
          .get();

        const links = linksSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        res.status(200).json({ links, count: links.length });
        return;
      }

      // Default: Show all endpoints
      res.status(200).json({
        endpoints: [
          'GET /meshView/peers - List all mesh peers',
          'GET /meshView/gossip - List recent gossip messages',
          'GET /meshView/snapshot - Get latest CRDT snapshot',
          'GET /meshView/links - List mesh links',
        ],
      });
    } catch (error: any) {
      console.error('[meshView] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
);
