// orchestrator/core/mediaMemory/types.ts
// =============================================================================
// Phase 165.0 – Media Memory Graph Types
// =============================================================================

/**
 * Media kind supported by memory system
 */
export type MediaMemoryKind = 'image' | 'pdf' | 'audio';

/**
 * Edge types for memory graph relationships
 */
export type MediaMemoryEdgeType =
  | 'style_similar'      // Similar visual style (colors, spacing)
  | 'layout_similar'     // Similar layout structure
  | 'entity_overlap'     // Shared entities/components
  | 'same_project'       // Same project relationship
  | 'same_conversation'  // From same conversation
  | 'derived_from'       // One derived from another
  | 'user_linked';       // Manually linked by user

/**
 * Tag attached to memory node for categorization
 */
export interface MediaMemoryTag {
  key: string;
  value: string;
  source: 'auto' | 'user' | 'agent';
  confidence?: number;
}

/**
 * Style hints extracted from media
 */
export interface MediaMemoryStyleHints {
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  shadowLevel?: 0 | 1 | 2 | 3;
  spacing?: 'tight' | 'normal' | 'roomy';
  theme?: 'light' | 'dark' | 'auto';
}

/**
 * Main memory node representing processed media
 */
export interface MediaMemoryNode {
  id: string;
  projectId: string;
  attachmentId: string;
  preprocessJobId: string;
  kind: MediaMemoryKind;

  // Content summary
  title?: string;
  summary: string;

  // Layout info (from preprocessing)
  layoutTypes: string[];  // ['navbar', 'sidebar', 'card', 'table', ...]

  // Style info (from preprocessing)
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColors: string[];
  styleHints: MediaMemoryStyleHints;

  // Extracted entities and components
  entities: string[];     // ['Total Users', 'Revenue', ...]
  components: string[];   // ['UsersStatsCard', 'RevenueChart', ...]

  // Tags for search and categorization
  tags: MediaMemoryTag[];

  // Timestamps
  createdAt: number;
  updatedAt: number;

  // Optional metadata
  conversationId?: string;
  turnId?: string;
  createdBy?: string;
}

/**
 * Edge connecting two memory nodes
 */
export interface MediaMemoryEdge {
  id: string;
  projectId: string;
  fromMemoryId: string;
  toMemoryId: string;
  type: MediaMemoryEdgeType;
  score: number;  // 0.0 - 1.0 similarity/relevance score
  metadata?: Record<string, unknown>;
  createdAt: number;
}

/**
 * Query options for memory search
 */
export interface MediaMemoryQuery {
  projectId: string;
  kind?: MediaMemoryKind;
  layoutTypes?: string[];
  entities?: string[];
  components?: string[];
  tags?: { key: string; value?: string }[];
  minSimilarity?: number;
  limit?: number;
  offset?: number;
}

/**
 * Result from memory search with similarity info
 */
export interface MediaMemorySearchResult {
  node: MediaMemoryNode;
  score: number;
  matchedOn: ('layout' | 'style' | 'entity' | 'component' | 'tag')[];
}

/**
 * Graph traversal result
 */
export interface MediaMemoryGraphResult {
  centerNode: MediaMemoryNode;
  edges: MediaMemoryEdge[];
  connectedNodes: MediaMemoryNode[];
}

/**
 * Input for creating memory from preprocessing result
 */
export interface CreateMemoryFromPreprocessInput {
  projectId: string;
  attachmentId: string;
  preprocessJobId: string;
  title?: string;
  conversationId?: string;
  turnId?: string;
  createdBy?: string;
  additionalTags?: MediaMemoryTag[];
}

/**
 * Batch operation result
 */
export interface MediaMemoryBatchResult {
  created: number;
  updated: number;
  failed: number;
  errors: { id: string; error: string }[];
}

console.log('[165.0][MEDIA_MEMORY] Types loaded');
