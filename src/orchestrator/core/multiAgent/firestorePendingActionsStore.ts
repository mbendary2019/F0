// orchestrator/core/multiAgent/firestorePendingActionsStore.ts
// =============================================================================
// Phase 156.2 – Firestore PendingActionsStore
// Persistent storage for pending actions with audit logging
// =============================================================================

import { AgentMessage } from './types';
import { PendingAction, PendingActionsStore } from './safeAgentBus';

// Firestore types - we'll import from server when available
type FirestoreDB = {
  collection: (name: string) => {
    doc: (id: string) => {
      set: (data: unknown) => Promise<void>;
      get: () => Promise<{ exists: boolean; data: () => unknown }>;
      update: (data: unknown) => Promise<void>;
    };
    where: (field: string, op: string, value: unknown) => {
      where: (field: string, op: string, value: unknown) => {
        orderBy: (field: string, dir: string) => {
          get: () => Promise<{ docs: Array<{ id: string; data: () => unknown }> }>;
        };
        get: () => Promise<{ docs: Array<{ id: string; data: () => unknown }> }>;
      };
      orderBy: (field: string, dir: string) => {
        get: () => Promise<{ docs: Array<{ id: string; data: () => unknown }> }>;
      };
      get: () => Promise<{ docs: Array<{ id: string; data: () => unknown }> }>;
    };
    add: (data: unknown) => Promise<{ id: string }>;
  };
};

export interface AuditLogEntry {
  id?: string;
  projectId: string;
  userId?: string;
  actionType: 'shell' | 'browser' | 'git' | 'code' | 'fix';
  payloadSummary: string;
  riskLevel: 'low' | 'medium' | 'high';
  decision: 'approved' | 'rejected' | 'blocked' | 'auto';
  decidedBy: 'user' | 'policy' | 'system';
  planId?: string;
  createdAt: string;
  decidedAt?: string;
  reason?: string;
}

export class FirestorePendingActionsStore implements PendingActionsStore {
  private db: FirestoreDB;
  private pendingCol: string;
  private auditCol: string;

  constructor(db: FirestoreDB, options?: { pendingCollection?: string; auditCollection?: string }) {
    this.db = db;
    this.pendingCol = options?.pendingCollection ?? 'agentPendingActions';
    this.auditCol = options?.auditCollection ?? 'agentActionAudit';
    console.log('[156.2][FIRESTORE] FirestorePendingActionsStore initialized');
  }

  async save(action: PendingAction): Promise<void> {
    await this.db.collection(this.pendingCol).doc(action.id).set({
      ...action,
      createdAt: action.createdAt || new Date().toISOString(),
    });
    console.log('[156.2][FIRESTORE] Saved pending action:', action.id);
  }

  async get(actionId: string): Promise<PendingAction | null> {
    const doc = await this.db.collection(this.pendingCol).doc(actionId).get();
    if (!doc.exists) return null;
    return doc.data() as PendingAction;
  }

  async list(projectId: string): Promise<PendingAction[]> {
    const snap = await this.db
      .collection(this.pendingCol)
      .where('message.context.projectId', '==', projectId)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map((d) => d.data() as PendingAction);
  }

  async approve(actionId: string): Promise<PendingAction | null> {
    const action = await this.get(actionId);
    if (!action) return null;

    const now = new Date().toISOString();
    await this.db.collection(this.pendingCol).doc(actionId).update({
      status: 'approved',
      decidedAt: now,
    });

    // Log to audit
    await this.logAudit({
      projectId: action.message.context.projectId,
      userId: action.message.context.userId,
      actionType: this.getActionType(action.message),
      payloadSummary: this.getPayloadSummary(action.message),
      riskLevel: this.getRiskLevel(action.message),
      decision: 'approved',
      decidedBy: 'user',
      planId: action.message.context.planId,
      createdAt: action.createdAt,
      decidedAt: now,
      reason: action.reason,
    });

    console.log('[156.2][FIRESTORE] Approved action:', actionId);
    return { ...action, status: 'approved' };
  }

  async reject(actionId: string): Promise<void> {
    const action = await this.get(actionId);
    if (!action) return;

    const now = new Date().toISOString();
    await this.db.collection(this.pendingCol).doc(actionId).update({
      status: 'rejected',
      decidedAt: now,
    });

    // Log to audit
    await this.logAudit({
      projectId: action.message.context.projectId,
      userId: action.message.context.userId,
      actionType: this.getActionType(action.message),
      payloadSummary: this.getPayloadSummary(action.message),
      riskLevel: this.getRiskLevel(action.message),
      decision: 'rejected',
      decidedBy: 'user',
      planId: action.message.context.planId,
      createdAt: action.createdAt,
      decidedAt: now,
      reason: action.reason,
    });

    console.log('[156.2][FIRESTORE] Rejected action:', actionId);
  }

  // ===================
  // Audit Log Methods
  // ===================

  async logAudit(entry: AuditLogEntry): Promise<string> {
    const ref = await this.db.collection(this.auditCol).add({
      ...entry,
      createdAt: entry.createdAt || new Date().toISOString(),
    });
    console.log('[156.2][FIRESTORE] Audit log added:', ref.id);
    return ref.id;
  }

  async logBlocked(message: AgentMessage, reason: string): Promise<void> {
    await this.logAudit({
      projectId: message.context.projectId,
      userId: message.context.userId,
      actionType: this.getActionType(message),
      payloadSummary: this.getPayloadSummary(message),
      riskLevel: 'high',
      decision: 'blocked',
      decidedBy: 'policy',
      planId: message.context.planId,
      createdAt: new Date().toISOString(),
      reason,
    });
  }

  async getAuditLogs(projectId: string, limit = 50): Promise<AuditLogEntry[]> {
    const snap = await this.db
      .collection(this.auditCol)
      .where('projectId', '==', projectId)
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.slice(0, limit).map((d) => ({
      id: d.id,
      ...d.data(),
    })) as AuditLogEntry[];
  }

  async getAuditStats(projectId: string): Promise<{
    approved: number;
    rejected: number;
    blocked: number;
    auto: number;
    total: number;
  }> {
    const logs = await this.getAuditLogs(projectId, 1000);

    const stats = {
      approved: 0,
      rejected: 0,
      blocked: 0,
      auto: 0,
      total: logs.length,
    };

    for (const log of logs) {
      switch (log.decision) {
        case 'approved':
          stats.approved++;
          break;
        case 'rejected':
          stats.rejected++;
          break;
        case 'blocked':
          stats.blocked++;
          break;
        case 'auto':
          stats.auto++;
          break;
      }
    }

    return stats;
  }

  // ===================
  // Helpers
  // ===================

  private getActionType(message: AgentMessage): AuditLogEntry['actionType'] {
    switch (message.to) {
      case 'shell':
        return 'shell';
      case 'browser':
        return 'browser';
      case 'git':
        return 'git';
      case 'code':
        return 'code';
      default:
        return 'code';
    }
  }

  private getPayloadSummary(message: AgentMessage): string {
    const payload = message.payload as Record<string, unknown>;

    // Try to extract command or URL
    const task = payload?.task as Record<string, unknown> | undefined;
    const input = task?.input as Record<string, unknown> | undefined;

    if (input?.command) return String(input.command).slice(0, 100);
    if (input?.url) return String(input.url).slice(0, 100);
    if (payload?.decision) return `Decision: ${payload.decision}`;

    return message.kind;
  }

  private getRiskLevel(message: AgentMessage): AuditLogEntry['riskLevel'] {
    const level = message.safety?.level;
    if (level === 'high') return 'high';
    if (level === 'medium') return 'medium';
    return 'low';
  }
}

console.log('[156.2][ORCHESTRATOR] FirestorePendingActionsStore module loaded');
