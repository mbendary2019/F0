// =============================================================
// Phase 59 — Cognitive Memory Mesh - Test Suite
// =============================================================

import { cosineSimilarity } from '@/lib/memory/memoryGraph';
import type { MemoryNode, MemoryEdge } from '@/lib/memory/types';

describe('Memory Graph - Cosine Similarity', () => {
  it('should calculate cosine similarity correctly', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    const c = [1, 1, 0];

    expect(cosineSimilarity(a, a)).toBeCloseTo(1.0, 5);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
    expect(cosineSimilarity(a, c)).toBeCloseTo(0.707, 2);
  });

  it('should handle zero vectors', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];

    expect(cosineSimilarity(a, b)).toBe(0);
    expect(cosineSimilarity(a, a)).toBe(0);
  });

  it('should handle undefined inputs', () => {
    const a = [1, 2, 3];

    expect(cosineSimilarity(undefined, a)).toBe(0);
    expect(cosineSimilarity(a, undefined)).toBe(0);
    expect(cosineSimilarity(undefined, undefined)).toBe(0);
  });

  it('should handle different length vectors', () => {
    const a = [1, 2, 3];
    const b = [1, 2];

    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('should calculate similarity for high-dimensional vectors', () => {
    const dim = 1536;
    const a = Array(dim).fill(0).map(() => Math.random());
    const b = Array(dim).fill(0).map(() => Math.random());

    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThanOrEqual(-1);
    expect(sim).toBeLessThanOrEqual(1);
  });
});

describe('Memory Graph - Node Operations', () => {
  const mockNode: MemoryNode = {
    id: 'node_1',
    workspaceId: 'ws_test',
    type: 'snippet',
    text: 'test snippet',
    embedding: [1, 0, 0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    useCount: 5,
  };

  it('should create a valid node structure', () => {
    expect(mockNode.id).toBe('node_1');
    expect(mockNode.workspaceId).toBe('ws_test');
    expect(mockNode.type).toBe('snippet');
    expect(mockNode.embedding).toHaveLength(3);
  });

  it('should validate required node fields', () => {
    expect(mockNode).toHaveProperty('id');
    expect(mockNode).toHaveProperty('workspaceId');
    expect(mockNode).toHaveProperty('type');
    expect(mockNode).toHaveProperty('text');
    expect(mockNode).toHaveProperty('createdAt');
    expect(mockNode).toHaveProperty('updatedAt');
  });
});

describe('Memory Graph - Edge Operations', () => {
  const mockEdge: MemoryEdge = {
    id: 'node1_node2_semantic',
    workspaceId: 'ws_test',
    from: 'node1',
    to: 'node2',
    relation: 'semantic',
    weight: 0.87,
    meta: { similarity: 0.87 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('should create a valid edge structure', () => {
    expect(mockEdge.id).toBe('node1_node2_semantic');
    expect(mockEdge.from).toBe('node1');
    expect(mockEdge.to).toBe('node2');
    expect(mockEdge.relation).toBe('semantic');
    expect(mockEdge.weight).toBe(0.87);
  });

  it('should validate edge weight range', () => {
    expect(mockEdge.weight).toBeGreaterThanOrEqual(0);
    expect(mockEdge.weight).toBeLessThanOrEqual(1);
  });

  it('should validate required edge fields', () => {
    expect(mockEdge).toHaveProperty('id');
    expect(mockEdge).toHaveProperty('workspaceId');
    expect(mockEdge).toHaveProperty('from');
    expect(mockEdge).toHaveProperty('to');
    expect(mockEdge).toHaveProperty('relation');
    expect(mockEdge).toHaveProperty('weight');
    expect(mockEdge).toHaveProperty('createdAt');
    expect(mockEdge).toHaveProperty('updatedAt');
  });

  it('should support different edge types', () => {
    const semanticEdge = { ...mockEdge, relation: 'semantic' as const };
    const temporalEdge = { ...mockEdge, relation: 'temporal' as const };
    const feedbackEdge = { ...mockEdge, relation: 'feedback' as const };

    expect(semanticEdge.relation).toBe('semantic');
    expect(temporalEdge.relation).toBe('temporal');
    expect(feedbackEdge.relation).toBe('feedback');
  });
});

describe('Memory Graph - Edge ID Generation', () => {
  function edgeId(from: string, to: string, relation: string): string {
    return `${from}_${to}_${relation}`;
  }

  it('should generate consistent edge IDs', () => {
    const id1 = edgeId('nodeA', 'nodeB', 'semantic');
    const id2 = edgeId('nodeA', 'nodeB', 'semantic');

    expect(id1).toBe(id2);
    expect(id1).toBe('nodeA_nodeB_semantic');
  });

  it('should generate different IDs for different relations', () => {
    const semantic = edgeId('nodeA', 'nodeB', 'semantic');
    const temporal = edgeId('nodeA', 'nodeB', 'temporal');
    const feedback = edgeId('nodeA', 'nodeB', 'feedback');

    expect(semantic).not.toBe(temporal);
    expect(semantic).not.toBe(feedback);
    expect(temporal).not.toBe(feedback);
  });

  it('should generate different IDs for different directions', () => {
    const forward = edgeId('nodeA', 'nodeB', 'semantic');
    const backward = edgeId('nodeB', 'nodeA', 'semantic');

    expect(forward).not.toBe(backward);
  });
});

describe('Memory Graph - Temporal Decay', () => {
  function calculateDecay(ageDays: number, halfLifeDays: number): number {
    return Math.pow(0.5, ageDays / halfLifeDays);
  }

  it('should decay to 0.5 at half-life', () => {
    const decay = calculateDecay(21, 21);
    expect(decay).toBeCloseTo(0.5, 5);
  });

  it('should decay to 1.0 at age 0', () => {
    const decay = calculateDecay(0, 21);
    expect(decay).toBeCloseTo(1.0, 5);
  });

  it('should decay to ~0.25 at 2x half-life', () => {
    const decay = calculateDecay(42, 21);
    expect(decay).toBeCloseTo(0.25, 2);
  });

  it('should decay below threshold after sufficient time', () => {
    const decay = calculateDecay(100, 21);
    expect(decay).toBeLessThan(0.05);
  });

  it('should never produce negative decay', () => {
    const decay = calculateDecay(1000, 21);
    expect(decay).toBeGreaterThanOrEqual(0);
  });
});

describe('Memory Graph - Feedback Weight Calculation', () => {
  function calculateFeedbackWeight(sumReward: number): number {
    return Math.max(0, Math.min(1, 0.5 + sumReward / 10));
  }

  it('should center at 0.5 for zero reward', () => {
    const weight = calculateFeedbackWeight(0);
    expect(weight).toBe(0.5);
  });

  it('should increase with positive feedback', () => {
    expect(calculateFeedbackWeight(5)).toBeCloseTo(1.0, 5);
    expect(calculateFeedbackWeight(2)).toBeCloseTo(0.7, 5);
  });

  it('should decrease with negative feedback', () => {
    expect(calculateFeedbackWeight(-5)).toBeCloseTo(0.0, 5);
    expect(calculateFeedbackWeight(-2)).toBeCloseTo(0.3, 5);
  });

  it('should clamp to [0, 1] range', () => {
    expect(calculateFeedbackWeight(100)).toBe(1);
    expect(calculateFeedbackWeight(-100)).toBe(0);
  });
});

describe('Memory Graph - Semantic Threshold Filtering', () => {
  it('should filter edges below threshold', () => {
    const threshold = 0.85;
    const similarities = [0.95, 0.88, 0.82, 0.90, 0.75];

    const filtered = similarities.filter((sim) => sim >= threshold);

    expect(filtered).toHaveLength(3);
    expect(filtered).toContain(0.95);
    expect(filtered).toContain(0.88);
    expect(filtered).toContain(0.90);
    expect(filtered).not.toContain(0.82);
    expect(filtered).not.toContain(0.75);
  });
});

describe('Memory Graph - Max Neighbors Constraint', () => {
  it('should limit edges to maxNeighbors', () => {
    const maxNeighbors = 12;
    const candidates = Array(50)
      .fill(0)
      .map((_, i) => ({ id: `node_${i}`, sim: Math.random() }));

    const sorted = candidates.sort((a, b) => b.sim - a.sim);
    const kept = sorted.slice(0, maxNeighbors);

    expect(kept).toHaveLength(maxNeighbors);

    // Verify sorted order
    for (let i = 1; i < kept.length; i++) {
      expect(kept[i - 1].sim).toBeGreaterThanOrEqual(kept[i].sim);
    }
  });
});
