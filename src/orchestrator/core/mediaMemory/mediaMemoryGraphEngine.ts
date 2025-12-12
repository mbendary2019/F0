// orchestrator/core/mediaMemory/mediaMemoryGraphEngine.ts
// =============================================================================
// Phase 165.3 – Graph Engine for Media Memory (Edges + Similarity)
// =============================================================================

import {
  MediaMemoryNode,
  MediaMemoryEdge,
  MediaMemoryEdgeType,
  MediaMemorySearchResult,
} from './types';
import { getMediaMemoryStore, FirestoreMediaMemoryStore } from './firestoreMediaMemoryStore';

/**
 * Generate a unique ID
 */
function generateId(prefix = 'edge'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Calculate style similarity between two nodes
 * Returns score 0.0 - 1.0
 */
export function calculateStyleSimilarity(node1: MediaMemoryNode, node2: MediaMemoryNode): number {
  let score = 0;
  let factors = 0;

  // Primary color similarity
  if (node1.primaryColor && node2.primaryColor) {
    score += colorSimilarity(node1.primaryColor, node2.primaryColor);
    factors++;
  }

  // Secondary color similarity
  if (node1.secondaryColor && node2.secondaryColor) {
    score += colorSimilarity(node1.secondaryColor, node2.secondaryColor);
    factors++;
  }

  // Accent colors overlap
  if (node1.accentColors.length > 0 && node2.accentColors.length > 0) {
    const overlap = node1.accentColors.filter(c1 =>
      node2.accentColors.some(c2 => colorSimilarity(c1, c2) > 0.8)
    ).length;
    const maxColors = Math.max(node1.accentColors.length, node2.accentColors.length);
    score += overlap / maxColors;
    factors++;
  }

  // Style hints similarity
  const hints1 = node1.styleHints;
  const hints2 = node2.styleHints;

  if (hints1.borderRadius === hints2.borderRadius) {
    score += 1;
    factors++;
  }
  if (hints1.shadowLevel === hints2.shadowLevel) {
    score += 1;
    factors++;
  }
  if (hints1.spacing === hints2.spacing) {
    score += 1;
    factors++;
  }
  if (hints1.theme === hints2.theme) {
    score += 1;
    factors++;
  }

  return factors > 0 ? score / factors : 0;
}

/**
 * Calculate color similarity (simple hex comparison)
 */
function colorSimilarity(color1: string, color2: string): number {
  // Normalize colors
  const c1 = normalizeColor(color1);
  const c2 = normalizeColor(color2);

  if (!c1 || !c2) return 0;
  if (c1 === c2) return 1;

  // Parse RGB
  const rgb1 = hexToRgb(c1);
  const rgb2 = hexToRgb(c2);

  if (!rgb1 || !rgb2) return 0;

  // Calculate Euclidean distance in RGB space
  const distance = Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );

  // Max distance is sqrt(3 * 255^2) = ~441.67
  const maxDistance = 441.67;
  return 1 - (distance / maxDistance);
}

/**
 * Normalize color to hex format
 */
function normalizeColor(color: string): string | null {
  if (!color) return null;
  const c = color.trim().toLowerCase();

  // Already hex
  if (c.startsWith('#')) {
    if (c.length === 4) {
      // Short form #RGB -> #RRGGBB
      return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
    }
    return c;
  }

  // Named colors (common ones)
  const namedColors: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    green: '#00ff00',
    blue: '#0000ff',
    gray: '#808080',
    grey: '#808080',
  };

  return namedColors[c] || null;
}

/**
 * Parse hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate layout similarity between two nodes
 * Returns score 0.0 - 1.0
 */
export function calculateLayoutSimilarity(node1: MediaMemoryNode, node2: MediaMemoryNode): number {
  const layout1 = new Set(node1.layoutTypes);
  const layout2 = new Set(node2.layoutTypes);

  if (layout1.size === 0 || layout2.size === 0) return 0;

  // Jaccard similarity
  const intersection = [...layout1].filter(t => layout2.has(t)).length;
  const union = new Set([...layout1, ...layout2]).size;

  return union > 0 ? intersection / union : 0;
}

/**
 * Calculate entity overlap between two nodes
 * Returns score 0.0 - 1.0
 */
export function calculateEntityOverlap(node1: MediaMemoryNode, node2: MediaMemoryNode): number {
  const entities1 = node1.entities.map(e => e.toLowerCase());
  const entities2 = node2.entities.map(e => e.toLowerCase());

  if (entities1.length === 0 || entities2.length === 0) return 0;

  // Count overlapping entities (partial match)
  let overlap = 0;
  for (const e1 of entities1) {
    for (const e2 of entities2) {
      if (e1.includes(e2) || e2.includes(e1)) {
        overlap++;
        break;
      }
    }
  }

  const maxEntities = Math.max(entities1.length, entities2.length);
  return overlap / maxEntities;
}

/**
 * Calculate component overlap between two nodes
 * Returns score 0.0 - 1.0
 */
export function calculateComponentOverlap(node1: MediaMemoryNode, node2: MediaMemoryNode): number {
  const comp1 = node1.components.map(c => c.toLowerCase());
  const comp2 = node2.components.map(c => c.toLowerCase());

  if (comp1.length === 0 || comp2.length === 0) return 0;

  // Count overlapping components
  const overlap = comp1.filter(c1 =>
    comp2.some(c2 => c1.includes(c2) || c2.includes(c1))
  ).length;

  const maxComps = Math.max(comp1.length, comp2.length);
  return overlap / maxComps;
}

/**
 * Graph Engine for building and querying media memory relationships
 */
export class MediaMemoryGraphEngine {
  private store: FirestoreMediaMemoryStore;

  // Thresholds for auto-edge creation
  private styleSimilarityThreshold = 0.6;
  private layoutSimilarityThreshold = 0.5;
  private entityOverlapThreshold = 0.3;

  constructor(store?: FirestoreMediaMemoryStore) {
    this.store = store || getMediaMemoryStore();
  }

  /**
   * Build edges for a new node against existing nodes in the project
   */
  async buildEdgesForNode(node: MediaMemoryNode): Promise<MediaMemoryEdge[]> {
    console.log('[165.3][GRAPH] Building edges for node:', node.id);

    // Get all other nodes in the project
    const existingNodes = await this.store.listNodes(node.projectId, { limit: 100 });
    const edges: MediaMemoryEdge[] = [];

    for (const other of existingNodes) {
      if (other.id === node.id) continue;

      // Check style similarity
      const styleScore = calculateStyleSimilarity(node, other);
      if (styleScore >= this.styleSimilarityThreshold) {
        edges.push(this.createEdge(node.projectId, node.id, other.id, 'style_similar', styleScore));
      }

      // Check layout similarity
      const layoutScore = calculateLayoutSimilarity(node, other);
      if (layoutScore >= this.layoutSimilarityThreshold) {
        edges.push(this.createEdge(node.projectId, node.id, other.id, 'layout_similar', layoutScore));
      }

      // Check entity overlap
      const entityScore = calculateEntityOverlap(node, other);
      if (entityScore >= this.entityOverlapThreshold) {
        edges.push(this.createEdge(node.projectId, node.id, other.id, 'entity_overlap', entityScore));
      }

      // Same project edge (always create if not same node)
      // Only create one per pair
      const sameProjectEdges = await this.store.getEdgesForNode(node.id, {
        direction: 'both',
        type: 'same_project',
      });
      const alreadyLinked = sameProjectEdges.some(
        e => e.fromMemoryId === other.id || e.toMemoryId === other.id
      );
      if (!alreadyLinked) {
        edges.push(this.createEdge(node.projectId, node.id, other.id, 'same_project', 1.0));
      }
    }

    // Persist edges
    if (edges.length > 0) {
      await this.store.createEdgesBatch(edges);
    }

    console.log('[165.3][GRAPH] Created', edges.length, 'edges for node:', node.id);
    return edges;
  }

  /**
   * Create an edge object
   */
  private createEdge(
    projectId: string,
    fromId: string,
    toId: string,
    type: MediaMemoryEdgeType,
    score: number
  ): MediaMemoryEdge {
    return {
      id: generateId('edge'),
      projectId,
      fromMemoryId: fromId,
      toMemoryId: toId,
      type,
      score,
      createdAt: Date.now(),
    };
  }

  /**
   * Find similar nodes to a given node
   */
  async findSimilarNodes(
    nodeId: string,
    options?: {
      minScore?: number;
      limit?: number;
      edgeTypes?: MediaMemoryEdgeType[];
    }
  ): Promise<MediaMemorySearchResult[]> {
    const graph = await this.store.getGraph(nodeId, {
      minScore: options?.minScore || 0.3,
      edgeTypes: options?.edgeTypes,
    });

    if (!graph) return [];

    // Build results with aggregated scores
    const nodeScores = new Map<string, { node: MediaMemoryNode; score: number; matchedOn: Set<string> }>();

    for (const edge of graph.edges) {
      const otherId = edge.fromMemoryId === nodeId ? edge.toMemoryId : edge.fromMemoryId;
      const otherNode = graph.connectedNodes.find(n => n.id === otherId);
      if (!otherNode) continue;

      const existing = nodeScores.get(otherId);
      if (existing) {
        existing.score = Math.max(existing.score, edge.score);
        existing.matchedOn.add(edgeTypeToMatchType(edge.type));
      } else {
        nodeScores.set(otherId, {
          node: otherNode,
          score: edge.score,
          matchedOn: new Set([edgeTypeToMatchType(edge.type)]),
        });
      }
    }

    // Convert to results
    const results: MediaMemorySearchResult[] = [];
    for (const [, data] of nodeScores) {
      results.push({
        node: data.node,
        score: data.score,
        matchedOn: Array.from(data.matchedOn) as MediaMemorySearchResult['matchedOn'],
      });
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, options?.limit || 10);
  }

  /**
   * Calculate overall similarity between two nodes
   */
  calculateOverallSimilarity(node1: MediaMemoryNode, node2: MediaMemoryNode): {
    overall: number;
    style: number;
    layout: number;
    entity: number;
    component: number;
  } {
    const style = calculateStyleSimilarity(node1, node2);
    const layout = calculateLayoutSimilarity(node1, node2);
    const entity = calculateEntityOverlap(node1, node2);
    const component = calculateComponentOverlap(node1, node2);

    // Weighted average
    const weights = { style: 0.3, layout: 0.3, entity: 0.2, component: 0.2 };
    const overall =
      style * weights.style +
      layout * weights.layout +
      entity * weights.entity +
      component * weights.component;

    return { overall, style, layout, entity, component };
  }

  /**
   * Create a user-linked edge between two nodes
   */
  async linkNodes(
    projectId: string,
    nodeId1: string,
    nodeId2: string,
    metadata?: Record<string, unknown>
  ): Promise<MediaMemoryEdge> {
    const edge: MediaMemoryEdge = {
      id: generateId('edge'),
      projectId,
      fromMemoryId: nodeId1,
      toMemoryId: nodeId2,
      type: 'user_linked',
      score: 1.0,
      metadata,
      createdAt: Date.now(),
    };

    await this.store.createEdge(edge);
    return edge;
  }

  /**
   * Create a derived-from edge
   */
  async markDerivedFrom(
    projectId: string,
    derivedNodeId: string,
    sourceNodeId: string
  ): Promise<MediaMemoryEdge> {
    const edge: MediaMemoryEdge = {
      id: generateId('edge'),
      projectId,
      fromMemoryId: derivedNodeId,
      toMemoryId: sourceNodeId,
      type: 'derived_from',
      score: 1.0,
      createdAt: Date.now(),
    };

    await this.store.createEdge(edge);
    return edge;
  }

  /**
   * Get recommendations for UI generation based on similar memories
   */
  async getUiRecommendations(
    nodeId: string,
    limit = 5
  ): Promise<{
    similarDesigns: MediaMemoryNode[];
    suggestedComponents: string[];
    colorPalette: { primary?: string; secondary?: string; accents: string[] };
  }> {
    const similar = await this.findSimilarNodes(nodeId, {
      edgeTypes: ['style_similar', 'layout_similar'],
      minScore: 0.5,
      limit: limit * 2,
    });

    const similarDesigns = similar.map(r => r.node).slice(0, limit);

    // Aggregate suggested components from similar designs
    const componentCounts = new Map<string, number>();
    for (const design of similarDesigns) {
      for (const comp of design.components) {
        componentCounts.set(comp, (componentCounts.get(comp) || 0) + 1);
      }
    }

    const suggestedComponents = [...componentCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([comp]) => comp);

    // Build color palette from most common colors
    const primaryColors: string[] = [];
    const secondaryColors: string[] = [];
    const accentColors: string[] = [];

    for (const design of similarDesigns) {
      if (design.primaryColor) primaryColors.push(design.primaryColor);
      if (design.secondaryColor) secondaryColors.push(design.secondaryColor);
      accentColors.push(...design.accentColors);
    }

    return {
      similarDesigns,
      suggestedComponents,
      colorPalette: {
        primary: mostCommon(primaryColors),
        secondary: mostCommon(secondaryColors),
        accents: [...new Set(accentColors)].slice(0, 3),
      },
    };
  }

  /**
   * Rebuild all edges for a project
   */
  async rebuildProjectEdges(projectId: string): Promise<{ created: number; deleted: number }> {
    console.log('[165.3][GRAPH] Rebuilding edges for project:', projectId);

    const nodes = await this.store.listNodes(projectId, { limit: 500 });
    let deleted = 0;
    let created = 0;

    // Delete existing edges
    for (const node of nodes) {
      const edges = await this.store.getEdgesForNode(node.id, { direction: 'from' });
      for (const edge of edges) {
        await this.store.deleteEdge(edge.id);
        deleted++;
      }
    }

    // Rebuild edges
    for (const node of nodes) {
      const newEdges = await this.buildEdgesForNode(node);
      created += newEdges.length;
    }

    return { created, deleted };
  }
}

/**
 * Convert edge type to match type for search results
 */
function edgeTypeToMatchType(type: MediaMemoryEdgeType): string {
  const mapping: Record<MediaMemoryEdgeType, string> = {
    style_similar: 'style',
    layout_similar: 'layout',
    entity_overlap: 'entity',
    same_project: 'tag',
    same_conversation: 'tag',
    derived_from: 'tag',
    user_linked: 'tag',
  };
  return mapping[type] || 'tag';
}

/**
 * Find most common item in array
 */
function mostCommon<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;

  const counts = new Map<T, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  let maxItem: T | undefined;
  let maxCount = 0;
  for (const [item, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxItem = item;
    }
  }

  return maxItem;
}

// Singleton instance
let engineInstance: MediaMemoryGraphEngine | null = null;

export function getGraphEngine(): MediaMemoryGraphEngine {
  if (!engineInstance) {
    engineInstance = new MediaMemoryGraphEngine();
  }
  return engineInstance;
}

console.log('[165.3][MEDIA_MEMORY] Graph engine loaded');
