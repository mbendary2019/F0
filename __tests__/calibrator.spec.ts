/**
 * Tests for Model Calibrator
 */

import { calibrateModel, evaluateModel, findOptimalThreshold } from "@/orchestrator/rag/calibrator";
import type { Weights, Thresholds } from "@/orchestrator/rag/scorerModel";
import type { Sample } from "@/orchestrator/rag/online_learning";

// Mock online_learning module
jest.mock("@/orchestrator/rag/online_learning", () => ({
  fetchLabeledSamples: jest.fn().mockResolvedValue([]),
}));

describe("calibrateModel", () => {
  const baseWeights: Weights = {
    citation: 0.35,
    context: 0.25,
    source: 0.2,
    relevance: 0.2,
  };

  const baseThresholds: Thresholds = {
    default: 0.55,
    critic: 0.6,
    majority: 0.5,
  };

  it("returns weights and thresholds even with no samples", async () => {
    const result = await calibrateModel(
      { weights: baseWeights, thresholds: baseThresholds },
      { epochs: 1, minSamples: 0 }
    );

    expect(result.weights).toBeDefined();
    expect(result.thresholds).toBeDefined();
    expect(typeof result.metrics.acc).toBe("number");
    expect(result.metrics.samples).toBe(0);
  });

  it("preserves base model when insufficient samples", async () => {
    const result = await calibrateModel(
      { weights: baseWeights, thresholds: baseThresholds },
      { epochs: 1, minSamples: 100 } // Requires 100 samples, but mock returns 0
    );

    expect(result.weights).toEqual(baseWeights);
    expect(result.thresholds).toEqual(baseThresholds);
  });

  it("returns valid metrics structure", async () => {
    const result = await calibrateModel(
      { weights: baseWeights, thresholds: baseThresholds },
      { epochs: 1 }
    );

    expect(result.metrics).toHaveProperty("acc");
    expect(result.metrics).toHaveProperty("samples");
    expect(typeof result.metrics.acc).toBe("number");
    expect(typeof result.metrics.samples).toBe("number");
  });

  it("returns weights in valid range [0, 1]", async () => {
    const result = await calibrateModel(
      { weights: baseWeights, thresholds: baseThresholds },
      { epochs: 2 }
    );

    expect(result.weights.citation).toBeGreaterThanOrEqual(0);
    expect(result.weights.citation).toBeLessThanOrEqual(1);
    expect(result.weights.context).toBeGreaterThanOrEqual(0);
    expect(result.weights.context).toBeLessThanOrEqual(1);
    expect(result.weights.source).toBeGreaterThanOrEqual(0);
    expect(result.weights.source).toBeLessThanOrEqual(1);
    expect(result.weights.relevance).toBeGreaterThanOrEqual(0);
    expect(result.weights.relevance).toBeLessThanOrEqual(1);
  });

  it("returns thresholds in valid range [0, 1]", async () => {
    const result = await calibrateModel(
      { weights: baseWeights, thresholds: baseThresholds },
      { epochs: 1 }
    );

    expect(result.thresholds.default).toBeGreaterThan(0);
    expect(result.thresholds.default).toBeLessThan(1);

    if (result.thresholds.critic) {
      expect(result.thresholds.critic).toBeGreaterThan(0);
      expect(result.thresholds.critic).toBeLessThan(1);
    }

    if (result.thresholds.majority) {
      expect(result.thresholds.majority).toBeGreaterThan(0);
      expect(result.thresholds.majority).toBeLessThan(1);
    }
  });
});

describe("evaluateModel", () => {
  const weights: Weights = {
    citation: 0.35,
    context: 0.25,
    source: 0.2,
    relevance: 0.2,
  };

  const threshold = 0.55;

  it("returns zero metrics for empty samples", () => {
    const samples: Sample[] = [];
    const metrics = evaluateModel(weights, threshold, samples);

    expect(metrics.accuracy).toBe(0);
    expect(metrics.precision).toBe(0);
    expect(metrics.recall).toBe(0);
    expect(metrics.f1Score).toBe(0);
  });

  it("calculates perfect accuracy for perfect predictions", () => {
    const samples: Sample[] = [
      {
        subscores: { citation: 1, context: 1, source: 1, relevance: 1 },
        pass: true,
      },
      {
        subscores: { citation: 0, context: 0, source: 0, relevance: 0 },
        pass: false,
      },
    ];

    const metrics = evaluateModel(weights, 0.5, samples);

    expect(metrics.accuracy).toBe(1);
  });

  it("returns metrics in valid range [0, 1]", () => {
    const samples: Sample[] = [
      {
        subscores: { citation: 0.8, context: 0.7, source: 0.6, relevance: 0.5 },
        pass: true,
      },
      {
        subscores: { citation: 0.3, context: 0.2, source: 0.1, relevance: 0.1 },
        pass: false,
      },
      {
        subscores: { citation: 0.5, context: 0.5, source: 0.5, relevance: 0.5 },
        pass: true,
      },
    ];

    const metrics = evaluateModel(weights, threshold, samples);

    expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
    expect(metrics.accuracy).toBeLessThanOrEqual(1);
    expect(metrics.precision).toBeGreaterThanOrEqual(0);
    expect(metrics.precision).toBeLessThanOrEqual(1);
    expect(metrics.recall).toBeGreaterThanOrEqual(0);
    expect(metrics.recall).toBeLessThanOrEqual(1);
    expect(metrics.f1Score).toBeGreaterThanOrEqual(0);
    expect(metrics.f1Score).toBeLessThanOrEqual(1);
  });

  it("calculates f1Score as harmonic mean", () => {
    const samples: Sample[] = [
      {
        subscores: { citation: 0.9, context: 0.9, source: 0.9, relevance: 0.9 },
        pass: true,
      },
      {
        subscores: { citation: 0.2, context: 0.2, source: 0.2, relevance: 0.2 },
        pass: false,
      },
    ];

    const metrics = evaluateModel(weights, 0.5, samples);

    // F1 should be between precision and recall (harmonic mean)
    const expected =
      (2 * metrics.precision * metrics.recall) / (metrics.precision + metrics.recall);

    expect(metrics.f1Score).toBeCloseTo(expected, 2);
  });
});

describe("findOptimalThreshold", () => {
  const weights: Weights = {
    citation: 0.35,
    context: 0.25,
    source: 0.2,
    relevance: 0.2,
  };

  const samples: Sample[] = [
    {
      subscores: { citation: 0.9, context: 0.8, source: 0.7, relevance: 0.8 },
      pass: true,
    },
    {
      subscores: { citation: 0.1, context: 0.2, source: 0.1, relevance: 0.1 },
      pass: false,
    },
    {
      subscores: { citation: 0.6, context: 0.5, source: 0.4, relevance: 0.5 },
      pass: true,
    },
    {
      subscores: { citation: 0.3, context: 0.3, source: 0.2, relevance: 0.2 },
      pass: false,
    },
  ];

  it("returns threshold in valid range", () => {
    const threshold = findOptimalThreshold(samples, weights, "accuracy", 0.75);

    expect(threshold).toBeGreaterThan(0);
    expect(threshold).toBeLessThan(1);
  });

  it("finds optimal threshold for accuracy", () => {
    const threshold = findOptimalThreshold(samples, weights, "accuracy");

    expect(typeof threshold).toBe("number");
    expect(threshold).toBeGreaterThanOrEqual(0.3);
    expect(threshold).toBeLessThanOrEqual(0.8);
  });

  it("finds optimal threshold for precision", () => {
    const threshold = findOptimalThreshold(samples, weights, "precision");

    expect(typeof threshold).toBe("number");
  });

  it("finds optimal threshold for recall", () => {
    const threshold = findOptimalThreshold(samples, weights, "recall");

    expect(typeof threshold).toBe("number");
  });

  it("finds optimal threshold for f1", () => {
    const threshold = findOptimalThreshold(samples, weights, "f1");

    expect(typeof threshold).toBe("number");
  });

  it("returns reasonable threshold for empty samples", () => {
    const threshold = findOptimalThreshold([], weights, "accuracy");

    // Should return some default threshold even with no samples
    expect(threshold).toBeGreaterThan(0);
    expect(threshold).toBeLessThan(1);
  });
});
