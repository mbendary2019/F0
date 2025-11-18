/**
 * Tests for Scorer Model
 */

import {
  scoreWithWeights,
  getThreshold,
  getDefaultWeights,
  getDefaultThresholds,
  type Weights,
  type Thresholds,
} from "@/orchestrator/rag/scorerModel";

describe("scoreWithWeights", () => {
  it("calculates weighted score correctly", () => {
    const subscores = {
      citation: 0.5,
      context: 0.5,
      source: 0.5,
      relevance: 0.5,
    };

    const weights: Weights = {
      citation: 0.35,
      context: 0.25,
      source: 0.2,
      relevance: 0.2,
    };

    const score = scoreWithWeights(subscores, weights);

    // Expected: 0.5 * (0.35 + 0.25 + 0.2 + 0.2) = 0.5 * 1.0 = 0.5
    expect(score).toBeCloseTo(0.5, 2);
  });

  it("handles zero subscores", () => {
    const subscores = {
      citation: 0,
      context: 0,
      source: 0,
      relevance: 0,
    };

    const weights = getDefaultWeights();
    const score = scoreWithWeights(subscores, weights);

    expect(score).toBe(0);
  });

  it("handles perfect subscores", () => {
    const subscores = {
      citation: 1,
      context: 1,
      source: 1,
      relevance: 1,
    };

    const weights: Weights = {
      citation: 0.25,
      context: 0.25,
      source: 0.25,
      relevance: 0.25,
    };

    const score = scoreWithWeights(subscores, weights);

    expect(score).toBe(1);
  });

  it("clamps scores to [0, 1] range", () => {
    const subscores = {
      citation: 2, // Out of range
      context: 2,
      source: 2,
      relevance: 2,
    };

    const weights: Weights = {
      citation: 0.5,
      context: 0.5,
      source: 0.5,
      relevance: 0.5,
    };

    const score = scoreWithWeights(subscores, weights);

    expect(score).toBeLessThanOrEqual(1);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("respects weight proportions", () => {
    const subscores = {
      citation: 1,
      context: 0,
      source: 0,
      relevance: 0,
    };

    const weights: Weights = {
      citation: 0.8,
      context: 0.1,
      source: 0.05,
      relevance: 0.05,
    };

    const score = scoreWithWeights(subscores, weights);

    // Only citation counts, weighted at 0.8
    expect(score).toBeCloseTo(0.8, 2);
  });
});

describe("getThreshold", () => {
  const thresholds: Thresholds = {
    default: 0.55,
    critic: 0.6,
    majority: 0.5,
  };

  it("returns default threshold for unknown strategy", () => {
    expect(getThreshold(thresholds, "unknown")).toBe(0.55);
  });

  it("returns critic threshold for critic strategy", () => {
    expect(getThreshold(thresholds, "critic")).toBe(0.6);
  });

  it("returns majority threshold for majority strategy", () => {
    expect(getThreshold(thresholds, "majority")).toBe(0.5);
  });

  it("returns default threshold when strategy threshold undefined", () => {
    const partialThresholds: Thresholds = {
      default: 0.55,
    };

    expect(getThreshold(partialThresholds, "critic")).toBe(0.55);
    expect(getThreshold(partialThresholds, "majority")).toBe(0.55);
  });

  it("handles empty strategy string", () => {
    expect(getThreshold(thresholds, "")).toBe(0.55);
  });
});

describe("getDefaultWeights", () => {
  it("returns valid weight object", () => {
    const weights = getDefaultWeights();

    expect(weights).toHaveProperty("citation");
    expect(weights).toHaveProperty("context");
    expect(weights).toHaveProperty("source");
    expect(weights).toHaveProperty("relevance");
  });

  it("weights sum to 1.0", () => {
    const weights = getDefaultWeights();
    const sum =
      weights.citation + weights.context + weights.source + weights.relevance;

    expect(sum).toBeCloseTo(1.0, 2);
  });

  it("all weights are positive", () => {
    const weights = getDefaultWeights();

    expect(weights.citation).toBeGreaterThan(0);
    expect(weights.context).toBeGreaterThan(0);
    expect(weights.source).toBeGreaterThan(0);
    expect(weights.relevance).toBeGreaterThan(0);
  });

  it("returns a copy not reference", () => {
    const weights1 = getDefaultWeights();
    const weights2 = getDefaultWeights();

    weights1.citation = 0.99;

    expect(weights2.citation).not.toBe(0.99);
  });
});

describe("getDefaultThresholds", () => {
  it("returns valid threshold object", () => {
    const thresholds = getDefaultThresholds();

    expect(thresholds).toHaveProperty("default");
    expect(typeof thresholds.default).toBe("number");
  });

  it("default threshold is in valid range", () => {
    const thresholds = getDefaultThresholds();

    expect(thresholds.default).toBeGreaterThan(0);
    expect(thresholds.default).toBeLessThan(1);
  });

  it("includes strategy-specific thresholds", () => {
    const thresholds = getDefaultThresholds();

    expect(thresholds.critic).toBeDefined();
    expect(thresholds.majority).toBeDefined();
  });

  it("critic threshold is stricter than default", () => {
    const thresholds = getDefaultThresholds();

    if (thresholds.critic) {
      expect(thresholds.critic).toBeGreaterThan(thresholds.default);
    }
  });

  it("majority threshold is more lenient than default", () => {
    const thresholds = getDefaultThresholds();

    if (thresholds.majority) {
      expect(thresholds.majority).toBeLessThan(thresholds.default);
    }
  });
});
