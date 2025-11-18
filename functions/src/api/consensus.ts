/**
 * Phase 42 - Consensus API
 * HTTP endpoints for consensus proposals and votes
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

export const apiConsensus = onRequest(
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

      // GET /api/consensus - List proposals
      if (method === 'GET') {
        const { status, policyId, limit = 50 } = req.query as any;

        let query: any = db.collection('consensus_proposals');

        if (status) {
          query = query.where('status', '==', status);
        }

        if (policyId) {
          query = query.where('policyId', '==', policyId);
        }

        const snap = await query.orderBy('ts', 'desc').limit(parseInt(limit, 10)).get();

        const proposals = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        res.status(200).json({ proposals, count: proposals.length });
        return;
      }

      // POST /api/consensus - Create proposal
      if (method === 'POST') {
        const { policyId, baseVersion, params, from, evidence, quorum, ttlMs } = req.body;

        if (!policyId || !baseVersion || !params || !from) {
          res.status(400).json({ error: 'Missing required fields' });
          return;
        }

        const proposal = {
          id: `cp_${Date.now()}`,
          ts: Date.now(),
          policyId,
          baseVersion,
          params,
          from,
          quorum: quorum || 0.67,
          ttlMs: ttlMs || 3600000,
          votes: [],
          status: 'open',
          evidence,
        };

        await db.collection('consensus_proposals').doc(proposal.id).set(proposal);

        res.status(201).json({ success: true, proposal });
        return;
      }

      res.status(405).json({ error: 'Method not allowed' });
    } catch (error: any) {
      console.error('[apiConsensus] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
);
