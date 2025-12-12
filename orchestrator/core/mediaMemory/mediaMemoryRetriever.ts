// orchestrator/core/mediaMemory/mediaMemoryRetriever.ts
// =============================================================================
// Phase 165.7 – Media Memory Retriever for Chat and Agents
// Provides context from media memory for conversations and agents
// =============================================================================

import { getFirestore } from 'firebase-admin/firestore';
import {
  MediaMemoryNode,
  MediaMemorySearchResult,
  MediaMemoryQuery,
} from './types';
import { getMediaMemoryStore } from './firestoreMediaMemoryStore';
import { getGraphEngine } from './mediaMemoryGraphEngine';

/**
 * Context retrieved from media memory for use in chat/agents
 */
export interface MediaMemoryContext {
  // Primary memory node (if attachment-specific)
  primaryNode?: MediaMemoryNode;

  // Related memories for context
  relatedNodes: MediaMemoryNode[];

  // Aggregated context text for LLM
  contextText: string;

  // Extracted entities for quick reference
  entities: string[];

  // Detected components for quick reference
  components: string[];

  // Style summary
  styleSummary: string;

  // Layout types present
  layoutTypes: string[];

  // Source IDs for attribution
  sourceNodeIds: string[];
}

/**
 * Options for retrieving media memory context
 */
export interface RetrievalOptions {
  projectId: string;
  attachmentId?: string;
  conversationId?: string;
  kind?: 'image' | 'pdf' | 'audio';
  layoutTypes?: string[];
  entities?: string[];
  components?: string[];
  maxRelated?: number;
  minSimilarity?: number;
}

/**
 * Build context text from memory nodes
 */
function buildContextText(nodes: MediaMemoryNode[]): string {
  if (nodes.length === 0) {
    return 'No media memory context available.';
  }

  const sections: string[] = [];

  for (const node of nodes) {
    const parts: string[] = [];

    // Title and kind
    parts.push(`[${node.kind.toUpperCase()}${node.title ? `: ${node.title}` : ''}]`);

    // Summary
    parts.push(`Summary: ${node.summary}`);

    // Layout types
    if (node.layoutTypes.length > 0) {
      parts.push(`Layout: ${node.layoutTypes.join(', ')}`);
    }

    // Entities
    if (node.entities.length > 0) {
      parts.push(`Entities: ${node.entities.join(', ')}`);
    }

    // Components
    if (node.components.length > 0) {
      parts.push(`Components: ${node.components.join(', ')}`);
    }

    // Style
    if (node.primaryColor || node.styleHints?.theme) {
      const styleParts: string[] = [];
      if (node.styleHints?.theme) styleParts.push(`Theme: ${node.styleHints.theme}`);
      if (node.primaryColor) styleParts.push(`Primary: ${node.primaryColor}`);
      if (node.styleHints?.borderRadius) styleParts.push(`Corners: ${node.styleHints.borderRadius}`);
      parts.push(`Style: ${styleParts.join(', ')}`);
    }

    sections.push(parts.join('\n'));
  }

  return sections.join('\n\n---\n\n');
}

/**
 * Build style summary from nodes
 */
function buildStyleSummary(nodes: MediaMemoryNode[]): string {
  const themes = new Set<string>();
  const colors = new Set<string>();
  const radiuses = new Set<string>();

  for (const node of nodes) {
    if (node.styleHints?.theme) themes.add(node.styleHints.theme);
    if (node.primaryColor) colors.add(node.primaryColor);
    if (node.secondaryColor) colors.add(node.secondaryColor);
    if (node.styleHints?.borderRadius) radiuses.add(node.styleHints.borderRadius);
    node.accentColors.forEach(c => colors.add(c));
  }

  const parts: string[] = [];
  if (themes.size > 0) parts.push(`Theme: ${[...themes].join('/')}`);
  if (colors.size > 0) parts.push(`Colors: ${[...colors].slice(0, 5).join(', ')}`);
  if (radiuses.size > 0) parts.push(`Border radius: ${[...radiuses].join('/')}`);

  return parts.length > 0 ? parts.join('. ') : 'No style information available';
}

/**
 * Retrieve media memory context for chat/agents
 */
export async function retrieveMediaMemoryContext(
  options: RetrievalOptions
): Promise<MediaMemoryContext> {
  console.log('[165.7][RETRIEVER] Retrieving context for:', options.projectId);

  const store = getMediaMemoryStore();
  const engine = getGraphEngine();

  let primaryNode: MediaMemoryNode | undefined;
  const relatedNodes: MediaMemoryNode[] = [];

  // If attachment ID provided, get the primary node
  if (options.attachmentId) {
    primaryNode = await store.getNodeByAttachment(
      options.projectId,
      options.attachmentId
    ) || undefined;

    if (primaryNode) {
      // Get similar nodes
      const similar = await engine.findSimilarNodes(primaryNode.id, {
        minScore: options.minSimilarity || 0.3,
        limit: options.maxRelated || 5,
      });
      relatedNodes.push(...similar.map(s => s.node));
    }
  }

  // If no primary node but we have search criteria, search for related nodes
  if (!primaryNode && (options.layoutTypes || options.entities || options.components)) {
    const query: MediaMemoryQuery = {
      projectId: options.projectId,
      kind: options.kind,
      layoutTypes: options.layoutTypes,
      entities: options.entities,
      components: options.components,
      limit: options.maxRelated || 10,
      minSimilarity: options.minSimilarity,
    };

    const results = await store.searchNodes(query);
    relatedNodes.push(...results.map(r => r.node));
  }

  // If we still have no nodes, just get recent ones from the project
  if (!primaryNode && relatedNodes.length === 0) {
    const recentNodes = await store.listNodes(options.projectId, {
      kind: options.kind,
      limit: options.maxRelated || 5,
    });
    relatedNodes.push(...recentNodes);
  }

  // Combine all nodes for aggregation
  const allNodes = primaryNode ? [primaryNode, ...relatedNodes] : relatedNodes;

  // Aggregate entities and components
  const entitiesSet = new Set<string>();
  const componentsSet = new Set<string>();
  const layoutTypesSet = new Set<string>();

  for (const node of allNodes) {
    node.entities.forEach(e => entitiesSet.add(e));
    node.components.forEach(c => componentsSet.add(c));
    node.layoutTypes.forEach(lt => layoutTypesSet.add(lt));
  }

  // Build context
  const context: MediaMemoryContext = {
    primaryNode,
    relatedNodes,
    contextText: buildContextText(allNodes),
    entities: [...entitiesSet],
    components: [...componentsSet],
    styleSummary: buildStyleSummary(allNodes),
    layoutTypes: [...layoutTypesSet],
    sourceNodeIds: allNodes.map(n => n.id),
  };

  console.log('[165.7][RETRIEVER] Retrieved context:', {
    primaryNodeId: primaryNode?.id,
    relatedCount: relatedNodes.length,
    entitiesCount: context.entities.length,
    componentsCount: context.components.length,
  });

  return context;
}

/**
 * Retrieve context for a specific conversation
 */
export async function retrieveConversationMediaContext(
  projectId: string,
  conversationId: string
): Promise<MediaMemoryContext> {
  console.log('[165.7][RETRIEVER] Retrieving conversation context:', conversationId);

  const db = getFirestore();

  // Find memory nodes associated with this conversation
  const snap = await db
    .collection('mediaMemoryNodes')
    .where('projectId', '==', projectId)
    .where('conversationId', '==', conversationId)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  const nodes = snap.docs.map(d => d.data() as MediaMemoryNode);

  if (nodes.length === 0) {
    return {
      relatedNodes: [],
      contextText: 'No media context from this conversation.',
      entities: [],
      components: [],
      styleSummary: '',
      layoutTypes: [],
      sourceNodeIds: [],
    };
  }

  // Use the most recent as primary
  const primaryNode = nodes[0];
  const relatedNodes = nodes.slice(1);

  // Aggregate
  const entitiesSet = new Set<string>();
  const componentsSet = new Set<string>();
  const layoutTypesSet = new Set<string>();

  for (const node of nodes) {
    node.entities.forEach(e => entitiesSet.add(e));
    node.components.forEach(c => componentsSet.add(c));
    node.layoutTypes.forEach(lt => layoutTypesSet.add(lt));
  }

  return {
    primaryNode,
    relatedNodes,
    contextText: buildContextText(nodes),
    entities: [...entitiesSet],
    components: [...componentsSet],
    styleSummary: buildStyleSummary(nodes),
    layoutTypes: [...layoutTypesSet],
    sourceNodeIds: nodes.map(n => n.id),
  };
}

/**
 * Generate a prompt augmentation for LLM based on media memory
 */
export function generateMemoryPromptAugmentation(context: MediaMemoryContext): string {
  if (context.sourceNodeIds.length === 0) {
    return '';
  }

  const parts: string[] = [
    '## Media Context from Project Memory',
    '',
  ];

  if (context.primaryNode) {
    parts.push(`### Primary Media: ${context.primaryNode.title || context.primaryNode.kind}`);
    parts.push(context.primaryNode.summary);
    parts.push('');
  }

  if (context.entities.length > 0) {
    parts.push(`### Detected Entities`);
    parts.push(context.entities.map(e => `- ${e}`).join('\n'));
    parts.push('');
  }

  if (context.components.length > 0) {
    parts.push(`### Detected UI Components`);
    parts.push(context.components.map(c => `- ${c}`).join('\n'));
    parts.push('');
  }

  if (context.layoutTypes.length > 0) {
    parts.push(`### Layout Types`);
    parts.push(context.layoutTypes.join(', '));
    parts.push('');
  }

  if (context.styleSummary) {
    parts.push(`### Style Information`);
    parts.push(context.styleSummary);
    parts.push('');
  }

  if (context.relatedNodes.length > 0) {
    parts.push(`### Related Media (${context.relatedNodes.length} items)`);
    context.relatedNodes.slice(0, 3).forEach(node => {
      parts.push(`- ${node.title || node.kind}: ${node.summary.slice(0, 100)}...`);
    });
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Quick helper to get entities and components for a project
 */
export async function getProjectMediaInsights(projectId: string): Promise<{
  totalMemories: number;
  topEntities: string[];
  topComponents: string[];
  layoutTypes: string[];
  dominantTheme: string | null;
}> {
  const store = getMediaMemoryStore();
  const stats = await store.getStats(projectId);
  const nodes = await store.listNodes(projectId, { limit: 100 });

  // Aggregate
  const entityCounts = new Map<string, number>();
  const componentCounts = new Map<string, number>();
  const layoutCounts = new Map<string, number>();
  const themeCounts = new Map<string, number>();

  for (const node of nodes) {
    node.entities.forEach(e => entityCounts.set(e, (entityCounts.get(e) || 0) + 1));
    node.components.forEach(c => componentCounts.set(c, (componentCounts.get(c) || 0) + 1));
    node.layoutTypes.forEach(lt => layoutCounts.set(lt, (layoutCounts.get(lt) || 0) + 1));
    if (node.styleHints?.theme) {
      themeCounts.set(node.styleHints.theme, (themeCounts.get(node.styleHints.theme) || 0) + 1);
    }
  }

  const topEntities = [...entityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([e]) => e);

  const topComponents = [...componentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([c]) => c);

  const layoutTypes = [...layoutCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lt]) => lt);

  let dominantTheme: string | null = null;
  let maxThemeCount = 0;
  themeCounts.forEach((count, theme) => {
    if (count > maxThemeCount) {
      maxThemeCount = count;
      dominantTheme = theme;
    }
  });

  return {
    totalMemories: stats.nodeCount,
    topEntities,
    topComponents,
    layoutTypes,
    dominantTheme,
  };
}

console.log('[165.7][MEDIA_MEMORY] Retriever loaded');
