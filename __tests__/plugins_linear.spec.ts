/**
 * Tests for Scorer Plugins (Phase 61 Day 3)
 *
 * Tests for the plugin system, linear scorer, and registry.
 */

import { LinearScorer, createLinearScorer, getDefaultLinearScorer } from "../src/orchestrator/rag/scorerPlugins/linear";
import {
  getScorer,
  setScorer,
  registerScorer,
  switchScorer,
  listScorers,
  getScorerMetadata,
  resetToDefault,
} from "../src/orchestrator/rag/scorerPlugins/registry";
import type { FeatureVector } from "../src/orchestrator/rag/scorerPlugins/base";

describe("Scorer Plugins", () => {
  describe("LinearScorer", () => {
    it("should score using weighted features", () => {
      const scorer = new LinearScorer({
        citation_count: 0.2,
        citation_avg_score: 0.3,
        text_len: 0.1,
        hint_hit_rate: 0.2,
        uniq_terms_overlap: 0.2,
      });

      const features: FeatureVector = {
        citation_count: 1.0,
        citation_avg_score: 0.8,
        text_len: 0.5,
        hint_hit_rate: 0.9,
        uniq_terms_overlap: 0.7,
      };

      const score = scorer.score(features);

      // Expected: 0.2*1.0 + 0.3*0.8 + 0.1*0.5 + 0.2*0.9 + 0.2*0.7
      //         = 0.2 + 0.24 + 0.05 + 0.18 + 0.14 = 0.81
      expect(score).toBeCloseTo(0.81, 2);
    });

    it("should clamp score to 0-1 range", () => {
      const scorer = new LinearScorer({
        citation_count: 2.0, // Intentionally high
      });

      const features: FeatureVector = {
        citation_count: 1.0,
      };

      const score = scorer.score(features);

      // Should clamp to 1.0
      expect(score).toBe(1.0);
    });

    it("should handle missing features as 0", () => {
      const scorer = new LinearScorer({
        citation_count: 0.5,
        text_len: 0.5,
      });

      const features: FeatureVector = {
        citation_count: 1.0,
        // text_len missing
      };

      const score = scorer.score(features);

      // Expected: 0.5*1.0 + 0.5*0 = 0.5
      expect(score).toBe(0.5);
    });

    it("should provide feature importance", () => {
      const scorer = new LinearScorer({
        citation_count: 0.15,
        citation_avg_score: 0.20,
        text_len: 0.10,
        hint_hit_rate: 0.25,
        uniq_terms_overlap: 0.30,
      });

      const importance = scorer.getFeatureImportance();

      // Should sum to 1.0 (normalized)
      const sum = Object.values(importance).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 2);

      // uniq_terms_overlap should have highest importance
      expect(importance.uniq_terms_overlap).toBeGreaterThan(
        importance.citation_count
      );
    });

    it("should calculate confidence based on feature completeness", () => {
      const scorer = new LinearScorer({
        citation_count: 0.2,
        citation_avg_score: 0.2,
        text_len: 0.2,
        hint_hit_rate: 0.2,
        uniq_terms_overlap: 0.2,
      });

      // All 5 features provided
      const fullFeatures: FeatureVector = {
        citation_count: 1.0,
        citation_avg_score: 0.8,
        text_len: 0.5,
        hint_hit_rate: 0.9,
        uniq_terms_overlap: 0.7,
      };

      const fullResult = scorer.getConfidence(fullFeatures);

      // 5/5 features = 1.0 confidence
      expect(fullResult.confidence).toBe(1.0);

      // Partial features
      const partialFeatures: FeatureVector = {
        citation_count: 1.0,
        text_len: 0.5,
      };

      const partialResult = scorer.getConfidence(partialFeatures);

      // 2/5 features = 0.4 confidence
      expect(partialResult.confidence).toBeCloseTo(0.4, 1);
    });

    it("should provide confidence intervals", () => {
      const scorer = new LinearScorer({
        citation_count: 0.5,
        text_len: 0.5,
      });

      const features: FeatureVector = {
        citation_count: 0.8,
        text_len: 0.6,
      };

      const result = scorer.getConfidence(features);

      // Should have score, confidence, lower, upper
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("lower");
      expect(result).toHaveProperty("upper");

      // Lower <= score <= upper
      expect(result.lower).toBeLessThanOrEqual(result.score);
      expect(result.score).toBeLessThanOrEqual(result.upper);

      // All in 0-1 range
      expect(result.lower).toBeGreaterThanOrEqual(0);
      expect(result.upper).toBeLessThanOrEqual(1);
    });

    it("should update weights for online learning", () => {
      const scorer = new LinearScorer({
        citation_count: 0.2,
        text_len: 0.8,
      });

      const features: FeatureVector = {
        citation_count: 1.0,
        text_len: 1.0,
      };

      const scoreBefore = scorer.score(features);

      // Update weights
      scorer.updateWeights({
        citation_count: 0.5,
        text_len: 0.5,
      });

      const scoreAfter = scorer.score(features);

      // Score should change
      expect(scoreAfter).not.toBe(scoreBefore);
    });

    it("should return metadata", () => {
      const scorer = new LinearScorer();
      const metadata = scorer.getMetadata();

      expect(metadata.name).toBe("linear");
      expect(metadata.version).toBe("1.0");
      expect(metadata.description).toContain("Linear scorer");
      expect(Array.isArray(metadata.featureNames)).toBe(true);
    });
  });

  describe("Scorer Factory Functions", () => {
    it("createLinearScorer should merge custom weights", () => {
      const scorer = createLinearScorer({
        citation_count: 0.9,
      });

      const weights = scorer.getWeights();

      // Custom weight should be applied
      expect(weights.citation_count).toBe(0.9);

      // Default weights should still be present for other features
      expect(weights).toHaveProperty("citation_avg_score");
      expect(weights).toHaveProperty("text_len");
    });

    it("getDefaultLinearScorer should use default weights", () => {
      const scorer = getDefaultLinearScorer();
      const weights = scorer.getWeights();

      // Should have default weights
      expect(weights.citation_count).toBe(0.15);
      expect(weights.citation_avg_score).toBe(0.20);
      expect(weights.text_len).toBe(0.10);
      expect(weights.hint_hit_rate).toBe(0.25);
      expect(weights.uniq_terms_overlap).toBe(0.30);
    });
  });

  describe("Scorer Registry", () => {
    beforeEach(() => {
      // Reset to default before each test
      resetToDefault();
    });

    it("should get default scorer", () => {
      const scorer = getScorer();
      expect(scorer.name).toBe("linear");
    });

    it("should set scorer", () => {
      const customScorer = new LinearScorer({
        citation_count: 1.0,
      });

      setScorer(customScorer);
      const scorer = getScorer();

      const weights = (scorer as LinearScorer).getWeights();
      expect(weights.citation_count).toBe(1.0);
    });

    it("should register new scorer", () => {
      const customScorer = new LinearScorer({
        citation_count: 0.9,
      });

      registerScorer("custom", customScorer);

      const scorers = listScorers();
      expect(scorers).toContain("custom");
    });

    it("should switch between scorers", () => {
      const scorer1 = new LinearScorer({ citation_count: 0.3 });
      const scorer2 = new LinearScorer({ citation_count: 0.7 });

      registerScorer("scorer1", scorer1);
      registerScorer("scorer2", scorer2);

      // Switch to scorer1
      const switched1 = switchScorer("scorer1");
      expect(switched1).toBe(true);

      let current = getScorer() as LinearScorer;
      expect(current.getWeights().citation_count).toBe(0.3);

      // Switch to scorer2
      const switched2 = switchScorer("scorer2");
      expect(switched2).toBe(true);

      current = getScorer() as LinearScorer;
      expect(current.getWeights().citation_count).toBe(0.7);
    });

    it("should return false when switching to non-existent scorer", () => {
      const result = switchScorer("nonexistent");
      expect(result).toBe(false);

      // Should keep current scorer
      const scorer = getScorer();
      expect(scorer.name).toBe("linear");
    });

    it("should list all registered scorers", () => {
      registerScorer("test1", new LinearScorer());
      registerScorer("test2", new LinearScorer());

      const scorers = listScorers();

      expect(scorers).toContain("linear"); // Default
      expect(scorers).toContain("test1");
      expect(scorers).toContain("test2");
    });

    it("should get scorer metadata for all registered scorers", () => {
      registerScorer("custom", new LinearScorer({ citation_count: 0.9 }));

      const metadata = getScorerMetadata();

      // Should have at least linear and custom
      expect(metadata.length).toBeGreaterThanOrEqual(2);

      // Each metadata should have required fields
      metadata.forEach((m) => {
        expect(m).toHaveProperty("name");
        expect(m).toHaveProperty("plugin");
        expect(m).toHaveProperty("version");
        expect(m).toHaveProperty("active");
      });

      // One should be marked as active
      const activeCount = metadata.filter((m) => m.active).length;
      expect(activeCount).toBe(1);
    });

    it("should reset to default scorer", () => {
      const customScorer = new LinearScorer({ citation_count: 0.9 });
      setScorer(customScorer);

      resetToDefault();

      const scorer = getScorer() as LinearScorer;
      const weights = scorer.getWeights();

      // Should be back to default weights
      expect(weights.citation_count).toBe(0.15);
    });
  });

  describe("Integration Tests", () => {
    it("should work end-to-end with feature extraction", () => {
      const scorer = new LinearScorer();

      const features: FeatureVector = {
        citation_count: 0.8,
        citation_avg_score: 0.9,
        text_len: 0.7,
        hint_hit_rate: 0.85,
        uniq_terms_overlap: 0.75,
      };

      const result = scorer.getConfidence(features);

      // Should produce valid score
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(1);

      // High confidence (all features provided)
      expect(result.confidence).toBe(1.0);

      // Confidence interval should be tight
      const margin = result.upper - result.lower;
      expect(margin).toBeLessThan(0.1);
    });

    it("should allow hot-swapping scorers", () => {
      // Start with conservative scorer
      const conservativeScorer = new LinearScorer({
        citation_count: 0.1,
        text_len: 0.9,
      });

      setScorer(conservativeScorer);

      const features: FeatureVector = {
        citation_count: 1.0,
        text_len: 0.5,
      };

      const score1 = getScorer().score(features);

      // Switch to aggressive scorer
      const aggressiveScorer = new LinearScorer({
        citation_count: 0.9,
        text_len: 0.1,
      });

      setScorer(aggressiveScorer);

      const score2 = getScorer().score(features);

      // Scores should be different
      expect(score2).toBeGreaterThan(score1);
    });
  });
});
