import type { AgentMessage } from "@/lib/types/agent";

/**
 * In-memory message bus for agent communication
 * TODO: replace with Redis or Firestore-based pub/sub for production
 */
export class MemoryBus {
  private subscribers: Map<string, ((msg: AgentMessage) => void)[]> = new Map();
  private messageLog: AgentMessage[] = [];

  /**
   * Subscribe to messages for a specific agent
   */
  subscribe(agentId: string, handler: (msg: AgentMessage) => void): () => void {
    if (!this.subscribers.has(agentId)) {
      this.subscribers.set(agentId, []);
    }
    this.subscribers.get(agentId)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.subscribers.get(agentId);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Publish a message to target agents
   */
  publish(message: AgentMessage): void {
    this.messageLog.push(message);

    const targets = message.to ?? [];
    for (const target of targets) {
      const handlers = this.subscribers.get(target);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(message);
          } catch (err) {
            console.error(`[memoryBus] error in handler for ${target}:`, err);
          }
        }
      }
    }

    console.log(
      `[memoryBus] published ${message.type} from ${message.from} to [${targets.join(", ")}]`
    );
  }

  /**
   * Get all messages in the log
   */
  getLog(): AgentMessage[] {
    return [...this.messageLog];
  }

  /**
   * Clear the message log
   */
  clearLog(): void {
    this.messageLog = [];
  }

  /**
   * Get messages filtered by type
   */
  getMessagesByType(type: AgentMessage["type"]): AgentMessage[] {
    return this.messageLog.filter((msg) => msg.type === type);
  }

  /**
   * Get messages filtered by sender
   */
  getMessagesFrom(agentId: string): AgentMessage[] {
    return this.messageLog.filter((msg) => msg.from === agentId);
  }
}

// Singleton instance
let busInstance: MemoryBus | null = null;

export function getMemoryBus(): MemoryBus {
  if (!busInstance) {
    busInstance = new MemoryBus();
  }
  return busInstance;
}

export function resetMemoryBus(): void {
  busInstance = null;
}
