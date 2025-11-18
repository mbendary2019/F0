/**
 * Tests for Feature Extractor (Phase 61 Day 3)
 *
 * Tests for extracting base and advanced features from validation inputs.
 */

import {
  extractBaseFeatures,
  extractAdvancedFeatures,
  extractAllFeatures,
} from "../src/orchestrator/rag/features/extractor";

describe("Feature Extractor", () => {
  describe("extractBaseFeatures", () => {
    it("should extract citation count normalized to 0-1", () => {
      const features = extractBaseFeatures({
        text: "Sample text",
        goal: "test",
        citations: [
          { docId: "1", score: 0.9 },
          { docId: "2", score: 0.8 },
          { docId: "3", score: 0.7 },
        ],
      });

      // 3 citations / 6 max = 0.5
      expect(features.citation_count).toBe(0.5);
    });

    it("should extract citation average score", () => {
      const features = extractBaseFeatures({
        text: "Sample text",
        goal: "test",
        citations: [
          { docId: "1", score: 0.9 },
          { docId: "2", score: 0.6 },
        ],
      });

      // Average: (0.9 + 0.6) / 2 = 0.75
      expect(features.citation_avg_score).toBe(0.75);
    });

    it("should extract text length normalized", () => {
      const features = extractBaseFeatures({
        text: "a".repeat(2000),
        goal: "test",
      });

      // 2000 / 4000 = 0.5
      expect(features.text_len).toBe(0.5);
    });

    it("should cap text length at 1.0", () => {
      const features = extractBaseFeatures({
        text: "a".repeat(5000),
        goal: "test",
      });

      expect(features.text_len).toBe(1.0);
    });

    it("should extract hint hit rate", () => {
      const features = extractBaseFeatures({
        text: "This text contains important keywords",
        goal: "test",
        hints: ["important", "keywords", "missing"],
      });

      // 2 matched / 3 total = 0.667
      expect(features.hint_hit_rate).toBeCloseTo(0.667, 2);
    });

    it("should handle no hints", () => {
      const features = extractBaseFeatures({
        text: "Sample text",
        goal: "test",
        hints: [],
      });

      expect(features.hint_hit_rate).toBe(0.5);
    });

    it("should extract unique terms overlap", () => {
      const features = extractBaseFeatures({
        text: "machine learning is a subset of artificial intelligence",
        goal: "machine learning artificial",
      });

      // Unique terms: machine, learning, artificial
      // All 3 present in text
      expect(features.uniq_terms_overlap).toBeGreaterThan(0.8);
    });

    it("should handle empty goal", () => {
      const features = extractBaseFeatures({
        text: "Sample text",
        goal: "",
      });

      expect(features.uniq_terms_overlap).toBe(0);
    });
  });

  describe("extractAdvancedFeatures", () => {
    it("should extract vocabulary richness", () => {
      const features = extractAdvancedFeatures({
        text: "The quick brown fox jumps over the lazy dog",
        goal: "test",
      });

      // 8 unique / 9 total = 0.889
      expect(features.vocabulary_richness).toBeGreaterThan(0.8);
    });

    it("should handle repeated words in vocabulary richness", () => {
      const features = extractAdvancedFeatures({
        text: "test test test test",
        goal: "test",
      });

      // 1 unique / 4 total = 0.25
      expect(features.vocabulary_richness).toBe(0.25);
    });

    it("should extract sentence count normalized", () => {
      const features = extractAdvancedFeatures({
        text: "Sentence one. Sentence two. Sentence three.",
        goal: "test",
      });

      // 3 sentences / 10 max = 0.3
      expect(features.sentence_count).toBe(0.3);
    });

    it("should cap sentence count at 1.0", () => {
      const text = Array(15)
        .fill("Sentence.")
        .join(" ");
      const features = extractAdvancedFeatures({
        text,
        goal: "test",
      });

      expect(features.sentence_count).toBe(1.0);
    });

    it("should extract average sentence length", () => {
      const features = extractAdvancedFeatures({
        text: "Short. Medium sentence here. Very long sentence with many words.",
        goal: "test",
      });

      // Average should be normalized
      expect(features.avg_sentence_length).toBeGreaterThan(0);
      expect(features.avg_sentence_length).toBeLessThanOrEqual(1);
    });

    it("should extract citation variance", () => {
      const features = extractAdvancedFeatures({
        text: "Sample text",
        goal: "test",
        citations: [
          { docId: "1", score: 0.9 },
          { docId: "2", score: 0.5 },
          { docId: "3", score: 0.7 },
        ],
      });

      // Variance indicates quality spread
      expect(features.citation_variance).toBeGreaterThan(0);
      expect(features.citation_variance).toBeLessThanOrEqual(1);
    });

    it("should handle no citations for variance", () => {
      const features = extractAdvancedFeatures({
        text: "Sample text",
        goal: "test",
        citations: [],
      });

      expect(features.citation_variance).toBe(0);
    });

    it("should extract context depth", () => {
      const features = extractAdvancedFeatures({
        text: "Sample text",
        goal: "test",
        hints: ["hint1", "hint2", "hint3"],
        citations: [
          { docId: "1", score: 0.9 },
          { docId: "2", score: 0.8 },
        ],
      });

      // (3 hints + 2 citations) / 10 = 0.5
      expect(features.context_depth).toBe(0.5);
    });
  });

  describe("extractAllFeatures", () => {
    it("should extract all features (base + advanced)", () => {
      const features = extractAllFeatures({
        text: "Machine learning is transforming artificial intelligence. Deep learning models excel.",
        goal: "machine learning AI",
        hints: ["machine learning", "deep learning"],
        citations: [
          { docId: "1", score: 0.9, source: "kb" },
          { docId: "2", score: 0.8, source: "cluster" },
        ],
      });

      // Should have all 10 features
      expect(Object.keys(features)).toHaveLength(10);

      // Base features
      expect(features).toHaveProperty("citation_count");
      expect(features).toHaveProperty("citation_avg_score");
      expect(features).toHaveProperty("text_len");
      expect(features).toHaveProperty("hint_hit_rate");
      expect(features).toHaveProperty("uniq_terms_overlap");

      // Advanced features
      expect(features).toHaveProperty("vocabulary_richness");
      expect(features).toHaveProperty("sentence_count");
      expect(features).toHaveProperty("avg_sentence_length");
      expect(features).toHaveProperty("citation_variance");
      expect(features).toHaveProperty("context_depth");

      // All features should be normalized 0-1
      Object.values(features).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });

    it("should handle minimal input", () => {
      const features = extractAllFeatures({
        text: "",
        goal: "",
      });

      // Should still return all features with default values
      expect(Object.keys(features)).toHaveLength(10);

      // Most features should be 0 or low
      expect(features.citation_count).toBe(0);
      expect(features.text_len).toBe(0);
      expect(features.uniq_terms_overlap).toBe(0);
    });

    it("should handle rich input", () => {
      const features = extractAllFeatures({
        text: "a".repeat(5000) + ". Multiple sentences here. And more.",
        goal: "multiple sentences",
        hints: ["multiple", "sentences", "more"],
        citations: [
          { docId: "1", score: 1.0 },
          { docId: "2", score: 0.9 },
          { docId: "3", score: 0.8 },
          { docId: "4", score: 0.7 },
          { docId: "5", score: 0.6 },
          { docId: "6", score: 0.5 },
        ],
      });

      // Should cap at max values
      expect(features.citation_count).toBe(1.0);
      expect(features.text_len).toBe(1.0);
    });
  });

  describe("Feature Normalization", () => {
    it("all features should be in 0-1 range", () => {
      const testCases = [
        {
          text: "Short",
          goal: "test",
        },
        {
          text: "a".repeat(10000),
          goal: "very long query with many words",
          hints: ["hint1", "hint2", "hint3"],
          citations: Array(20)
            .fill(null)
            .map((_, i) => ({ docId: `${i}`, score: Math.random() })),
        },
        {
          text: "",
          goal: "",
          hints: [],
          citations: [],
        },
      ];

      testCases.forEach((testCase, index) => {
        const features = extractAllFeatures(testCase);

        Object.entries(features).forEach(([key, value]) => {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
          if (isNaN(value)) {
            throw new Error(`Feature ${key} is NaN in test case ${index}`);
          }
        });
      });
    });
  });
});
