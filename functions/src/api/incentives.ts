/**
 * Phase 42 - Incentives API
 * HTTP endpoints for incentive credits and leaderboard
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

export const apiIncentives = onRequest(
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

      const { method, url } = req;
      const path = new URL(url || '', `http://${req.headers.host}`).pathname;

      // GET /api/incentives - Get incentive credits
      if (method === 'GET' && path.endsWith('/incentives')) {
        const { peer, action, limit = 100 } = req.query as any;

        let query: any = db.collection('incentive_credits');

        if (peer) {
          query = query.where('peer', '==', peer);
        }

        if (action) {
          query = query.where('action', '==', action);
        }

        const snap = await query.orderBy('ts', 'desc').limit(parseInt(limit, 10)).get();

        const credits = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Calculate total
        const total = credits.reduce((sum: number, c: any) => sum + (c.credits || 0), 0);

        res.status(200).json({ credits, count: credits.length, total });
        return;
      }

      // GET /api/incentives/leaderboard - Get leaderboard
      if (method === 'GET' && path.endsWith('/leaderboard')) {
        const leaderboardSnap = await db.collection('incentive_leaderboard').doc('daily').get();

        if (!leaderboardSnap.exists) {
          res.status(404).json({ error: 'Leaderboard not found' });
          return;
        }

        const data = leaderboardSnap.data();

        res.status(200).json({
          date: data?.date,
          ts: data?.ts,
          top10: data?.top10 || [],
        });
        return;
      }

      res.status(405).json({ error: 'Method not allowed' });
    } catch (error: any) {
      console.error('[apiIncentives] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
);
