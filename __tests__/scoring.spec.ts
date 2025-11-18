/**
 * Tests for Knowledge Validation Scoring Engine
 */

import { scoreValidation, isValidationPassing, getValidationFeedback } from "@/orchestrator/rag/scoring";
import type { Citation } from "@/lib/types/context";

describe("scoreValidation", () => {
  it("returns final score and 4 subscores", () => {
    const result = scoreValidation({
      text: "from zero mesh rag implementation",
      query: "mesh rag",
      citations: [{ docId: "1", score: 0.9 }] as Citation[],
    });

    expect(typeof result.final).toBe("number");
    expect(result.final).toBeGreaterThanOrEqual(0);
    expect(result.final).toBeLessThanOrEqual(1);

    expect(Object.keys(result.subscores)).toEqual([
      "citation",
      "context",
      "source",
      "relevance",
    ]);
  });

  it("scores higher with more citations", () => {
    const withOne = scoreValidation({
      text: "test",
      query: "test",
      citations: [{ docId: "1", score: 0.9 }] as Citation[],
    });

    const withThree = scoreValidation({
      text: "test",
      query: "test",
      citations: [
        { docId: "1", score: 0.9 },
        { docId: "2", score: 0.8 },
        { docId: "3", score: 0.7 },
      ] as Citation[],
    });

    expect(withThree.subscores.citation).toBeGreaterThan(withOne.subscores.citation);
  });

  it("scores context alignment correctly", () => {
    const withHints = scoreValidation({
      text: "React hooks implementation",
      query: "test",
      citations: [],
      contextHints: ["React", "hooks"],
    });

    expect(withHints.subscores.context).toBeGreaterThan(0.5);
  });

  it("scores zero citations as low", () => {
    const result = scoreValidation({
      text: "some text",
      query: "query",
      citations: [],
    });

    expect(result.subscores.citation).toBe(0);
  });

  it("scores relevance based on term overlap", () => {
    const result = scoreValidation({
      text: "This is about mesh rag implementation and validation",
      query: "mesh rag validation",
      citations: [],
    });

    expect(result.subscores.relevance).toBeGreaterThan(0.5);
  });

  it("returns scores between 0 and 1", () => {
    const result = scoreValidation({
      text: "test content with multiple words and phrases",
      query: "test query",
      citations: [{ docId: "1", score: 0.9 }] as Citation[],
      contextHints: ["test", "content"],
    });

    expect(result.final).toBeGreaterThanOrEqual(0);
    expect(result.final).toBeLessThanOrEqual(1);
    expect(result.subscores.citation).toBeGreaterThanOrEqual(0);
    expect(result.subscores.citation).toBeLessThanOrEqual(1);
    expect(result.subscores.context).toBeGreaterThanOrEqual(0);
    expect(result.subscores.context).toBeLessThanOrEqual(1);
    expect(result.subscores.source).toBeGreaterThanOrEqual(0);
    expect(result.subscores.source).toBeLessThanOrEqual(1);
    expect(result.subscores.relevance).toBeGreaterThanOrEqual(0);
    expect(result.subscores.relevance).toBeLessThanOrEqual(1);
  });
});

describe("isValidationPassing", () => {
  it("returns true for scores above threshold", () => {
    const score = {
      final: 0.65,
      subscores: { citation: 0.6, context: 0.6, source: 0.6, relevance: 0.6 },
    };

    expect(isValidationPassing(score, 0.55)).toBe(true);
  });

  it("returns false for scores below threshold", () => {
    const score = {
      final: 0.45,
      subscores: { citation: 0.4, context: 0.4, source: 0.4, relevance: 0.4 },
    };

    expect(isValidationPassing(score, 0.55)).toBe(false);
  });

  it("uses default threshold of 0.55", () => {
    const passing = {
      final: 0.6,
      subscores: { citation: 0.6, context: 0.6, source: 0.6, relevance: 0.6 },
    };

    const failing = {
      final: 0.5,
      subscores: { citation: 0.5, context: 0.5, source: 0.5, relevance: 0.5 },
    };

    expect(isValidationPassing(passing)).toBe(true);
    expect(isValidationPassing(failing)).toBe(false);
  });
});

describe("getValidationFeedback", () => {
  it("returns success message for passing scores", () => {
    const score = {
      final: 0.7,
      subscores: { citation: 0.6, context: 0.7, source: 0.8, relevance: 0.7 },
    };

    const feedback = getValidationFeedback(score);
    expect(feedback).toContain("passed");
  });

  it("identifies insufficient citations", () => {
    const score = {
      final: 0.4,
      subscores: { citation: 0.2, context: 0.5, source: 0.5, relevance: 0.5 },
    };

    const feedback = getValidationFeedback(score);
    expect(feedback).toContain("insufficient citations");
  });

  it("identifies multiple issues", () => {
    const score = {
      final: 0.3,
      subscores: { citation: 0.2, context: 0.3, source: 0.3, relevance: 0.2 },
    };

    const feedback = getValidationFeedback(score);
    expect(feedback).toContain("insufficient citations");
    expect(feedback).toContain("poor context alignment");
    expect(feedback).toContain("low source quality");
    expect(feedback).toContain("weak relevance");
  });
});
