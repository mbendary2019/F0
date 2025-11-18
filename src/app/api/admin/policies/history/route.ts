/**
 * Policy History API
 * View policy evolution and adaptation history
 */

import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * GET /api/admin/policies/history
 * Returns current policy state, guardrails, and auto-doc log
 */
export async function GET() {
  await assertAdminReq();

  try {
    const db = getFirestore();

    // Get current policy
    const policyDoc = await db.collection('rl_policy').doc('global').get();
    const policy = policyDoc.exists ? policyDoc.data() : {};

    // Get guardrails
    const guardrailDoc = await db
      .collection('ops_policies')
      .doc('protected_targets')
      .get()
      .catch(() => null);
    const guardrails = guardrailDoc?.exists ? guardrailDoc.data() : {};

    // Get auto-doc log
    const docLog = await db
      .collection('auto_docs')
      .doc('AUTO_POLICY_LOG')
      .get()
      .catch(() => null);
    const log = docLog?.exists ? (docLog.data()?.log || '') : '';
    const entryCount = docLog?.exists ? (docLog.data()?.entryCount || 0) : 0;

    // Get policy versions (last 10)
    const versionsSnap = await db
      .collection('rl_policy_versions')
      .orderBy('since', 'desc')
      .limit(10)
      .get()
      .catch(() => null);

    const versions = versionsSnap
      ? versionsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      : [];

    // Get recent audit events related to auto-tuning
    const auditSnap = await db
      .collection('admin_audit')
      .where('action', 'in', [
        'policy_auto_tuned',
        'guardrail_adapted',
        'policy_champion_selected',
        'auto_doc_updated'
      ])
      .orderBy('ts', 'desc')
      .limit(20)
      .get()
      .catch(() => null);

    const recentEvents = auditSnap
      ? auditSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      : [];

    return Response.json(
      {
        policy,
        guardrails,
        log,
        entryCount,
        versions,
        recentEvents
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Policy History GET] Error:', error);
    return Response.json(
      { error: 'Failed to fetch policy history' },
      { status: 500 }
    );
  }
}


