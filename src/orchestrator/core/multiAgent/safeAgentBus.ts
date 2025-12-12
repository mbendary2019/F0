// orchestrator/core/multiAgent/safeAgentBus.ts
// =============================================================================
// Phase 155.6 – SafeAgentBus
// Wraps AgentBus with safety checks and pending actions support
// =============================================================================

import {
  AgentBus,
  AgentMessage,
  AgentRole,
  SafetyChecker,
} from './types';

export interface PendingAction {
  id: string;
  message: AgentMessage;
  reason: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface PendingActionsStore {
  save(action: PendingAction): Promise<void>;
  get(actionId: string): Promise<PendingAction | null>;
  list(projectId: string): Promise<PendingAction[]>;
  approve(actionId: string): Promise<PendingAction | null>;
  reject(actionId: string): Promise<void>;
}

// In-memory implementation for dev/testing
export class InMemoryPendingActionsStore implements PendingActionsStore {
  private actions = new Map<string, PendingAction>();

  async save(action: PendingAction): Promise<void> {
    this.actions.set(action.id, action);
    console.log('[155.6][PENDING_STORE] Saved pending action:', action.id, action.reason);
  }

  async get(actionId: string): Promise<PendingAction | null> {
    return this.actions.get(actionId) ?? null;
  }

  async list(projectId: string): Promise<PendingAction[]> {
    const all = Array.from(this.actions.values());
    return all.filter(
      (a) => a.status === 'pending' && a.message.context.projectId === projectId
    );
  }

  async approve(actionId: string): Promise<PendingAction | null> {
    const action = this.actions.get(actionId);
    if (!action) return null;
    action.status = 'approved';
    this.actions.set(actionId, action);
    console.log('[155.6][PENDING_STORE] Approved action:', actionId);
    return action;
  }

  async reject(actionId: string): Promise<void> {
    const action = this.actions.get(actionId);
    if (action) {
      action.status = 'rejected';
      this.actions.set(actionId, action);
      console.log('[155.6][PENDING_STORE] Rejected action:', actionId);
    }
  }

  // Helper for debugging
  getAll(): PendingAction[] {
    return Array.from(this.actions.values());
  }
}

function generateId(prefix = 'pending'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export class SafeAgentBus implements AgentBus {
  constructor(
    private readonly inner: AgentBus,
    private readonly safety: SafetyChecker,
    private readonly pendingStore?: PendingActionsStore
  ) {
    console.log('[155.6][SAFE_BUS] SafeAgentBus initialized');
  }

  subscribe(
    role: AgentRole,
    handler: (message: AgentMessage) => Promise<void>
  ): void {
    this.inner.subscribe(role, handler);
  }

  async publish<TPayload = unknown>(
    message: AgentMessage<TPayload>
  ): Promise<void> {
    // Evaluate safety
    const { allowed, requiresUserConfirm, reason } = await this.safety.evaluate(
      message as AgentMessage
    );

    if (!allowed && !requiresUserConfirm) {
      console.warn('[155.6][SAFE_BUS] Message BLOCKED by guardrails:', message.kind, reason);
      return;
    }

    if (requiresUserConfirm) {
      if (this.pendingStore) {
        // Save to pending actions for user approval
        const pendingAction: PendingAction = {
          id: generateId('pending'),
          message: message as AgentMessage,
          reason: reason ?? 'Requires user confirmation',
          createdAt: new Date().toISOString(),
          status: 'pending',
        };
        await this.pendingStore.save(pendingAction);
        console.log('[155.6][SAFE_BUS] Message queued for approval:', message.kind);
      } else {
        // No pending store - log warning but allow (dev mode)
        console.warn('[155.6][SAFE_BUS] Would require confirmation but no pending store:', message.kind);
        await this.inner.publish(message);
      }
      return;
    }

    // Allowed without confirmation - publish directly
    await this.inner.publish(message);
  }

  // Helper to approve and execute pending action
  async approveAndExecute(actionId: string): Promise<boolean> {
    if (!this.pendingStore) return false;

    const action = await this.pendingStore.approve(actionId);
    if (!action) return false;

    // Execute the message directly on inner bus (bypass safety since already approved)
    await this.inner.publish(action.message);
    console.log('[155.6][SAFE_BUS] Executed approved action:', actionId);
    return true;
  }

  // Helper to get pending actions for a project
  async getPendingActions(projectId: string): Promise<PendingAction[]> {
    if (!this.pendingStore) return [];
    return this.pendingStore.list(projectId);
  }

  // Helper to reject pending action
  async rejectAction(actionId: string): Promise<void> {
    if (this.pendingStore) {
      await this.pendingStore.reject(actionId);
    }
  }
}

console.log('[155.6][ORCHESTRATOR][SAFE_BUS] SafeAgentBus module loaded');
