/**
 * Phase 56 Day 2 - Embedding Tools Unit Tests
 * Tests for cosine similarity and vector normalization
 */

import { cosineSim } from './embeddingTools';

// Helper: normalize vector to unit length
function normalize(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vec;
  return vec.map(v => v / magnitude);
}

describe('embeddingTools', () => {
  describe('cosineSim', () => {
    test('returns ~1 for identical vectors', () => {
      const a = normalize([1, 2, 3]);
      const b = normalize([1, 2, 3]);
      const sim = cosineSim(a, b);
      expect(sim).toBeGreaterThan(0.999);
      expect(sim).toBeLessThanOrEqual(1.0);
    });

    test('returns ~0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const sim = cosineSim(a, b);
      expect(Math.abs(sim)).toBeLessThan(0.001);
    });

    test('returns ~-1 for opposite vectors', () => {
      const a = normalize([1, 2, 3]);
      const b = normalize([-1, -2, -3]);
      const sim = cosineSim(a, b);
      expect(sim).toBeLessThan(-0.999);
      expect(sim).toBeGreaterThanOrEqual(-1.0);
    });

    test('handles zero vectors gracefully', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];
      const sim = cosineSim(a, b);
      expect(sim).toBe(0);
    });

    test('handles empty arrays', () => {
      const a: number[] = [];
      const b: number[] = [];
      const sim = cosineSim(a, b);
      expect(sim).toBe(0);
    });

    test('handles mismatched dimensions', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      const sim = cosineSim(a, b);
      expect(sim).toBe(0);
    });

    test('returns correct similarity for real-world-like vectors', () => {
      // Simulate embeddings with high dimensionality
      const a = Array.from({ length: 768 }, (_, i) => Math.sin(i * 0.1));
      const b = Array.from({ length: 768 }, (_, i) => Math.sin(i * 0.1 + 0.2));
      const sim = cosineSim(a, b);

      // Similar but not identical
      expect(sim).toBeGreaterThan(0.8);
      expect(sim).toBeLessThan(1.0);
    });

    test('is commutative', () => {
      const a = [1, 2, 3, 4];
      const b = [5, 6, 7, 8];
      const sim1 = cosineSim(a, b);
      const sim2 = cosineSim(b, a);
      expect(sim1).toBeCloseTo(sim2, 10);
    });

    test('handles normalized OpenAI-like embeddings', () => {
      // OpenAI embeddings are pre-normalized
      const a = normalize(Array.from({ length: 1536 }, () => Math.random() - 0.5));
      const b = normalize(Array.from({ length: 1536 }, () => Math.random() - 0.5));
      const sim = cosineSim(a, b);

      expect(sim).toBeGreaterThanOrEqual(-1.0);
      expect(sim).toBeLessThanOrEqual(1.0);
    });

    test('performance benchmark for 1536-dim vectors', () => {
      const a = Array.from({ length: 1536 }, () => Math.random());
      const b = Array.from({ length: 1536 }, () => Math.random());

      const start = performance.now();
      const sim = cosineSim(a, b);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5); // Should be under 5ms
      expect(typeof sim).toBe('number');
    });
  });
});
