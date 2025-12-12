// orchestrator/core/mediaMemory/firestoreMediaMemoryStore.ts
// =============================================================================
// Phase 165.1 – Firestore Store for Media Memory Graph
// =============================================================================

import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import {
  MediaMemoryNode,
  MediaMemoryEdge,
  MediaMemoryQuery,
  MediaMemorySearchResult,
  MediaMemoryGraphResult,
  MediaMemoryKind,
  MediaMemoryEdgeType,
} from './types';

// Collection names
const NODES_COLLECTION = 'mediaMemoryNodes';
const EDGES_COLLECTION = 'mediaMemoryEdges';

/**
 * Firestore store for Media Memory Graph
 */
export class FirestoreMediaMemoryStore {
  private db: Firestore;

  constructor(db?: Firestore) {
    this.db = db || getFirestore();
  }

  // ===========================================================================
  // Node Operations
  // ===========================================================================

  /**
   * Create a new memory node
   */
  async createNode(node: MediaMemoryNode): Promise<MediaMemoryNode> {
    console.log('[165.1][STORE] Creating node:', node.id);
    await this.db.collection(NODES_COLLECTION).doc(node.id).set(node);
    return node;
  }

  /**
   * Get a node by ID
   */
  async getNode(nodeId: string): Promise<MediaMemoryNode | null> {
    const doc = await this.db.collection(NODES_COLLECTION).doc(nodeId).get();
    if (!doc.exists) return null;
    return doc.data() as MediaMemoryNode;
  }

  /**
   * Get node by attachment ID
   */
  async getNodeByAttachment(
    projectId: string,
    attachmentId: string
  ): Promise<MediaMemoryNode | null> {
    const snap = await this.db
      .collection(NODES_COLLECTION)
      .where('projectId', '==', projectId)
      .where('attachmentId', '==', attachmentId)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as MediaMemoryNode;
  }

  /**
   * Get node by preprocess job ID
   */
  async getNodeByPreprocessJob(preprocessJobId: string): Promise<MediaMemoryNode | null> {
    const snap = await this.db
      .collection(NODES_COLLECTION)
      .where('preprocessJobId', '==', preprocessJobId)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as MediaMemoryNode;
  }

  /**
   * Update a node
   */
  async updateNode(
    nodeId: string,
    updates: Partial<MediaMemoryNode>
  ): Promise<MediaMemoryNode | null> {
    console.log('[165.1][STORE] Updating node:', nodeId);
    const ref = this.db.collection(NODES_COLLECTION).doc(nodeId);
    await ref.update({
      ...updates,
      updatedAt: Date.now(),
    });
    const doc = await ref.get();
    return doc.exists ? (doc.data() as MediaMemoryNode) : null;
  }

  /**
   * Delete a node and its edges
   */
  async deleteNode(nodeId: string): Promise<void> {
    console.log('[165.1][STORE] Deleting node:', nodeId);

    // Delete all edges connected to this node
    const edgesFrom = await this.db
      .collection(EDGES_COLLECTION)
      .where('fromMemoryId', '==', nodeId)
      .get();

    const edgesTo = await this.db
      .collection(EDGES_COLLECTION)
      .where('toMemoryId', '==', nodeId)
      .get();

    const batch = this.db.batch();
    edgesFrom.docs.forEach(doc => batch.delete(doc.ref));
    edgesTo.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(this.db.collection(NODES_COLLECTION).doc(nodeId));

    await batch.commit();
  }

  /**
   * List nodes for a project
   */
  async listNodes(
    projectId: string,
    options?: {
      kind?: MediaMemoryKind;
      limit?: number;
      offset?: number;
    }
  ): Promise<MediaMemoryNode[]> {
    let query = this.db
      .collection(NODES_COLLECTION)
      .where('projectId', '==', projectId);

    if (options?.kind) {
      query = query.where('kind', '==', options.kind);
    }

    query = query.orderBy('createdAt', 'desc');

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const snap = await query.get();
    return snap.docs.map(doc => doc.data() as MediaMemoryNode);
  }

  // ===========================================================================
  // Edge Operations
  // ===========================================================================

  /**
   * Create a new edge
   */
  async createEdge(edge: MediaMemoryEdge): Promise<MediaMemoryEdge> {
    console.log('[165.1][STORE] Creating edge:', edge.id, edge.type);
    await this.db.collection(EDGES_COLLECTION).doc(edge.id).set(edge);
    return edge;
  }

  /**
   * Get an edge by ID
   */
  async getEdge(edgeId: string): Promise<MediaMemoryEdge | null> {
    const doc = await this.db.collection(EDGES_COLLECTION).doc(edgeId).get();
    if (!doc.exists) return null;
    return doc.data() as MediaMemoryEdge;
  }

  /**
   * Get edges for a node
   */
  async getEdgesForNode(
    nodeId: string,
    options?: {
      direction?: 'from' | 'to' | 'both';
      type?: MediaMemoryEdgeType;
      minScore?: number;
    }
  ): Promise<MediaMemoryEdge[]> {
    const direction = options?.direction || 'both';
    const edges: MediaMemoryEdge[] = [];

    if (direction === 'from' || direction === 'both') {
      let query = this.db
        .collection(EDGES_COLLECTION)
        .where('fromMemoryId', '==', nodeId);

      if (options?.type) {
        query = query.where('type', '==', options.type);
      }

      const snap = await query.get();
      edges.push(...snap.docs.map(doc => doc.data() as MediaMemoryEdge));
    }

    if (direction === 'to' || direction === 'both') {
      let query = this.db
        .collection(EDGES_COLLECTION)
        .where('toMemoryId', '==', nodeId);

      if (options?.type) {
        query = query.where('type', '==', options.type);
      }

      const snap = await query.get();
      edges.push(...snap.docs.map(doc => doc.data() as MediaMemoryEdge));
    }

    // Filter by minScore if specified
    if (options?.minScore !== undefined) {
      return edges.filter(e => e.score >= options.minScore!);
    }

    return edges;
  }

  /**
   * Delete an edge
   */
  async deleteEdge(edgeId: string): Promise<void> {
    console.log('[165.1][STORE] Deleting edge:', edgeId);
    await this.db.collection(EDGES_COLLECTION).doc(edgeId).delete();
  }

  /**
   * Delete edges between two nodes
   */
  async deleteEdgesBetween(nodeId1: string, nodeId2: string): Promise<number> {
    const snap1 = await this.db
      .collection(EDGES_COLLECTION)
      .where('fromMemoryId', '==', nodeId1)
      .where('toMemoryId', '==', nodeId2)
      .get();

    const snap2 = await this.db
      .collection(EDGES_COLLECTION)
      .where('fromMemoryId', '==', nodeId2)
      .where('toMemoryId', '==', nodeId1)
      .get();

    const batch = this.db.batch();
    snap1.docs.forEach(doc => batch.delete(doc.ref));
    snap2.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return snap1.size + snap2.size;
  }

  // ===========================================================================
  // Query Operations
  // ===========================================================================

  /**
   * Search nodes by query criteria
   */
  async searchNodes(query: MediaMemoryQuery): Promise<MediaMemorySearchResult[]> {
    console.log('[165.1][STORE] Searching nodes:', query.projectId);

    // Start with project filter
    let firestoreQuery = this.db
      .collection(NODES_COLLECTION)
      .where('projectId', '==', query.projectId);

    // Add kind filter
    if (query.kind) {
      firestoreQuery = firestoreQuery.where('kind', '==', query.kind);
    }

    // Firestore array-contains-any for layoutTypes (limited to one array-contains)
    if (query.layoutTypes && query.layoutTypes.length > 0) {
      firestoreQuery = firestoreQuery.where(
        'layoutTypes',
        'array-contains-any',
        query.layoutTypes.slice(0, 10) // Firestore limit
      );
    }

    const limit = query.limit || 50;
    firestoreQuery = firestoreQuery.orderBy('createdAt', 'desc').limit(limit * 2);

    const snap = await firestoreQuery.get();
    const nodes = snap.docs.map(doc => doc.data() as MediaMemoryNode);

    // Post-filter and score in-memory
    const results: MediaMemorySearchResult[] = [];

    for (const node of nodes) {
      const matchedOn: MediaMemorySearchResult['matchedOn'] = [];
      let score = 0;

      // Layout match
      if (query.layoutTypes && query.layoutTypes.length > 0) {
        const layoutOverlap = query.layoutTypes.filter(t =>
          node.layoutTypes.includes(t)
        ).length;
        if (layoutOverlap > 0) {
          matchedOn.push('layout');
          score += layoutOverlap / query.layoutTypes.length;
        }
      }

      // Entity match
      if (query.entities && query.entities.length > 0) {
        const entityOverlap = query.entities.filter(e =>
          node.entities.some(ne => ne.toLowerCase().includes(e.toLowerCase()))
        ).length;
        if (entityOverlap > 0) {
          matchedOn.push('entity');
          score += entityOverlap / query.entities.length;
        }
      }

      // Component match
      if (query.components && query.components.length > 0) {
        const componentOverlap = query.components.filter(c =>
          node.components.some(nc => nc.toLowerCase().includes(c.toLowerCase()))
        ).length;
        if (componentOverlap > 0) {
          matchedOn.push('component');
          score += componentOverlap / query.components.length;
        }
      }

      // Tag match
      if (query.tags && query.tags.length > 0) {
        const tagOverlap = query.tags.filter(t =>
          node.tags.some(nt =>
            nt.key === t.key && (!t.value || nt.value === t.value)
          )
        ).length;
        if (tagOverlap > 0) {
          matchedOn.push('tag');
          score += tagOverlap / query.tags.length;
        }
      }

      // Normalize score
      const matchCount = [
        query.layoutTypes?.length,
        query.entities?.length,
        query.components?.length,
        query.tags?.length,
      ].filter(Boolean).length || 1;

      score = score / matchCount;

      // Apply minSimilarity filter
      if (query.minSimilarity && score < query.minSimilarity) {
        continue;
      }

      // If no specific filters, include all with base score
      if (matchedOn.length === 0 && !query.layoutTypes && !query.entities && !query.components && !query.tags) {
        score = 1.0;
      }

      results.push({ node, score, matchedOn });
    }

    // Sort by score and apply limit
    results.sort((a, b) => b.score - a.score);

    const offset = query.offset || 0;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get graph for a node (center + connected nodes)
   */
  async getGraph(
    nodeId: string,
    options?: {
      depth?: number;
      minScore?: number;
      edgeTypes?: MediaMemoryEdgeType[];
    }
  ): Promise<MediaMemoryGraphResult | null> {
    const centerNode = await this.getNode(nodeId);
    if (!centerNode) return null;

    // Get edges for center node
    let edges = await this.getEdgesForNode(nodeId, {
      direction: 'both',
      minScore: options?.minScore,
    });

    // Filter by edge types
    if (options?.edgeTypes && options.edgeTypes.length > 0) {
      edges = edges.filter(e => options.edgeTypes!.includes(e.type));
    }

    // Get connected nodes
    const connectedNodeIds = new Set<string>();
    edges.forEach(e => {
      if (e.fromMemoryId !== nodeId) connectedNodeIds.add(e.fromMemoryId);
      if (e.toMemoryId !== nodeId) connectedNodeIds.add(e.toMemoryId);
    });

    const connectedNodes: MediaMemoryNode[] = [];
    for (const id of connectedNodeIds) {
      const node = await this.getNode(id);
      if (node) connectedNodes.push(node);
    }

    return {
      centerNode,
      edges,
      connectedNodes,
    };
  }

  // ===========================================================================
  // Batch Operations
  // ===========================================================================

  /**
   * Create multiple nodes in batch
   */
  async createNodesBatch(nodes: MediaMemoryNode[]): Promise<number> {
    console.log('[165.1][STORE] Batch creating', nodes.length, 'nodes');

    const batch = this.db.batch();
    for (const node of nodes) {
      batch.set(this.db.collection(NODES_COLLECTION).doc(node.id), node);
    }
    await batch.commit();

    return nodes.length;
  }

  /**
   * Create multiple edges in batch
   */
  async createEdgesBatch(edges: MediaMemoryEdge[]): Promise<number> {
    console.log('[165.1][STORE] Batch creating', edges.length, 'edges');

    const batch = this.db.batch();
    for (const edge of edges) {
      batch.set(this.db.collection(EDGES_COLLECTION).doc(edge.id), edge);
    }
    await batch.commit();

    return edges.length;
  }

  /**
   * Get stats for a project's memory graph
   */
  async getStats(projectId: string): Promise<{
    nodeCount: number;
    edgeCount: number;
    byKind: Record<MediaMemoryKind, number>;
    byEdgeType: Record<MediaMemoryEdgeType, number>;
  }> {
    // Count nodes
    const nodesSnap = await this.db
      .collection(NODES_COLLECTION)
      .where('projectId', '==', projectId)
      .get();

    const nodes = nodesSnap.docs.map(d => d.data() as MediaMemoryNode);

    // Count edges (get all edges for project's nodes)
    const nodeIds = nodes.map(n => n.id);
    let edgeCount = 0;
    const byEdgeType: Record<string, number> = {};

    for (const nodeId of nodeIds) {
      const edgesSnap = await this.db
        .collection(EDGES_COLLECTION)
        .where('fromMemoryId', '==', nodeId)
        .get();

      edgesSnap.docs.forEach(doc => {
        edgeCount++;
        const edge = doc.data() as MediaMemoryEdge;
        byEdgeType[edge.type] = (byEdgeType[edge.type] || 0) + 1;
      });
    }

    // Count by kind
    const byKind: Record<string, number> = {
      image: 0,
      pdf: 0,
      audio: 0,
    };
    nodes.forEach(n => {
      byKind[n.kind] = (byKind[n.kind] || 0) + 1;
    });

    return {
      nodeCount: nodes.length,
      edgeCount,
      byKind: byKind as Record<MediaMemoryKind, number>,
      byEdgeType: byEdgeType as Record<MediaMemoryEdgeType, number>,
    };
  }
}

// Singleton instance
let storeInstance: FirestoreMediaMemoryStore | null = null;

export function getMediaMemoryStore(): FirestoreMediaMemoryStore {
  if (!storeInstance) {
    storeInstance = new FirestoreMediaMemoryStore();
  }
  return storeInstance;
}

console.log('[165.1][MEDIA_MEMORY] Firestore store loaded');
