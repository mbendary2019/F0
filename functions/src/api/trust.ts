/**
 * Phase 42 - Trust API
 * HTTP endpoints for peer trust scores
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

export const apiTrust = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      // Auth check
      if (!isService(req)) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }

      const { method } = req;

      // GET /api/trust - Get trust scores
      if (method === 'GET') {
        const { peer, minScore } = req.query as any;

        let query: any = db.collection('trust_scores');

        if (peer) {
          query = query.where('peer', '==', peer);
        }

        const snap = await query.orderBy('ts', 'desc').limit(100).get();

        let scores = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Filter by minScore if provided
        if (minScore) {
          const min = parseFloat(minScore);
          scores = scores.filter((s: any) => s.score >= min);
        }

        res.status(200).json({ scores, count: scores.length });
        return;
      }

      res.status(405).json({ error: 'Method not allowed' });
    } catch (error: any) {
      console.error('[apiTrust] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
);
