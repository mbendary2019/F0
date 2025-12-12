// orchestrator/core/neuralMemory/contextComposer.ts
// =============================================================================
// Phase 166.4 – Context Composer
// Builds LLM-ready context from Neural Memory search results
// =============================================================================

import {
  NeuralSourceType,
  NeuralSearchResultItem,
  ContextChunk,
  ComposedContext,
} from './types';

import { neuralSearch, multiSourceSearch, getContextForCodeGen } from './neuralRetriever';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_TOKENS = 4000;
const CHARS_PER_TOKEN = 4; // Rough estimate
const MAX_CHUNKS_PER_TYPE = 5;

// Source type priorities (higher = more important)
const SOURCE_PRIORITY: Record<NeuralSourceType, number> = {
  code: 5,
  project_doc: 4,
  media: 3,
  test: 2,
  chat: 1,
  run_log: 1,
};

// =============================================================================
// Types
// =============================================================================

export interface ComposeOptions {
  maxTokens?: number;
  includeSystemHint?: boolean;
  format?: 'markdown' | 'xml' | 'json';
  groupBySource?: boolean;
  includeScores?: boolean;
  priorityOrder?: NeuralSourceType[];
}

export interface AgentContextOptions extends ComposeOptions {
  agentType: 'planner' | 'code' | 'media_ui' | 'chat';
  taskDescription: string;
  currentFilePath?: string;
}

// =============================================================================
// Main Composer Function
// =============================================================================

/**
 * Compose LLM-ready context from search results
 */
export function composeContext(
  query: string,
  results: NeuralSearchResultItem[],
  options: ComposeOptions = {},
): ComposedContext {
  const {
    maxTokens = DEFAULT_MAX_TOKENS,
    includeSystemHint = true,
    format = 'markdown',
    groupBySource = true,
    includeScores = false,
    priorityOrder,
  } = options;

  console.log('[166.4][COMPOSER] Composing context for:', query.slice(0, 50));

  // Sort results by priority and score
  const sortedResults = sortByPriority(results, priorityOrder);

  // Convert to chunks with token budgeting
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const { chunks, truncated } = buildChunks(sortedResults, maxChars, groupBySource);

  // Generate system hint
  const systemHint = includeSystemHint
    ? generateSystemHint(query, chunks)
    : '';

  // Format output
  const formattedChunks = formatChunks(chunks, format, includeScores);

  console.log(
    '[166.4][COMPOSER] Composed:',
    chunks.length,
    'chunks,',
    truncated ? 'truncated' : 'complete',
  );

  return {
    query,
    chunks: formattedChunks,
    systemHint,
    totalChunks: chunks.length,
    truncated,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sort results by source type priority and score
 */
function sortByPriority(
  results: NeuralSearchResultItem[],
  priorityOrder?: NeuralSourceType[],
): NeuralSearchResultItem[] {
  const priority = priorityOrder
    ? Object.fromEntries(priorityOrder.map((t, i) => [t, priorityOrder.length - i]))
    : SOURCE_PRIORITY;

  return [...results].sort((a, b) => {
    const priorityA = priority[a.item.sourceType] ?? 0;
    const priorityB = priority[b.item.sourceType] ?? 0;

    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }

    return b.score - a.score;
  });
}

/**
 * Build chunks with token budgeting
 */
function buildChunks(
  results: NeuralSearchResultItem[],
  maxChars: number,
  groupBySource: boolean,
): { chunks: ContextChunk[]; truncated: boolean } {
  const chunks: ContextChunk[] = [];
  let totalChars = 0;
  let truncated = false;

  // Track counts per source type
  const countByType: Record<string, number> = {};

  for (const result of results) {
    const { item, score, matchReason } = result;

    // Check source type limit
    const typeCount = countByType[item.sourceType] || 0;
    if (typeCount >= MAX_CHUNKS_PER_TYPE) {
      continue;
    }

    // Estimate chunk size
    const chunkContent = item.snippet || item.fullContent?.slice(0, 500) || '';
    const chunkSize = chunkContent.length + item.title.length + 100; // Buffer for formatting

    // Check token budget
    if (totalChars + chunkSize > maxChars) {
      truncated = true;
      break;
    }

    chunks.push({
      id: item.id,
      sourceType: item.sourceType,
      sourceRef: item.sourceRef,
      title: item.title,
      snippet: chunkContent,
      score,
      tags: item.tags,
    });

    totalChars += chunkSize;
    countByType[item.sourceType] = typeCount + 1;
  }

  return { chunks, truncated };
}

/**
 * Generate a system hint for the LLM
 */
function generateSystemHint(query: string, chunks: ContextChunk[]): string {
  if (chunks.length === 0) {
    return 'No relevant context found in the project memory.';
  }

  // Count by source type
  const counts: Record<string, number> = {};
  const types: Set<NeuralSourceType> = new Set();

  for (const chunk of chunks) {
    counts[chunk.sourceType] = (counts[chunk.sourceType] || 0) + 1;
    types.add(chunk.sourceType);
  }

  const parts: string[] = [];

  if (counts.code) {
    parts.push(`${counts.code} code snippet${counts.code > 1 ? 's' : ''}`);
  }
  if (counts.media) {
    parts.push(`${counts.media} UI/media reference${counts.media > 1 ? 's' : ''}`);
  }
  if (counts.project_doc) {
    parts.push(`${counts.project_doc} documentation section${counts.project_doc > 1 ? 's' : ''}`);
  }
  if (counts.test) {
    parts.push(`${counts.test} test${counts.test > 1 ? 's' : ''}`);
  }
  if (counts.chat) {
    parts.push(`${counts.chat} conversation reference${counts.chat > 1 ? 's' : ''}`);
  }
  if (counts.run_log) {
    parts.push(`${counts.run_log} execution log${counts.run_log > 1 ? 's' : ''}`);
  }

  const contextSummary = parts.join(', ');

  return [
    `Context retrieved for: "${query.slice(0, 100)}"`,
    `Found: ${contextSummary}`,
    'Use this context to inform your response. Reference specific files and components when applicable.',
  ].join('\n');
}

/**
 * Format chunks for output
 */
function formatChunks(
  chunks: ContextChunk[],
  format: 'markdown' | 'xml' | 'json',
  includeScores: boolean,
): ContextChunk[] {
  // For now, just return the chunks as-is
  // The actual formatting happens when serializing the context
  return chunks;
}

// =============================================================================
// Context Serializers
// =============================================================================

/**
 * Serialize composed context to markdown
 */
export function contextToMarkdown(context: ComposedContext): string {
  const lines: string[] = [];

  if (context.systemHint) {
    lines.push(`> ${context.systemHint.replace(/\n/g, '\n> ')}`);
    lines.push('');
  }

  // Group by source type
  const byType: Record<string, ContextChunk[]> = {};
  for (const chunk of context.chunks) {
    if (!byType[chunk.sourceType]) {
      byType[chunk.sourceType] = [];
    }
    byType[chunk.sourceType].push(chunk);
  }

  // Output each type
  const typeLabels: Record<NeuralSourceType, string> = {
    code: 'Code Context',
    project_doc: 'Documentation',
    media: 'UI/Media References',
    test: 'Test Context',
    chat: 'Conversation History',
    run_log: 'Execution Logs',
  };

  for (const [type, chunks] of Object.entries(byType)) {
    lines.push(`## ${typeLabels[type as NeuralSourceType] || type}`);
    lines.push('');

    for (const chunk of chunks) {
      lines.push(`### ${chunk.title}`);

      if (chunk.tags && chunk.tags.length > 0) {
        lines.push(`Tags: ${chunk.tags.slice(0, 5).join(', ')}`);
      }

      lines.push('');
      lines.push('```');
      lines.push(chunk.snippet);
      lines.push('```');
      lines.push('');
    }
  }

  if (context.truncated) {
    lines.push('---');
    lines.push('*Context was truncated due to token limits*');
  }

  return lines.join('\n');
}

/**
 * Serialize composed context to XML (for Claude)
 */
export function contextToXml(context: ComposedContext): string {
  const lines: string[] = [];

  lines.push('<neural_context>');

  if (context.systemHint) {
    lines.push(`  <system_hint>${escapeXml(context.systemHint)}</system_hint>`);
  }

  lines.push(`  <query>${escapeXml(context.query)}</query>`);
  lines.push(`  <total_chunks>${context.totalChunks}</total_chunks>`);
  lines.push(`  <truncated>${context.truncated}</truncated>`);

  lines.push('  <chunks>');

  for (const chunk of context.chunks) {
    lines.push('    <chunk>');
    lines.push(`      <id>${chunk.id}</id>`);
    lines.push(`      <source_type>${chunk.sourceType}</source_type>`);
    lines.push(`      <title>${escapeXml(chunk.title)}</title>`);
    lines.push(`      <score>${chunk.score.toFixed(3)}</score>`);

    if (chunk.sourceRef.filePath) {
      lines.push(`      <file_path>${escapeXml(chunk.sourceRef.filePath)}</file_path>`);
    }
    if (chunk.sourceRef.lineStart) {
      lines.push(`      <lines>${chunk.sourceRef.lineStart}-${chunk.sourceRef.lineEnd}</lines>`);
    }

    lines.push(`      <content><![CDATA[${chunk.snippet}]]></content>`);

    if (chunk.tags && chunk.tags.length > 0) {
      lines.push(`      <tags>${chunk.tags.join(',')}</tags>`);
    }

    lines.push('    </chunk>');
  }

  lines.push('  </chunks>');
  lines.push('</neural_context>');

  return lines.join('\n');
}

/**
 * Serialize composed context to JSON
 */
export function contextToJson(context: ComposedContext): string {
  return JSON.stringify(context, null, 2);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// =============================================================================
// Agent-Specific Context Builders
// =============================================================================

/**
 * Build context for PlannerAgent
 */
export async function buildPlannerContext(
  projectId: string,
  taskDescription: string,
  options: ComposeOptions = {},
): Promise<ComposedContext> {
  console.log('[166.4][COMPOSER] Building planner context');

  const results = await multiSourceSearch(projectId, taskDescription, {
    sourceWeights: {
      project_doc: 1.2,
      code: 1.0,
      media: 0.8,
      test: 0.6,
      chat: 0.4,
      run_log: 0.3,
    },
    topK: 15,
  });

  return composeContext(taskDescription, results, {
    ...options,
    maxTokens: options.maxTokens ?? 6000,
    priorityOrder: ['project_doc', 'code', 'media', 'test'],
  });
}

/**
 * Build context for CodeAgent
 */
export async function buildCodeAgentContext(
  projectId: string,
  prompt: string,
  currentFilePath?: string,
  options: ComposeOptions = {},
): Promise<ComposedContext> {
  console.log('[166.4][COMPOSER] Building code agent context');

  const { codeContext, mediaContext, docContext } = await getContextForCodeGen(
    projectId,
    prompt,
    {
      filePath: currentFilePath,
      maxCodeItems: 8,
      maxMediaItems: 3,
      maxDocItems: 2,
    },
  );

  // Combine results
  const allResults: NeuralSearchResultItem[] = [
    ...codeContext,
    ...mediaContext,
    ...docContext,
  ];

  return composeContext(prompt, allResults, {
    ...options,
    maxTokens: options.maxTokens ?? 5000,
    priorityOrder: ['code', 'media', 'project_doc'],
  });
}

/**
 * Build context for Media/UI Builder Agent
 */
export async function buildMediaUIContext(
  projectId: string,
  designPrompt: string,
  options: ComposeOptions = {},
): Promise<ComposedContext> {
  console.log('[166.4][COMPOSER] Building media/UI context');

  const results = await multiSourceSearch(projectId, designPrompt, {
    sourceWeights: {
      media: 1.5,
      code: 0.8,
      project_doc: 0.7,
      test: 0.3,
      chat: 0.2,
      run_log: 0.1,
    },
    topK: 12,
  });

  return composeContext(designPrompt, results, {
    ...options,
    maxTokens: options.maxTokens ?? 4000,
    priorityOrder: ['media', 'code', 'project_doc'],
  });
}

/**
 * Build context for Chat Agent
 */
export async function buildChatContext(
  projectId: string,
  userMessage: string,
  options: ComposeOptions = {},
): Promise<ComposedContext> {
  console.log('[166.4][COMPOSER] Building chat context');

  const results = await multiSourceSearch(projectId, userMessage, {
    sourceWeights: {
      chat: 1.0,
      project_doc: 0.9,
      code: 0.8,
      media: 0.7,
      test: 0.5,
      run_log: 0.4,
    },
    topK: 10,
  });

  return composeContext(userMessage, results, {
    ...options,
    maxTokens: options.maxTokens ?? 3000,
    priorityOrder: ['chat', 'project_doc', 'code', 'media'],
  });
}

// =============================================================================
// Universal Agent Context Builder
// =============================================================================

/**
 * Build context for any agent type
 */
export async function buildAgentContext(
  projectId: string,
  options: AgentContextOptions,
): Promise<{
  context: ComposedContext;
  formatted: string;
}> {
  console.log('[166.4][COMPOSER] Building context for:', options.agentType);

  let context: ComposedContext;

  switch (options.agentType) {
    case 'planner':
      context = await buildPlannerContext(projectId, options.taskDescription, options);
      break;
    case 'code':
      context = await buildCodeAgentContext(
        projectId,
        options.taskDescription,
        options.currentFilePath,
        options,
      );
      break;
    case 'media_ui':
      context = await buildMediaUIContext(projectId, options.taskDescription, options);
      break;
    case 'chat':
      context = await buildChatContext(projectId, options.taskDescription, options);
      break;
    default:
      // Default to multi-source search
      const results = await multiSourceSearch(projectId, options.taskDescription, { topK: 10 });
      context = composeContext(options.taskDescription, results, options);
  }

  // Format based on preference
  const format = options.format ?? 'xml';
  let formatted: string;

  switch (format) {
    case 'markdown':
      formatted = contextToMarkdown(context);
      break;
    case 'json':
      formatted = contextToJson(context);
      break;
    case 'xml':
    default:
      formatted = contextToXml(context);
  }

  return { context, formatted };
}

// =============================================================================
// Quick Context Helpers
// =============================================================================

/**
 * Get quick context string for a query
 */
export async function getQuickContext(
  projectId: string,
  query: string,
  maxTokens = 2000,
): Promise<string> {
  const results = await neuralSearch({
    projectId,
    query,
    topK: 5,
  });

  const context = composeContext(query, results.results, {
    maxTokens,
    format: 'markdown',
  });

  return contextToMarkdown(context);
}

/**
 * Get context as system message for LLM
 */
export async function getSystemContext(
  projectId: string,
  taskDescription: string,
  agentType: 'planner' | 'code' | 'media_ui' | 'chat' = 'code',
): Promise<string> {
  const { formatted } = await buildAgentContext(projectId, {
    agentType,
    taskDescription,
    format: 'xml',
  });

  return formatted;
}

console.log('[166.4][NEURAL_MEMORY] Context Composer loaded');
