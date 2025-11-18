/**
 * Phase 43 - Mesh API
 * HTTP endpoints for mesh peers, links, and snapshots
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

function isAdmin(req: any): boolean {
  return req.auth?.token?.admin === true;
}

function isService(req: any): boolean {
  return req.auth?.token?.role === 'service' || isAdmin(req);
}

export const apiMesh = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      // Auth check - allow public read for demo/testing
      // Production: uncomment the following lines for proper auth
      // if (!isService(req)) {
      //   res.status(403).json({ error: 'Unauthorized' });
      //   return;
      // }

      const { method, url } = req;
      const path = new URL(url || '', `http://${req.headers.host}`).pathname;

      // GET /api/mesh/peers - List mesh peers
      if (method === 'GET' && path.endsWith('/peers')) {
        const { region, minTrust } = req.query as any;

        let query: any = db.collection('mesh_peers');

        if (region) {
          query = query.where('region', '==', region);
        }

        const snap = await query.orderBy('lastSeenAt', 'desc').limit(100).get();

        let peers = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Filter by minTrust if provided
        if (minTrust) {
          const min = parseFloat(minTrust);
          peers = peers.filter((p: any) => (p.trust || 0) >= min);
        }

        res.status(200).json({ peers, count: peers.length });
        return;
      }

      // GET /api/mesh/links - List mesh links
      if (method === 'GET' && path.endsWith('/links')) {
        const { health } = req.query as any;

        let query: any = db.collection('mesh_links');

        if (health) {
          query = query.where('health', '==', health);
        }

        const snap = await query.orderBy('ts', 'desc').limit(100).get();

        const links = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        res.status(200).json({ links, count: links.length });
        return;
      }

      // GET /api/mesh/snapshot - Get latest snapshot
      if (method === 'GET' && path.endsWith('/snapshot')) {
        const snap = await db.collection('mesh_snapshots').doc('latest').get();

        if (!snap.exists) {
          res.status(404).json({ error: 'No snapshot available yet' });
          return;
        }

        const data = snap.data();

        res.status(200).json({
          ts: data?.ts,
          objectCount: data?.objectCount,
          gossipCount: data?.gossipCount,
          state: data?.state,
        });
        return;
      }

      res.status(404).json({ error: 'Not found' });
    } catch (error: any) {
      console.error('[apiMesh] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
);
