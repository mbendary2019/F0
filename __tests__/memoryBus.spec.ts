import { describe, it, expect, beforeEach } from "@jest/globals";
import { MemoryBus, getMemoryBus, resetMemoryBus } from "@/orchestrator/rag/memoryBus";
import type { AgentMessage } from "@/lib/types/agent";

describe("Memory Bus", () => {
  let bus: MemoryBus;

  beforeEach(() => {
    resetMemoryBus();
    bus = getMemoryBus();
  });

  describe("publish/subscribe", () => {
    it("should publish message to subscribers", () => {
      let received: AgentMessage | null = null;

      bus.subscribe("agent1", (msg) => {
        received = msg;
      });

      const message: AgentMessage = {
        type: "TASK",
        content: "test message",
        from: "sender",
        to: ["agent1"],
      };

      bus.publish(message);

      expect(received).toBeDefined();
      expect(received?.content).toBe("test message");
    });

    it("should support multiple subscribers", () => {
      const received: AgentMessage[] = [];

      bus.subscribe("agent1", (msg) => received.push(msg));
      bus.subscribe("agent1", (msg) => received.push(msg));

      const message: AgentMessage = {
        type: "TASK",
        content: "test",
        from: "sender",
        to: ["agent1"],
      };

      bus.publish(message);

      expect(received.length).toBe(2);
    });

    it("should unsubscribe correctly", () => {
      let received = 0;

      const unsubscribe = bus.subscribe("agent1", () => {
        received++;
      });

      const message: AgentMessage = {
        type: "TASK",
        content: "test",
        from: "sender",
        to: ["agent1"],
      };

      bus.publish(message);
      expect(received).toBe(1);

      unsubscribe();
      bus.publish(message);
      expect(received).toBe(1); // Should not increase
    });

    it("should handle multiple targets", () => {
      let agent1Received = 0;
      let agent2Received = 0;

      bus.subscribe("agent1", () => agent1Received++);
      bus.subscribe("agent2", () => agent2Received++);

      const message: AgentMessage = {
        type: "TASK",
        content: "test",
        from: "sender",
        to: ["agent1", "agent2"],
      };

      bus.publish(message);

      expect(agent1Received).toBe(1);
      expect(agent2Received).toBe(1);
    });
  });

  describe("message log", () => {
    it("should store all published messages", () => {
      const messages: AgentMessage[] = [
        { type: "TASK", content: "msg1", from: "sender", to: ["agent1"] },
        { type: "FACT", content: "msg2", from: "sender", to: ["agent2"] },
      ];

      messages.forEach((msg) => bus.publish(msg));

      const log = bus.getLog();
      expect(log.length).toBe(2);
    });

    it("should clear log", () => {
      const message: AgentMessage = {
        type: "TASK",
        content: "test",
        from: "sender",
        to: ["agent1"],
      };

      bus.publish(message);
      expect(bus.getLog().length).toBe(1);

      bus.clearLog();
      expect(bus.getLog().length).toBe(0);
    });

    it("should filter messages by type", () => {
      bus.publish({ type: "TASK", content: "task1", from: "s1", to: [] });
      bus.publish({ type: "FACT", content: "fact1", from: "s2", to: [] });
      bus.publish({ type: "TASK", content: "task2", from: "s3", to: [] });

      const tasks = bus.getMessagesByType("TASK");
      expect(tasks.length).toBe(2);
      expect(tasks.every((m) => m.type === "TASK")).toBe(true);
    });

    it("should filter messages by sender", () => {
      bus.publish({ type: "TASK", content: "msg1", from: "agent1", to: [] });
      bus.publish({ type: "FACT", content: "msg2", from: "agent2", to: [] });
      bus.publish({ type: "TASK", content: "msg3", from: "agent1", to: [] });

      const fromAgent1 = bus.getMessagesFrom("agent1");
      expect(fromAgent1.length).toBe(2);
      expect(fromAgent1.every((m) => m.from === "agent1")).toBe(true);
    });
  });

  describe("singleton pattern", () => {
    it("should return same instance", () => {
      const bus1 = getMemoryBus();
      const bus2 = getMemoryBus();

      expect(bus1).toBe(bus2);
    });

    it("should reset instance", () => {
      const bus1 = getMemoryBus();
      resetMemoryBus();
      const bus2 = getMemoryBus();

      expect(bus1).not.toBe(bus2);
    });
  });
});
