import { describe, it, expect } from "@jest/globals";
import { validateConsensus, hasConsensus } from "@/orchestrator/rag/consensus";
import type { AgentMessage } from "@/lib/types/agent";
import type { ContextHandle } from "@/lib/types/context";

describe("Consensus Validation", () => {
  const mockContext: ContextHandle = {
    userId: "test-user",
    sessionId: "test-session",
    goal: "test goal",
    hints: [],
    clusterIds: [],
    limits: {
      tokens: 4000,
      latencyMs: 30000,
    },
  };

  describe("validateConsensus", () => {
    it("should accept when majority has FINAL messages", async () => {
      const messages: AgentMessage[] = [
        { type: "TASK", content: "task", from: "planner", to: [] },
        { type: "FACT", content: "fact", from: "researcher", to: [] },
        { type: "FINAL", content: "final", from: "synthesizer", to: [] },
      ];

      const result = await validateConsensus(messages, "majority", mockContext);

      expect(result.accepted).toBe(true);
      expect(result.finalMessage).toBeDefined();
    });

    it("should reject when no FINAL messages in majority", async () => {
      const messages: AgentMessage[] = [
        { type: "TASK", content: "task", from: "planner", to: [] },
        { type: "FACT", content: "fact", from: "researcher", to: [] },
      ];

      const result = await validateConsensus(messages, "majority", mockContext);

      expect(result.accepted).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it("should accept when critic validates", async () => {
      const messages: AgentMessage[] = [
        { type: "HYPOTHESIS", content: "hyp", from: "synthesizer", to: ["critic"] },
        { type: "FINAL", content: "validated", from: "critic", to: [] },
      ];

      const result = await validateConsensus(messages, "critic", mockContext);

      expect(result.accepted).toBe(true);
      expect(result.finalMessage).toBeDefined();
    });

    it("should reject when critic critiques", async () => {
      const messages: AgentMessage[] = [
        { type: "HYPOTHESIS", content: "hyp", from: "synthesizer", to: ["critic"] },
        { type: "CRITIQUE", content: "needs more evidence", from: "critic", to: ["researcher"] },
      ];

      const result = await validateConsensus(messages, "critic", mockContext);

      expect(result.accepted).toBe(false);
      expect(result.reason).toContain("rejected");
    });

    it("should handle empty message list", async () => {
      const result = await validateConsensus([], "majority", mockContext);

      expect(result.accepted).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it("should count disagreements", async () => {
      const messages: AgentMessage[] = [
        { type: "TASK", content: "task", from: "planner", to: [] },
        { type: "FACT", content: "fact", from: "researcher", to: [] },
        { type: "CRITIQUE", content: "critique", from: "critic", to: [] },
        { type: "FINAL", content: "final", from: "synthesizer", to: [] },
      ];

      const result = await validateConsensus(messages, "majority", mockContext);

      expect(result.disagreements).toBeDefined();
      expect(result.disagreements).toBeGreaterThan(0);
    });
  });

  describe("hasConsensus", () => {
    it("should detect consensus with critic strategy", () => {
      const messages: AgentMessage[] = [
        { type: "HYPOTHESIS", content: "hyp", from: "synthesizer", to: [] },
        { type: "FINAL", content: "validated", from: "critic", to: [] },
      ];

      const result = hasConsensus(messages, "critic");
      expect(result).toBe(true);
    });

    it("should detect no consensus with critic strategy", () => {
      const messages: AgentMessage[] = [
        { type: "HYPOTHESIS", content: "hyp", from: "synthesizer", to: [] },
        { type: "FINAL", content: "final", from: "synthesizer", to: [] },
      ];

      const result = hasConsensus(messages, "critic");
      expect(result).toBe(false);
    });

    it("should detect consensus with majority strategy", () => {
      const messages: AgentMessage[] = [
        { type: "TASK", content: "task", from: "planner", to: [] },
        { type: "FINAL", content: "final", from: "synthesizer", to: [] },
      ];

      const result = hasConsensus(messages, "majority");
      expect(result).toBe(true);
    });

    it("should detect no consensus with majority strategy", () => {
      const messages: AgentMessage[] = [
        { type: "TASK", content: "task", from: "planner", to: [] },
        { type: "FACT", content: "fact", from: "researcher", to: [] },
      ];

      const result = hasConsensus(messages, "majority");
      expect(result).toBe(false);
    });

    it("should handle empty messages", () => {
      expect(hasConsensus([], "majority")).toBe(false);
      expect(hasConsensus([], "critic")).toBe(false);
    });
  });
});
