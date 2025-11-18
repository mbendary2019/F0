/**
 * Admin Audit Logging
 * Logs admin actions to Firestore for compliance and security tracking
 */

import { getFirestore } from 'firebase-admin/firestore';

type AuditEntry = {
  action: 'grant' | 'revoke' | string;
  actorUid: string;
  targetUid?: string;
  meta?: Record<string, unknown>;
  ts: number;
  ip?: string;
  ua?: string;
};

export async function auditAdmin(
  action: AuditEntry['action'],
  actorUid: string,
  targetUid?: string,
  meta?: AuditEntry['meta'],
  req?: Request | { headers: { get: (key: string) => string | null } }
) {
  try {
    const db = getFirestore();
    const doc: AuditEntry = {
      action,
      actorUid,
      targetUid,
      meta,
      ts: Date.now(),
      ip: req ? (req.headers.get('x-forwarded-for') ?? undefined) : undefined,
      ua: req ? (req.headers.get('user-agent') ?? undefined) : undefined,
    };
    await db.collection('admin_audit').add(doc);
  } catch (e) {
    // Fallback - don't block the main request
    // eslint-disable-next-line no-console
    console.log('[auditAdmin:fallback]', { action, actorUid, targetUid, error: e });
  }
}

