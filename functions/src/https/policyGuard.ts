/**
 * Phase 39 - Policy Guard HTTPS Function
 * Evaluates policy activation requests and logs decisions
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { evaluateActivation } from '../governance/evaluator';

const db = admin.firestore();

export const policyGuard = onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { policyId, version, diff } = req.body || {};
    const decision = await evaluateActivation({ policyId, version, diff });

    // Audit log
    await db.collection('ops_audit').add({
      ts: Date.now(),
      actor: 'policy-guard',
      action: 'evaluate',
      policyId,
      version,
      decision,
    });

    res.json(decision);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'unknown' });
  }
});
