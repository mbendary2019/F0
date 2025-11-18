/**
 * Tests for Validator Agent
 */

import { ValidatorAgent } from "@/orchestrator/agents/roles/validatorAgent";
import type { AgentMessage } from "@/lib/types/agent";
import type { ContextHandle } from "@/lib/types/context";

// Mock telemetry to avoid Firebase calls in tests
jest.mock("@/lib/telemetry/log", () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

describe("ValidatorAgent", () => {
  let validator: ValidatorAgent;
  let mockContext: ContextHandle;

  beforeEach(() => {
    validator = new ValidatorAgent();
    mockContext = {
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
  });

  it("creates validator with correct role", () => {
    expect(validator.id).toBe("validator");
    expect(validator.role).toBe("critic");
  });

  it("returns CRITIQUE for low quality outputs", async () => {
    const lowQualityMessage: AgentMessage = {
      type: "HYPOTHESIS",
      content: "short answer",
      from: "synthesizer",
      evidence: [], // No citations
    };

    const result = await validator.handle(lowQualityMessage, mockContext);

    expect(result.type).toBe("CRITIQUE");
    expect(result.content).toContain("Validation failed");
    expect(result.to).toContain("researcher");
  });

  it("returns FINAL for high quality outputs", async () => {
    const highQualityMessage: AgentMessage = {
      type: "HYPOTHESIS",
      content: "This is a comprehensive answer about the test goal with multiple relevant terms and proper explanation",
      from: "synthesizer",
      evidence: [
        { docId: "1", score: 0.9, snippet: "snippet 1" },
        { docId: "2", score: 0.8, snippet: "snippet 2" },
        { docId: "3", score: 0.7, snippet: "snippet 3" },
      ],
    };

    mockContext.goal = "test comprehensive explanation";

    const result = await validator.handle(highQualityMessage, mockContext);

    expect(result.type).toBe("FINAL");
    expect(result.content).toBe(highQualityMessage.content);
    expect(result.evidence).toEqual(highQualityMessage.evidence);
  });

  it("considers context hints in validation", async () => {
    const message: AgentMessage = {
      type: "HYPOTHESIS",
      content: "Using React hooks for state management is the best approach",
      from: "synthesizer",
      evidence: [
        { docId: "1", score: 0.9 },
        { docId: "2", score: 0.8 },
      ],
    };

    mockContext.goal = "React state management";
    mockContext.hints = ["React", "hooks", "state"];

    const result = await validator.handle(message, mockContext);

    // Should pass because content mentions all hints
    expect(result.type).toBe("FINAL");
  });

  it("validates empty content as failing", async () => {
    const emptyMessage: AgentMessage = {
      type: "HYPOTHESIS",
      content: "",
      from: "synthesizer",
      evidence: [],
    };

    const result = await validator.handle(emptyMessage, mockContext);

    expect(result.type).toBe("CRITIQUE");
  });

  it("preserves evidence in FINAL response", async () => {
    const evidence = [
      { docId: "1", score: 0.95, snippet: "test snippet", url: "file.ts:10" },
      { docId: "2", score: 0.85, snippet: "another snippet", url: "other.ts:20" },
    ];

    const message: AgentMessage = {
      type: "HYPOTHESIS",
      content: "Detailed explanation with good test goal coverage and multiple relevant terms",
      from: "synthesizer",
      evidence,
    };

    mockContext.goal = "test detailed explanation";

    const result = await validator.handle(message, mockContext);

    expect(result.type).toBe("FINAL");
    expect(result.evidence).toEqual(evidence);
  });

  it("provides actionable feedback in CRITIQUE", async () => {
    const poorMessage: AgentMessage = {
      type: "HYPOTHESIS",
      content: "x",
      from: "synthesizer",
      evidence: [],
    };

    const result = await validator.handle(poorMessage, mockContext);

    expect(result.type).toBe("CRITIQUE");
    expect(result.content).toContain("strengthen citations");
    expect(result.content).toContain("improve alignment");
  });

  it("handles FINAL input type", async () => {
    const finalMessage: AgentMessage = {
      type: "FINAL",
      content: "Good comprehensive final answer about test goal with proper detail",
      from: "critic",
      evidence: [
        { docId: "1", score: 0.9 },
        { docId: "2", score: 0.8 },
        { docId: "3", score: 0.7 },
      ],
    };

    mockContext.goal = "test comprehensive detail";

    const result = await validator.handle(finalMessage, mockContext);

    // Validator can validate FINAL messages too
    expect(["FINAL", "CRITIQUE"]).toContain(result.type);
  });
});
