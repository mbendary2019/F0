// src/app/api/neural/search/route.ts
// =============================================================================
// Phase 166.6 – Neural Search API
// POST: Search neural memory with query
// GET: Get index stats
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initFirebaseAdmin } from '@/lib/server/firebase';

// Initialize Firebase
initFirebaseAdmin();
const db = getFirestore();

// =============================================================================
// Types (mirrored from orchestrator for API route)
// =============================================================================

type NeuralSourceType = 'code' | 'project_doc' | 'media' | 'test' | 'run_log' | 'chat';

interface NeuralSearchFilter {
  projectId: string;
  sourceTypes?: NeuralSourceType[];
  tags?: string[];
  language?: string;
  minScore?: number;
  maxResults?: number;
  excludeIds?: string[];
}

interface NeuralSearchRequest {
  projectId: string;
  query: string;
  topK?: number;
  filters?: Partial<NeuralSearchFilter>;
  includeContext?: boolean;
  agentType?: 'planner' | 'code' | 'media_ui' | 'chat';
  format?: 'json' | 'markdown' | 'xml';
}

interface NeuralMemoryItem {
  id: string;
  projectId: string;
  sourceType: NeuralSourceType;
  sourceRef: {
    projectId: string;
    filePath?: string;
    docId?: string;
    mediaMemoryId?: string;
    testId?: string;
    chatId?: string;
    segmentId?: string;
    lineStart?: number;
    lineEnd?: number;
  };
  title: string;
  snippet: string;
  fullContent?: string;
  tags: string[];
  embeddingVector?: number[];
  embeddingModel?: string;
  language?: string;
  fileType?: string;
  tokenCount?: number;
  createdAt: number;
  updatedAt: number;
}

interface SearchResult {
  item: NeuralMemoryItem;
  score: number;
  matchReason?: string;
}

// =============================================================================
// Mock Embedding & Search (inline for API route)
// =============================================================================

const NEURAL_ITEMS_COLLECTION = 'neuralMemoryItems';

function generateMockEmbedding(text: string): number[] {
  const dimensions = 384;
  const embedding = new Array(dimensions).fill(0);
  const words = text.toLowerCase().split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (let j = 0; j < word.length; j++) {
      const idx = (word.charCodeAt(j) + i * 7 + j * 13) % dimensions;
      embedding[idx] += 1 / (1 + Math.log(words.length));
    }
  }

  const magnitude = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
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

async function searchItems(
  projectId: string,
  query: string,
  topK: number,
  filters?: Partial<NeuralSearchFilter>,
): Promise<SearchResult[]> {
  // Get items from Firestore
  const snap = await db
    .collection(NEURAL_ITEMS_COLLECTION)
    .where('projectId', '==', projectId)
    .limit(500)
    .get();

  let items = snap.docs.map(doc => doc.data() as NeuralMemoryItem);

  // Apply filters
  if (filters?.sourceTypes && filters.sourceTypes.length > 0) {
    items = items.filter(item => filters.sourceTypes!.includes(item.sourceType));
  }

  if (filters?.tags && filters.tags.length > 0) {
    items = items.filter(item =>
      filters.tags!.some(t => item.tags.includes(t))
    );
  }

  if (filters?.language) {
    items = items.filter(item => item.language === filters.language);
  }

  if (filters?.excludeIds && filters.excludeIds.length > 0) {
    items = items.filter(item => !filters.excludeIds!.includes(item.id));
  }

  // Generate query embedding
  const queryEmbedding = generateMockEmbedding(query);

  // Calculate similarity scores
  const results: SearchResult[] = items.map(item => {
    const itemEmbedding = item.embeddingVector || generateMockEmbedding(item.snippet);
    const score = cosineSimilarity(queryEmbedding, itemEmbedding);

    return {
      item,
      score,
      matchReason: generateMatchReason(query, item),
    };
  });

  // Filter by min score
  const minScore = filters?.minScore ?? 0.2;
  const filtered = results.filter(r => r.score >= minScore);

  // Sort by score and return top K
  filtered.sort((a, b) => b.score - a.score);
  return filtered.slice(0, topK);
}

function generateMatchReason(query: string, item: NeuralMemoryItem): string {
  const queryWords = query.toLowerCase().split(/\s+/);
  const titleWords = item.title.toLowerCase().split(/\s+/);
  const snippetWords = item.snippet.toLowerCase().split(/\s+/);

  const matchedInTitle = queryWords.filter(w => titleWords.some(tw => tw.includes(w)));
  const matchedInSnippet = queryWords.filter(w => snippetWords.some(sw => sw.includes(w)));
  const matchedTags = queryWords.filter(w => item.tags.some(t => t.toLowerCase().includes(w)));

  const reasons: string[] = [];

  if (matchedInTitle.length > 0) {
    reasons.push(`title contains "${matchedInTitle.slice(0, 2).join(', ')}"`);
  }
  if (matchedInSnippet.length > 0) {
    reasons.push(`content matches "${matchedInSnippet.slice(0, 2).join(', ')}"`);
  }
  if (matchedTags.length > 0) {
    reasons.push(`tagged with ${matchedTags.join(', ')}`);
  }
  if (item.sourceType === 'code' && item.language) {
    reasons.push(`${item.language} code`);
  }

  return reasons.length > 0 ? reasons.join('; ') : 'semantic similarity';
}

// =============================================================================
// Context Formatting
// =============================================================================

function formatContextMarkdown(query: string, results: SearchResult[]): string {
  const lines: string[] = [];

  lines.push(`> Context for: "${query.slice(0, 100)}"`);
  lines.push(`> Found ${results.length} relevant items`);
  lines.push('');

  // Group by source type
  const byType: Record<string, SearchResult[]> = {};
  for (const r of results) {
    const type = r.item.sourceType;
    if (!byType[type]) byType[type] = [];
    byType[type].push(r);
  }

  const typeLabels: Record<NeuralSourceType, string> = {
    code: 'Code Context',
    project_doc: 'Documentation',
    media: 'UI/Media References',
    test: 'Test Context',
    chat: 'Conversation History',
    run_log: 'Execution Logs',
  };

  for (const [type, items] of Object.entries(byType)) {
    lines.push(`## ${typeLabels[type as NeuralSourceType] || type}`);
    lines.push('');

    for (const r of items) {
      lines.push(`### ${r.item.title} (score: ${r.score.toFixed(2)})`);
      if (r.item.tags.length > 0) {
        lines.push(`Tags: ${r.item.tags.slice(0, 5).join(', ')}`);
      }
      lines.push('');
      lines.push('```');
      lines.push(r.item.snippet);
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

function formatContextXml(query: string, results: SearchResult[]): string {
  const escape = (str: string) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines: string[] = [];

  lines.push('<neural_context>');
  lines.push(`  <query>${escape(query)}</query>`);
  lines.push(`  <total_results>${results.length}</total_results>`);
  lines.push('  <results>');

  for (const r of results) {
    lines.push('    <result>');
    lines.push(`      <id>${r.item.id}</id>`);
    lines.push(`      <source_type>${r.item.sourceType}</source_type>`);
    lines.push(`      <title>${escape(r.item.title)}</title>`);
    lines.push(`      <score>${r.score.toFixed(3)}</score>`);
    if (r.item.sourceRef.filePath) {
      lines.push(`      <file_path>${escape(r.item.sourceRef.filePath)}</file_path>`);
    }
    lines.push(`      <content><![CDATA[${r.item.snippet}]]></content>`);
    lines.push(`      <tags>${r.item.tags.join(',')}</tags>`);
    lines.push('    </result>');
  }

  lines.push('  </results>');
  lines.push('</neural_context>');

  return lines.join('\n');
}

// =============================================================================
// POST: Search Neural Memory
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[166.6][API] POST /api/neural/search');

  try {
    const body = await request.json() as NeuralSearchRequest;
    const {
      projectId,
      query,
      topK = 10,
      filters,
      includeContext = false,
      agentType,
      format = 'json',
    } = body;

    // Validation
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    // Adjust search based on agent type
    let searchFilters = { ...filters };
    let adjustedTopK = Math.min(topK, 50);

    if (agentType === 'planner') {
      adjustedTopK = Math.min(topK, 15);
      // Prioritize docs and code for planning
    } else if (agentType === 'code') {
      searchFilters.sourceTypes = searchFilters.sourceTypes || ['code', 'media', 'project_doc'];
      adjustedTopK = Math.min(topK, 12);
    } else if (agentType === 'media_ui') {
      searchFilters.sourceTypes = searchFilters.sourceTypes || ['media', 'code', 'project_doc'];
      adjustedTopK = Math.min(topK, 10);
    } else if (agentType === 'chat') {
      adjustedTopK = Math.min(topK, 8);
    }

    // Search
    const results = await searchItems(projectId, query, adjustedTopK, searchFilters);

    const searchTimeMs = Date.now() - startTime;

    // Build response
    const response: {
      success: boolean;
      query: string;
      results: SearchResult[];
      totalFound: number;
      searchTimeMs: number;
      context?: string;
    } = {
      success: true,
      query,
      results: results.map(r => ({
        item: {
          ...r.item,
          embeddingVector: undefined, // Don't send embeddings in response
        },
        score: r.score,
        matchReason: r.matchReason,
      })),
      totalFound: results.length,
      searchTimeMs,
    };

    // Include formatted context if requested
    if (includeContext) {
      if (format === 'markdown') {
        response.context = formatContextMarkdown(query, results);
      } else if (format === 'xml') {
        response.context = formatContextXml(query, results);
      }
    }

    console.log('[166.6][API] Search complete:', results.length, 'results in', searchTimeMs, 'ms');

    return NextResponse.json(response);
  } catch (error) {
    console.error('[166.6][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

// =============================================================================
// GET: Get Index Stats or List Items
// =============================================================================

export async function GET(request: NextRequest) {
  console.log('[166.6][API] GET /api/neural/search');

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const action = searchParams.get('action') || 'stats';
    const sourceType = searchParams.get('sourceType') as NeuralSourceType | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    if (action === 'list') {
      // List items
      let query = db
        .collection(NEURAL_ITEMS_COLLECTION)
        .where('projectId', '==', projectId);

      if (sourceType) {
        query = query.where('sourceType', '==', sourceType);
      }

      const snap = await query.orderBy('updatedAt', 'desc').limit(limit).get();
      const items = snap.docs.map(doc => {
        const data = doc.data() as NeuralMemoryItem;
        return {
          ...data,
          embeddingVector: undefined, // Don't send embeddings
        };
      });

      return NextResponse.json({
        success: true,
        items,
        total: items.length,
      });
    }

    // Default: Get stats
    const snap = await db
      .collection(NEURAL_ITEMS_COLLECTION)
      .where('projectId', '==', projectId)
      .get();

    const items = snap.docs.map(doc => doc.data() as NeuralMemoryItem);

    const bySourceType: Record<NeuralSourceType, number> = {
      code: 0,
      project_doc: 0,
      media: 0,
      test: 0,
      run_log: 0,
      chat: 0,
    };

    const byLanguage: Record<string, number> = {};
    let lastIndexedAt = 0;

    for (const item of items) {
      bySourceType[item.sourceType]++;
      if (item.language) {
        byLanguage[item.language] = (byLanguage[item.language] || 0) + 1;
      }
      if (item.updatedAt > lastIndexedAt) {
        lastIndexedAt = item.updatedAt;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        projectId,
        totalItems: items.length,
        bySourceType,
        byLanguage,
        lastIndexedAt,
      },
    });
  } catch (error) {
    console.error('[166.6][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
