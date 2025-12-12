// src/lib/agents/federation/bus.ts
// =============================================================================
// Phase 155.1 – AgentBus Implementation
// Central message bus for agent communication
// =============================================================================

import { nanoid } from 'nanoid';
import type {
  AgentBus,
  AgentMessage,
  AgentRole,
  AgentMessageHandler,
  Unsubscribe,
  SafetyEnvelope,
  AgentMessageKind,
} from './types';
import { createLowRiskEnvelope } from './safety';

// =============================================================================
// In-Memory AgentBus Implementation
// =============================================================================

/**
 * In-memory implementation of AgentBus
 * Suitable for single-instance deployments
 * Can be extended with Redis/Firestore for distributed systems
 */
export class InMemoryAgentBus implements AgentBus {
  /** Message history by session */
  private history: Map<string, AgentMessage[]> = new Map();

  /** Subscribers by role */
  private subscribers: Map<AgentRole, Set<AgentMessageHandler>> = new Map();

  /** Pending messages by role */
  private pending: Map<AgentRole, AgentMessage[]> = new Map();

  /** Maximum history size per session */
  private maxHistorySize: number;

  constructor(options?: { maxHistorySize?: number }) {
    this.maxHistorySize = options?.maxHistorySize ?? 1000;
    console.log('[155.1][AGENTS][BUS] InMemoryAgentBus initialized');
  }

  /**
   * Send a message to a specific agent or broadcast
   */
  async send<T>(message: AgentMessage<T>): Promise<void> {
    console.log('[155.1][AGENTS][BUS] Sending message:', {
      id: message.id,
      from: message.from,
      to: message.to,
      kind: message.kind,
    });

    // Store in history
    this.addToHistory(message);

    // If broadcast, notify all subscribers
    if (message.to === 'broadcast') {
      await this.notifyAll(message);
      return;
    }

    // Get subscribers for the target role
    const roleSubscribers = this.subscribers.get(message.to);

    if (!roleSubscribers || roleSubscribers.size === 0) {
      // No active subscribers, add to pending
      console.log('[155.1][AGENTS][BUS] No subscribers for role, adding to pending:', message.to);
      this.addToPending(message.to, message);
      return;
    }

    // Notify all subscribers for this role
    const handlers = Array.from(roleSubscribers);
    for (const handler of handlers) {
      try {
        await handler(message);
      } catch (error) {
        console.error('[155.1][AGENTS][BUS] Handler error:', error);
      }
    }
  }

  /**
   * Subscribe to messages for a specific role
   */
  subscribe<T>(role: AgentRole, handler: AgentMessageHandler<T>): Unsubscribe {
    console.log('[155.1][AGENTS][BUS] New subscription for role:', role);

    // Get or create subscriber set for this role
    let roleSubscribers = this.subscribers.get(role);
    if (!roleSubscribers) {
      roleSubscribers = new Set();
      this.subscribers.set(role, roleSubscribers);
    }

    // Add handler
    roleSubscribers.add(handler as AgentMessageHandler);

    // Process any pending messages
    const pendingMessages = this.pending.get(role) || [];
    if (pendingMessages.length > 0) {
      console.log('[155.1][AGENTS][BUS] Processing pending messages:', pendingMessages.length);
      this.pending.set(role, []);

      // Process pending asynchronously
      setTimeout(async () => {
        for (const msg of pendingMessages) {
          try {
            await handler(msg as AgentMessage<T>);
          } catch (error) {
            console.error('[155.1][AGENTS][BUS] Error processing pending message:', error);
          }
        }
      }, 0);
    }

    // Return unsubscribe function
    return () => {
      console.log('[155.1][AGENTS][BUS] Unsubscribing from role:', role);
      roleSubscribers?.delete(handler as AgentMessageHandler);
    };
  }

  /**
   * Broadcast a message to all agents
   */
  async broadcast<T>(message: Omit<AgentMessage<T>, 'to'>): Promise<void> {
    const fullMessage: AgentMessage<T> = {
      ...message,
      to: 'broadcast',
    } as AgentMessage<T>;

    await this.send(fullMessage);
  }

  /**
   * Get message history for a session
   */
  getHistory(sessionId: string): AgentMessage[] {
    return this.history.get(sessionId) || [];
  }

  /**
   * Clear message history for a session
   */
  clearHistory(sessionId: string): void {
    console.log('[155.1][AGENTS][BUS] Clearing history for session:', sessionId);
    this.history.delete(sessionId);
  }

  /**
   * Get pending messages for a role
   */
  getPending(role: AgentRole): AgentMessage[] {
    return this.pending.get(role) || [];
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private addToHistory(message: AgentMessage): void {
    const sessionId = message.sessionId;
    let sessionHistory = this.history.get(sessionId);

    if (!sessionHistory) {
      sessionHistory = [];
      this.history.set(sessionId, sessionHistory);
    }

    sessionHistory.push(message);

    // Trim history if too large
    if (sessionHistory.length > this.maxHistorySize) {
      sessionHistory.splice(0, sessionHistory.length - this.maxHistorySize);
    }
  }

  private addToPending(role: AgentRole, message: AgentMessage): void {
    let rolePending = this.pending.get(role);
    if (!rolePending) {
      rolePending = [];
      this.pending.set(role, rolePending);
    }
    rolePending.push(message);
  }

  private async notifyAll(message: AgentMessage): Promise<void> {
    const allHandlers: AgentMessageHandler[] = [];

    const subscriberSets = Array.from(this.subscribers.values());
    for (const handlers of subscriberSets) {
      const handlerArr = Array.from(handlers);
      for (const handler of handlerArr) {
        allHandlers.push(handler);
      }
    }

    console.log('[155.1][AGENTS][BUS] Broadcasting to', allHandlers.length, 'handlers');

    for (const handler of allHandlers) {
      try {
        await handler(message);
      } catch (error) {
        console.error('[155.1][AGENTS][BUS] Broadcast handler error:', error);
      }
    }
  }
}

// =============================================================================
// Message Builder Utilities
// =============================================================================

/**
 * Create a new agent message
 */
export function createMessage<T>(
  options: {
    from: AgentRole;
    to: AgentRole | 'broadcast';
    kind: AgentMessageKind;
    payload: T;
    projectId: string;
    sessionId: string;
    parentMessageId?: string;
    envelope?: SafetyEnvelope;
  }
): AgentMessage<T> {
  return {
    id: nanoid(),
    from: options.from,
    to: options.to,
    kind: options.kind,
    payload: options.payload,
    projectId: options.projectId,
    sessionId: options.sessionId,
    parentMessageId: options.parentMessageId,
    envelope: options.envelope || createLowRiskEnvelope(),
    timestamp: Date.now(),
  };
}

/**
 * Create a plan request message
 */
export function createPlanRequest(
  from: AgentRole,
  projectId: string,
  sessionId: string,
  userIntent: string,
  context?: Record<string, unknown>
): AgentMessage {
  return createMessage({
    from,
    to: 'planner',
    kind: 'plan_request',
    payload: { userIntent, context },
    projectId,
    sessionId,
  });
}

/**
 * Create a task assignment message
 */
export function createTaskAssignment(
  from: AgentRole,
  to: AgentRole,
  projectId: string,
  sessionId: string,
  task: {
    id: string;
    title: string;
    description: string;
    dependencies: string[];
  },
  envelope?: SafetyEnvelope
): AgentMessage {
  return createMessage({
    from,
    to,
    kind: 'task_assign',
    payload: { task },
    projectId,
    sessionId,
    envelope,
  });
}

/**
 * Create a status update message
 */
export function createStatusUpdate(
  from: AgentRole,
  projectId: string,
  sessionId: string,
  message: string,
  level: 'info' | 'warning' | 'success' | 'error' = 'info',
  taskId?: string,
  progress?: number
): AgentMessage {
  return createMessage({
    from,
    to: 'broadcast',
    kind: 'status_update',
    payload: { message, level, taskId, progress },
    projectId,
    sessionId,
  });
}

/**
 * Create an error message
 */
export function createErrorMessage(
  from: AgentRole,
  projectId: string,
  sessionId: string,
  code: string,
  message: string,
  recoverable: boolean = true,
  taskId?: string
): AgentMessage {
  return createMessage({
    from,
    to: 'broadcast',
    kind: 'error',
    payload: { code, message, recoverable, taskId },
    projectId,
    sessionId,
  });
}

// =============================================================================
// Singleton Instance
// =============================================================================

let globalBus: InMemoryAgentBus | null = null;

/**
 * Get the global AgentBus instance
 */
export function getAgentBus(): InMemoryAgentBus {
  if (!globalBus) {
    globalBus = new InMemoryAgentBus();
  }
  return globalBus;
}

/**
 * Reset the global bus (for testing)
 */
export function resetAgentBus(): void {
  globalBus = null;
}

console.log('[155.1][AGENTS][BUS] AgentBus module loaded');
