// orchestrator/core/neuralMemory/embeddingProvider.ts
// =============================================================================
// Phase 166.1 – Embedding Provider Abstraction
// Supports multiple embedding providers (OpenAI, Vertex, Local, Mock)
// =============================================================================

import {
  NeuralMemoryItem,
  NeuralSearchFilter,
  NeuralSearchResultItem,
} from './types';

/**
 * Embedding provider interface
 */
export interface EmbeddingProvider {
  id: string;
  modelName: string;
  dimensions: number;

  /**
   * Generate embeddings for multiple texts
   */
  embedTexts(texts: string[]): Promise<number[][]>;

  /**
   * Search for similar items
   */
  search(
    projectId: string,
    queryEmbedding: number[],
    topK: number,
    filter?: Partial<NeuralSearchFilter>,
  ): Promise<NeuralSearchResultItem[]>;
}

/**
 * Embedding index adapter for storage
 */
export interface EmbeddingIndexAdapter {
  /**
   * Upsert items into the index
   */
  upsertItems(items: NeuralMemoryItem[]): Promise<void>;

  /**
   * Delete items from the index
   */
  deleteItems(ids: string[]): Promise<void>;

  /**
   * Get item by ID
   */
  getItem(id: string): Promise<NeuralMemoryItem | null>;

  /**
   * List items for a project
   */
  listItems(projectId: string, limit?: number): Promise<NeuralMemoryItem[]>;
}

// =============================================================================
// Mock Embedding Provider (for development/testing)
// =============================================================================

/**
 * Simple mock embedding provider using keyword-based similarity
 * In production, replace with OpenAI/Vertex AI embeddings
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  id = 'mock';
  modelName = 'mock-embeddings-v1';
  dimensions = 384; // Common small model dimension

  private items: Map<string, NeuralMemoryItem> = new Map();

  async embedTexts(texts: string[]): Promise<number[][]> {
    // Generate deterministic mock embeddings based on text content
    return texts.map(text => this.generateMockEmbedding(text));
  }

  private generateMockEmbedding(text: string): number[] {
    // Create a simple hash-based embedding for testing
    const embedding = new Array(this.dimensions).fill(0);
    const words = text.toLowerCase().split(/\s+/);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const idx = (word.charCodeAt(j) + i * 7 + j * 13) % this.dimensions;
        embedding[idx] += 1 / (1 + Math.log(words.length));
      }
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  async search(
    projectId: string,
    queryEmbedding: number[],
    topK: number,
    filter?: Partial<NeuralSearchFilter>,
  ): Promise<NeuralSearchResultItem[]> {
    const results: NeuralSearchResultItem[] = [];

    for (const item of this.items.values()) {
      // Filter by project
      if (item.projectId !== projectId) continue;

      // Apply source type filter
      if (filter?.sourceTypes && !filter.sourceTypes.includes(item.sourceType)) {
        continue;
      }

      // Apply tag filter
      if (filter?.tags && filter.tags.length > 0) {
        const hasTag = filter.tags.some(t => item.tags.includes(t));
        if (!hasTag) continue;
      }

      // Apply exclude filter
      if (filter?.excludeIds && filter.excludeIds.includes(item.id)) {
        continue;
      }

      // Calculate similarity
      const itemEmbedding = item.embeddingVector || this.generateMockEmbedding(item.snippet);
      const score = this.cosineSimilarity(queryEmbedding, itemEmbedding);

      // Apply min score filter
      if (filter?.minScore && score < filter.minScore) {
        continue;
      }

      results.push({ item, score });
    }

    // Sort by score and return top K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  // Index adapter methods
  setItems(items: NeuralMemoryItem[]): void {
    for (const item of items) {
      this.items.set(item.id, item);
    }
  }

  deleteItemsFromIndex(ids: string[]): void {
    for (const id of ids) {
      this.items.delete(id);
    }
  }

  getItemFromIndex(id: string): NeuralMemoryItem | undefined {
    return this.items.get(id);
  }

  listItemsFromIndex(projectId: string, limit = 100): NeuralMemoryItem[] {
    const results: NeuralMemoryItem[] = [];
    for (const item of this.items.values()) {
      if (item.projectId === projectId) {
        results.push(item);
        if (results.length >= limit) break;
      }
    }
    return results;
  }
}

// =============================================================================
// Firestore-based Index Adapter
// =============================================================================

import { getFirestore } from 'firebase-admin/firestore';

const NEURAL_ITEMS_COLLECTION = 'neuralMemoryItems';

export class FirestoreIndexAdapter implements EmbeddingIndexAdapter {
  private db = getFirestore();

  async upsertItems(items: NeuralMemoryItem[]): Promise<void> {
    const batch = this.db.batch();

    for (const item of items) {
      const ref = this.db.collection(NEURAL_ITEMS_COLLECTION).doc(item.id);
      batch.set(ref, item, { merge: true });
    }

    await batch.commit();
    console.log(`[166.1][INDEX] Upserted ${items.length} items`);
  }

  async deleteItems(ids: string[]): Promise<void> {
    const batch = this.db.batch();

    for (const id of ids) {
      const ref = this.db.collection(NEURAL_ITEMS_COLLECTION).doc(id);
      batch.delete(ref);
    }

    await batch.commit();
    console.log(`[166.1][INDEX] Deleted ${ids.length} items`);
  }

  async getItem(id: string): Promise<NeuralMemoryItem | null> {
    const doc = await this.db.collection(NEURAL_ITEMS_COLLECTION).doc(id).get();
    return doc.exists ? (doc.data() as NeuralMemoryItem) : null;
  }

  async listItems(projectId: string, limit = 100): Promise<NeuralMemoryItem[]> {
    const snap = await this.db
      .collection(NEURAL_ITEMS_COLLECTION)
      .where('projectId', '==', projectId)
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map(doc => doc.data() as NeuralMemoryItem);
  }

  async searchByFilter(
    projectId: string,
    filter?: Partial<NeuralSearchFilter>,
    limit = 50,
  ): Promise<NeuralMemoryItem[]> {
    let query = this.db
      .collection(NEURAL_ITEMS_COLLECTION)
      .where('projectId', '==', projectId);

    // Note: Firestore has limitations on compound queries
    // For production, use a proper vector DB

    const snap = await query.limit(limit * 2).get();
    let items = snap.docs.map(doc => doc.data() as NeuralMemoryItem);

    // Post-filter
    if (filter?.sourceTypes && filter.sourceTypes.length > 0) {
      items = items.filter(item => filter.sourceTypes!.includes(item.sourceType));
    }

    if (filter?.tags && filter.tags.length > 0) {
      items = items.filter(item =>
        filter.tags!.some(t => item.tags.includes(t))
      );
    }

    if (filter?.excludeIds && filter.excludeIds.length > 0) {
      items = items.filter(item => !filter.excludeIds!.includes(item.id));
    }

    return items.slice(0, limit);
  }
}

// =============================================================================
// Provider Factory
// =============================================================================

let defaultProvider: EmbeddingProvider | null = null;
let indexAdapter: EmbeddingIndexAdapter | null = null;
let mockProvider: MockEmbeddingProvider | null = null;

/**
 * Get the default embedding provider
 */
export function getDefaultEmbeddingProvider(): EmbeddingProvider {
  if (!defaultProvider) {
    // For now, use mock provider
    // In production, check env vars and instantiate OpenAI/Vertex provider
    mockProvider = new MockEmbeddingProvider();
    defaultProvider = mockProvider;
    console.log('[166.1][PROVIDER] Using MockEmbeddingProvider');
  }
  return defaultProvider;
}

/**
 * Get the embedding index adapter
 */
export function getEmbeddingIndexAdapter(): EmbeddingIndexAdapter {
  if (!indexAdapter) {
    indexAdapter = new FirestoreIndexAdapter();
    console.log('[166.1][ADAPTER] Using FirestoreIndexAdapter');
  }
  return indexAdapter;
}

/**
 * Get the mock provider (for direct item management)
 */
export function getMockProvider(): MockEmbeddingProvider {
  if (!mockProvider) {
    mockProvider = new MockEmbeddingProvider();
    defaultProvider = mockProvider;
  }
  return mockProvider;
}

/**
 * Set a custom embedding provider (for testing or custom implementations)
 */
export function setEmbeddingProvider(provider: EmbeddingProvider): void {
  defaultProvider = provider;
  console.log(`[166.1][PROVIDER] Set custom provider: ${provider.id}`);
}

/**
 * Set a custom index adapter
 */
export function setIndexAdapter(adapter: EmbeddingIndexAdapter): void {
  indexAdapter = adapter;
  console.log('[166.1][ADAPTER] Set custom adapter');
}

console.log('[166.1][NEURAL_MEMORY] Embedding provider loaded');
