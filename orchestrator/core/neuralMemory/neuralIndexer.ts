// orchestrator/core/neuralMemory/neuralIndexer.ts
// =============================================================================
// Phase 166.2 – Neural Indexer (Ingestion Pipeline)
// Indexes Code, Media Memory, Project Docs, Tests, Chat History
// =============================================================================

import {
  NeuralMemoryItem,
  NeuralSourceType,
  NeuralSourceRef,
  BatchIndexRequest,
  BatchIndexResult,
  IndexingJob,
  IndexingJobStatus,
} from './types';

import {
  getDefaultEmbeddingProvider,
  getEmbeddingIndexAdapter,
  getMockProvider,
} from './embeddingProvider';

// =============================================================================
// Constants
// =============================================================================

const MAX_SNIPPET_LENGTH = 400;
const MAX_CONTENT_LENGTH = 2000;
const CHUNK_SIZE = 500; // Characters per chunk for code files

// =============================================================================
// ID Generator
// =============================================================================

function generateNeuralId(prefix = 'nm'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// Text Processing Helpers
// =============================================================================

/**
 * Create a summary snippet from content
 */
function createSnippet(content: string, maxLength = MAX_SNIPPET_LENGTH): string {
  if (content.length <= maxLength) return content;

  // Try to cut at a sentence boundary
  const truncated = content.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');

  const cutPoint = Math.max(lastPeriod, lastNewline);
  if (cutPoint > maxLength * 0.5) {
    return content.slice(0, cutPoint + 1).trim();
  }

  return truncated.trim() + '...';
}

/**
 * Extract tags from content using keyword extraction
 */
function extractTags(content: string, sourceType: NeuralSourceType): string[] {
  const tags: string[] = [sourceType];
  const lowerContent = content.toLowerCase();

  // Common code patterns
  const codePatterns: Record<string, RegExp> = {
    auth: /\b(auth|login|logout|session|jwt|token)\b/,
    api: /\b(api|endpoint|route|fetch|request|response)\b/,
    database: /\b(database|firestore|mongo|sql|query|collection)\b/,
    ui: /\b(component|render|jsx|tsx|button|form|input)\b/,
    test: /\b(test|spec|expect|describe|it\(|jest|mocha)\b/,
    error: /\b(error|catch|throw|exception|fail)\b/,
    config: /\b(config|env|settings|options)\b/,
    hook: /\b(usestate|useeffect|usememo|usecallback|hook)\b/,
    style: /\b(css|style|tailwind|className|styled)\b/,
  };

  for (const [tag, pattern] of Object.entries(codePatterns)) {
    if (pattern.test(lowerContent)) {
      tags.push(tag);
    }
  }

  return [...new Set(tags)];
}

/**
 * Detect programming language from file path or content
 */
function detectLanguage(filePath?: string, content?: string): string | undefined {
  if (filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      kt: 'kotlin',
      swift: 'swift',
      rb: 'ruby',
      php: 'php',
      css: 'css',
      scss: 'scss',
      html: 'html',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
    };
    if (ext && langMap[ext]) {
      return langMap[ext];
    }
  }

  // Content-based detection
  if (content) {
    if (content.includes('import React') || content.includes('from "react"')) {
      return 'typescript';
    }
    if (content.includes('def ') && content.includes(':')) {
      return 'python';
    }
    if (content.includes('func ') && content.includes('package ')) {
      return 'go';
    }
  }

  return undefined;
}

/**
 * Chunk code content into smaller segments
 */
function chunkContent(
  content: string,
  chunkSize = CHUNK_SIZE,
): Array<{ content: string; lineStart: number; lineEnd: number }> {
  const lines = content.split('\n');
  const chunks: Array<{ content: string; lineStart: number; lineEnd: number }> = [];

  let currentChunk = '';
  let lineStart = 1;
  let currentLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (currentChunk.length + line.length > chunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        lineStart,
        lineEnd: currentLine,
      });
      currentChunk = '';
      lineStart = i + 1;
    }

    currentChunk += line + '\n';
    currentLine = i + 1;
  }

  // Add remaining content
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      lineStart,
      lineEnd: currentLine,
    });
  }

  return chunks;
}

// =============================================================================
// Main Indexing Functions
// =============================================================================

/**
 * Index a Media Memory Node from Phase 165
 */
export async function indexMediaMemoryNode(
  mediaNode: {
    id: string;
    projectId: string;
    summary: string;
    layoutTypes: string[];
    entities: string[];
    components: string[];
    tags: Array<{ key: string; value: string }>;
    title?: string;
    kind?: string;
  },
): Promise<NeuralMemoryItem> {
  console.log('[166.2][INDEXER] Indexing media memory node:', mediaNode.id);

  const provider = getDefaultEmbeddingProvider();
  const adapter = getEmbeddingIndexAdapter();

  // Build combined content for embedding
  const contentParts = [
    mediaNode.summary,
    mediaNode.title || '',
    mediaNode.layoutTypes.join(' '),
    mediaNode.entities.join(' '),
    mediaNode.components.join(' '),
  ].filter(Boolean);

  const fullContent = contentParts.join('\n');

  // Generate embedding
  const [embedding] = await provider.embedTexts([fullContent]);

  // Build tags
  const tags = [
    'media',
    mediaNode.kind || 'image',
    ...mediaNode.layoutTypes,
    ...mediaNode.tags.map(t => t.value),
  ];

  const now = Date.now();
  const item: NeuralMemoryItem = {
    id: generateNeuralId('nm_media'),
    projectId: mediaNode.projectId,
    sourceType: 'media',
    sourceRef: {
      projectId: mediaNode.projectId,
      mediaMemoryId: mediaNode.id,
    },
    title: mediaNode.title || `Media: ${mediaNode.layoutTypes.join(', ')}`,
    snippet: createSnippet(mediaNode.summary),
    fullContent: fullContent.slice(0, MAX_CONTENT_LENGTH),
    tags: [...new Set(tags)],
    embeddingVector: embedding,
    embeddingModel: provider.modelName,
    fileType: mediaNode.kind || 'image',
    createdAt: now,
    updatedAt: now,
  };

  // Store in index
  await adapter.upsertItems([item]);

  // Also update mock provider for in-memory search
  getMockProvider().setItems([item]);

  console.log('[166.2][INDEXER] Media memory indexed:', item.id);
  return item;
}

/**
 * Index a code file (chunked)
 */
export async function indexCodeFile(
  projectId: string,
  filePath: string,
  content: string,
): Promise<NeuralMemoryItem[]> {
  console.log('[166.2][INDEXER] Indexing code file:', filePath);

  const provider = getDefaultEmbeddingProvider();
  const adapter = getEmbeddingIndexAdapter();

  const chunks = chunkContent(content);
  const language = detectLanguage(filePath, content);
  const now = Date.now();

  const items: NeuralMemoryItem[] = [];

  // Generate embeddings for all chunks at once
  const embeddings = await provider.embedTexts(chunks.map(c => c.content));

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const tags = extractTags(chunk.content, 'code');
    if (language) tags.push(language);

    const item: NeuralMemoryItem = {
      id: generateNeuralId('nm_code'),
      projectId,
      sourceType: 'code',
      sourceRef: {
        projectId,
        filePath,
        segmentId: `chunk_${i}`,
        lineStart: chunk.lineStart,
        lineEnd: chunk.lineEnd,
      },
      title: `${filePath}:${chunk.lineStart}-${chunk.lineEnd}`,
      snippet: createSnippet(chunk.content),
      fullContent: chunk.content.slice(0, MAX_CONTENT_LENGTH),
      tags,
      embeddingVector: embeddings[i],
      embeddingModel: provider.modelName,
      language,
      fileType: filePath.split('.').pop(),
      tokenCount: Math.ceil(chunk.content.length / 4), // Rough estimate
      createdAt: now,
      updatedAt: now,
    };

    items.push(item);
  }

  // Store all items
  await adapter.upsertItems(items);
  getMockProvider().setItems(items);

  console.log('[166.2][INDEXER] Code file indexed:', filePath, `(${items.length} chunks)`);
  return items;
}

/**
 * Index a single code chunk
 */
export async function indexCodeFileChunk(
  projectId: string,
  filePath: string,
  content: string,
  segmentId: string,
  lineStart?: number,
  lineEnd?: number,
): Promise<NeuralMemoryItem> {
  console.log('[166.2][INDEXER] Indexing code chunk:', filePath, segmentId);

  const provider = getDefaultEmbeddingProvider();
  const adapter = getEmbeddingIndexAdapter();

  const language = detectLanguage(filePath, content);
  const tags = extractTags(content, 'code');
  if (language) tags.push(language);

  const [embedding] = await provider.embedTexts([content]);
  const now = Date.now();

  const item: NeuralMemoryItem = {
    id: generateNeuralId('nm_code'),
    projectId,
    sourceType: 'code',
    sourceRef: {
      projectId,
      filePath,
      segmentId,
      lineStart,
      lineEnd,
    },
    title: lineStart ? `${filePath}:${lineStart}-${lineEnd}` : `${filePath}#${segmentId}`,
    snippet: createSnippet(content),
    fullContent: content.slice(0, MAX_CONTENT_LENGTH),
    tags,
    embeddingVector: embedding,
    embeddingModel: provider.modelName,
    language,
    fileType: filePath.split('.').pop(),
    tokenCount: Math.ceil(content.length / 4),
    createdAt: now,
    updatedAt: now,
  };

  await adapter.upsertItems([item]);
  getMockProvider().setItems([item]);

  console.log('[166.2][INDEXER] Code chunk indexed:', item.id);
  return item;
}

/**
 * Index a project document
 */
export async function indexProjectDoc(
  projectId: string,
  docId: string,
  title: string,
  body: string,
  tags: string[] = [],
): Promise<NeuralMemoryItem> {
  console.log('[166.2][INDEXER] Indexing project doc:', docId);

  const provider = getDefaultEmbeddingProvider();
  const adapter = getEmbeddingIndexAdapter();

  const content = `${title}\n\n${body}`;
  const [embedding] = await provider.embedTexts([content]);
  const now = Date.now();

  const extractedTags = extractTags(body, 'project_doc');

  const item: NeuralMemoryItem = {
    id: generateNeuralId('nm_doc'),
    projectId,
    sourceType: 'project_doc',
    sourceRef: {
      projectId,
      docId,
    },
    title,
    snippet: createSnippet(body),
    fullContent: body.slice(0, MAX_CONTENT_LENGTH),
    tags: [...new Set([...tags, ...extractedTags])],
    embeddingVector: embedding,
    embeddingModel: provider.modelName,
    fileType: 'markdown',
    tokenCount: Math.ceil(content.length / 4),
    createdAt: now,
    updatedAt: now,
  };

  await adapter.upsertItems([item]);
  getMockProvider().setItems([item]);

  console.log('[166.2][INDEXER] Project doc indexed:', item.id);
  return item;
}

/**
 * Index a test file or test result
 */
export async function indexTestResult(
  projectId: string,
  testId: string,
  testName: string,
  content: string,
  status: 'pass' | 'fail' | 'skip',
  filePath?: string,
): Promise<NeuralMemoryItem> {
  console.log('[166.2][INDEXER] Indexing test:', testId, status);

  const provider = getDefaultEmbeddingProvider();
  const adapter = getEmbeddingIndexAdapter();

  const [embedding] = await provider.embedTexts([content]);
  const now = Date.now();

  const tags = ['test', status];
  if (filePath) {
    const language = detectLanguage(filePath);
    if (language) tags.push(language);
  }

  const item: NeuralMemoryItem = {
    id: generateNeuralId('nm_test'),
    projectId,
    sourceType: 'test',
    sourceRef: {
      projectId,
      testId,
      filePath,
    },
    title: testName,
    snippet: createSnippet(content),
    fullContent: content.slice(0, MAX_CONTENT_LENGTH),
    tags,
    embeddingVector: embedding,
    embeddingModel: provider.modelName,
    language: filePath ? detectLanguage(filePath) : undefined,
    createdAt: now,
    updatedAt: now,
  };

  await adapter.upsertItems([item]);
  getMockProvider().setItems([item]);

  console.log('[166.2][INDEXER] Test indexed:', item.id);
  return item;
}

/**
 * Index a chat message or conversation turn
 */
export async function indexChatTurn(
  projectId: string,
  chatId: string,
  turnId: string,
  role: 'user' | 'assistant',
  content: string,
  tags: string[] = [],
): Promise<NeuralMemoryItem> {
  console.log('[166.2][INDEXER] Indexing chat turn:', chatId, turnId);

  const provider = getDefaultEmbeddingProvider();
  const adapter = getEmbeddingIndexAdapter();

  const [embedding] = await provider.embedTexts([content]);
  const now = Date.now();

  const extractedTags = extractTags(content, 'chat');

  const item: NeuralMemoryItem = {
    id: generateNeuralId('nm_chat'),
    projectId,
    sourceType: 'chat',
    sourceRef: {
      projectId,
      chatId,
      segmentId: turnId,
    },
    title: `${role}: ${content.slice(0, 50)}...`,
    snippet: createSnippet(content),
    fullContent: content.slice(0, MAX_CONTENT_LENGTH),
    tags: [...new Set(['chat', role, ...tags, ...extractedTags])],
    embeddingVector: embedding,
    embeddingModel: provider.modelName,
    createdAt: now,
    updatedAt: now,
  };

  await adapter.upsertItems([item]);
  getMockProvider().setItems([item]);

  console.log('[166.2][INDEXER] Chat turn indexed:', item.id);
  return item;
}

/**
 * Index an execution/run log
 */
export async function indexRunLog(
  projectId: string,
  runId: string,
  title: string,
  logContent: string,
  status: 'success' | 'error' | 'running',
): Promise<NeuralMemoryItem> {
  console.log('[166.2][INDEXER] Indexing run log:', runId, status);

  const provider = getDefaultEmbeddingProvider();
  const adapter = getEmbeddingIndexAdapter();

  const [embedding] = await provider.embedTexts([logContent]);
  const now = Date.now();

  const tags = ['run_log', status];
  if (status === 'error') tags.push('error');

  const item: NeuralMemoryItem = {
    id: generateNeuralId('nm_log'),
    projectId,
    sourceType: 'run_log',
    sourceRef: {
      projectId,
      docId: runId,
    },
    title,
    snippet: createSnippet(logContent),
    fullContent: logContent.slice(0, MAX_CONTENT_LENGTH),
    tags,
    embeddingVector: embedding,
    embeddingModel: provider.modelName,
    createdAt: now,
    updatedAt: now,
  };

  await adapter.upsertItems([item]);
  getMockProvider().setItems([item]);

  console.log('[166.2][INDEXER] Run log indexed:', item.id);
  return item;
}

// =============================================================================
// Batch Indexing
// =============================================================================

/**
 * Batch index multiple items
 */
export async function batchIndex(request: BatchIndexRequest): Promise<BatchIndexResult> {
  console.log('[166.2][INDEXER] Batch indexing:', request.sourceType, request.items.length, 'items');

  const provider = getDefaultEmbeddingProvider();
  const adapter = getEmbeddingIndexAdapter();

  const indexed: NeuralMemoryItem[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  const now = Date.now();

  // Generate embeddings for all items at once
  const texts = request.items.map(item => `${item.title}\n\n${item.content}`);
  let embeddings: number[][] = [];

  try {
    embeddings = await provider.embedTexts(texts);
  } catch (err) {
    console.error('[166.2][INDEXER] Batch embedding failed:', err);
    return {
      indexed: 0,
      failed: request.items.length,
      errors: request.items.map((_, i) => ({ index: i, error: 'Embedding generation failed' })),
      itemIds: [],
    };
  }

  // Create items
  for (let i = 0; i < request.items.length; i++) {
    try {
      const reqItem = request.items[i];
      const tags = extractTags(reqItem.content, request.sourceType);
      if (reqItem.tags) tags.push(...reqItem.tags);

      const item: NeuralMemoryItem = {
        id: generateNeuralId(`nm_${request.sourceType}`),
        projectId: request.projectId,
        sourceType: request.sourceType,
        sourceRef: {
          projectId: request.projectId,
          ...reqItem.sourceRef,
        },
        title: reqItem.title,
        snippet: createSnippet(reqItem.content),
        fullContent: reqItem.content.slice(0, MAX_CONTENT_LENGTH),
        tags: [...new Set(tags)],
        embeddingVector: embeddings[i],
        embeddingModel: provider.modelName,
        createdAt: now,
        updatedAt: now,
      };

      indexed.push(item);
    } catch (err) {
      errors.push({
        index: i,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Store all successful items
  if (indexed.length > 0) {
    await adapter.upsertItems(indexed);
    getMockProvider().setItems(indexed);
  }

  console.log('[166.2][INDEXER] Batch complete:', indexed.length, 'indexed,', errors.length, 'failed');

  return {
    indexed: indexed.length,
    failed: errors.length,
    errors,
    itemIds: indexed.map(i => i.id),
  };
}

// =============================================================================
// Index Management
// =============================================================================

/**
 * Delete items from the index
 */
export async function deleteFromIndex(ids: string[]): Promise<void> {
  console.log('[166.2][INDEXER] Deleting items:', ids.length);

  const adapter = getEmbeddingIndexAdapter();
  await adapter.deleteItems(ids);
  getMockProvider().deleteItemsFromIndex(ids);

  console.log('[166.2][INDEXER] Items deleted');
}

/**
 * Delete all items for a file path
 */
export async function deleteFileFromIndex(projectId: string, filePath: string): Promise<void> {
  console.log('[166.2][INDEXER] Deleting file from index:', filePath);

  const adapter = getEmbeddingIndexAdapter();
  const items = await adapter.listItems(projectId, 1000);

  const toDelete = items
    .filter(item => item.sourceRef.filePath === filePath)
    .map(item => item.id);

  if (toDelete.length > 0) {
    await adapter.deleteItems(toDelete);
    getMockProvider().deleteItemsFromIndex(toDelete);
  }

  console.log('[166.2][INDEXER] File deleted:', filePath, `(${toDelete.length} items)`);
}

/**
 * Re-index a file (delete + index)
 */
export async function reindexCodeFile(
  projectId: string,
  filePath: string,
  content: string,
): Promise<NeuralMemoryItem[]> {
  await deleteFileFromIndex(projectId, filePath);
  return indexCodeFile(projectId, filePath, content);
}

// =============================================================================
// Job Tracking (for UI progress)
// =============================================================================

const activeJobs = new Map<string, IndexingJob>();

/**
 * Create an indexing job
 */
export function createIndexingJob(
  projectId: string,
  sourceType: NeuralSourceType,
  totalItems: number,
): IndexingJob {
  const job: IndexingJob = {
    id: generateNeuralId('job'),
    projectId,
    sourceType,
    status: 'pending',
    itemsProcessed: 0,
    totalItems,
    startedAt: Date.now(),
  };

  activeJobs.set(job.id, job);
  return job;
}

/**
 * Update job progress
 */
export function updateJobProgress(
  jobId: string,
  itemsProcessed: number,
  status?: IndexingJobStatus,
  errorMessage?: string,
): IndexingJob | null {
  const job = activeJobs.get(jobId);
  if (!job) return null;

  job.itemsProcessed = itemsProcessed;
  if (status) job.status = status;
  if (errorMessage) job.errorMessage = errorMessage;
  if (status === 'done' || status === 'error') {
    job.completedAt = Date.now();
  }

  return job;
}

/**
 * Get job status
 */
export function getJobStatus(jobId: string): IndexingJob | null {
  return activeJobs.get(jobId) || null;
}

/**
 * List active jobs for a project
 */
export function listActiveJobs(projectId: string): IndexingJob[] {
  return Array.from(activeJobs.values())
    .filter(j => j.projectId === projectId && j.status !== 'done');
}

console.log('[166.2][NEURAL_MEMORY] Neural Indexer loaded');
