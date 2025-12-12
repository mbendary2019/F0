// orchestrator/core/multiAgent/agentBus.ts
// =============================================================================
// Phase 155 – In-Memory Agent Bus Implementation
// =============================================================================

import { AgentBus, AgentMessage, AgentRole } from './types';

export class InMemoryAgentBus implements AgentBus {
  private handlers: Partial<
    Record<AgentRole, Array<(message: AgentMessage) => Promise<void>>>
  > = {};

  subscribe(
    role: AgentRole,
    handler: (message: AgentMessage) => Promise<void>
  ): void {
    if (!this.handlers[role]) {
      this.handlers[role] = [];
    }
    this.handlers[role]!.push(handler);
    console.log(`[155][BUS] Subscribed handler for role: ${role}`);
  }

  async publish<TPayload = unknown>(
    message: AgentMessage<TPayload>
  ): Promise<void> {
    console.log(`[155][BUS] Publishing message: ${message.kind} from ${message.from} to ${message.to}`);

    if (message.to === 'broadcast') {
      const allHandlers = Object.values(this.handlers)
        .filter(Boolean)
        .flat() as Array<(message: AgentMessage) => Promise<void>>;

      console.log(`[155][BUS] Broadcasting to ${allHandlers.length} handlers`);
      await Promise.all(allHandlers.map((h) => h(message as AgentMessage)));
      return;
    }

    const handlers = this.handlers[message.to];
    if (!handlers || handlers.length === 0) {
      console.log(`[155][BUS] No handlers for role: ${message.to}`);
      return;
    }

    console.log(`[155][BUS] Sending to ${handlers.length} handlers for role: ${message.to}`);
    await Promise.all(handlers.map((h) => h(message as AgentMessage)));
  }

  // Helper to get all subscribed roles
  getSubscribedRoles(): AgentRole[] {
    return Object.keys(this.handlers) as AgentRole[];
  }

  // Helper to clear all handlers (for testing)
  clear(): void {
    this.handlers = {};
    console.log('[155][BUS] All handlers cleared');
  }
}

console.log('[155][ORCHESTRATOR][BUS] AgentBus loaded');
