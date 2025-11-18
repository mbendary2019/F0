/**
 * Phase 42 - Economics API
 * HTTP endpoints for federated economic optimization
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

export const apiEconomics = onRequest(
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

      // GET /api/economics - List economic optimization runs
      if (method === 'GET') {
        const { objective, limit = 50 } = req.query as any;

        let query: any = db.collection('fed_economics');

        if (objective) {
          query = query.where('objective', '==', objective);
        }

        const snap = await query.orderBy('ts', 'desc').limit(parseInt(limit, 10)).get();

        const economics = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        res.status(200).json({ economics, count: economics.length });
        return;
      }

      // POST /api/economics - Create economic optimization objective
      if (method === 'POST') {
        const { objective, weights, constraints } = req.body;

        if (!objective) {
          res.status(400).json({ error: 'Missing required field: objective' });
          return;
        }

        const econ = {
          id: `fe_${Date.now()}`,
          ts: Date.now(),
          objective,
          weights,
          constraints,
          candidates: [],
          winner: null,
        };

        await db.collection('fed_economics').add(econ);

        res.status(201).json({ success: true, economics: econ });
        return;
      }

      res.status(405).json({ error: 'Method not allowed' });
    } catch (error: any) {
      console.error('[apiEconomics] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
);
