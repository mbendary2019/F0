// F0 Phase 36 - Audit System Types

export interface AuditActor {
  uid: string;
  email?: string;
  ip?: string;
  deviceId?: string;
  userAgent?: string;
}

export interface AuditTarget {
  type: string; // 'project', 'user', 'job', 'license', 'extension', etc.
  id: string;
  name?: string;
}

export interface AuditContext {
  ok: boolean;
  code?: string;
  latencyMs?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface AuditEvent {
  action: string; // e.g., 'deploy.run', 'ext.install', 'license.issue'
  actor: AuditActor;
  target?: AuditTarget;
  payload?: any;
  ok?: boolean;
  code?: string;
  latencyMs?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface AuditEntry {
  ts: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  actor: AuditActor;
  action: string;
  target: AuditTarget | null;
  ctx: AuditContext;
  payloadHash: string;
  prevHash: string;
  chainHash: string;
}

export interface AuditMeta {
  lastEventId: string;
  lastChainHash: string;
  eventCount?: number;
  firstEventTs?: FirebaseFirestore.Timestamp;
  lastEventTs?: FirebaseFirestore.Timestamp;
}

export interface AuditChainVerification {
  valid: boolean;
  day: string;
  totalEvents: number;
  brokenLinks: Array<{
    eventId: string;
    expectedHash: string;
    actualHash: string;
  }>;
}


