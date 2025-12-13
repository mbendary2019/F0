// src/app/api/neural/index/route.ts
// =============================================================================
// Phase 166.6 – Neural Index API
// POST: Index new items (code, doc, media, test, chat)
// DELETE: Remove items from index
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initFirebaseAdmin } from '@/lib/server/firebase';

export const dynamic = 'force-dynamic';

// Initialize Firebase
initFirebaseAdmin();
const db = getFirestore();

// =============================================================================
// Types
// =============================================================================

type NeuralSourceType = 'code' | 'project_doc' | 'media' | 'test' | 'run_log' | 'chat';

interface NeuralSourceRef {
  projectId: string;
  filePath?: string;
  docId?: string;
  mediaMemoryId?: string;
  testId?: string;
  chatId?: string;
  segmentId?: string;
  lineStart?: number;
  lineEnd?: number;
}

interface NeuralMemoryItem {
  id: string;
  projectId: string;
  sourceType: NeuralSourceType;
  sourceRef: NeuralSourceRef;
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

interface IndexRequest {
  projectId: string;
  sourceType: NeuralSourceType;
  items: Array<{
    title: string;
    content: string;
    sourceRef?: Partial<NeuralSourceRef>;
    tags?: string[];
    language?: string;
    filePath?: string;
    lineStart?: number;
    lineEnd?: number;
  }>;
}

// =============================================================================
// Constants
// =============================================================================

const NEURAL_ITEMS_COLLECTION = 'neuralMemoryItems';
const MAX_SNIPPET_LENGTH = 400;
const MAX_CONTENT_LENGTH = 2000;

// =============================================================================
// Helpers
// =============================================================================

function generateId(prefix = 'nm'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createSnippet(content: string, maxLength = MAX_SNIPPET_LENGTH): string {
  if (content.length <= maxLength) return content;
  const truncated = content.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const cutPoint = Math.max(lastPeriod, lastNewline);
  if (cutPoint > maxLength * 0.5) {
    return content.slice(0, cutPoint + 1).trim();
  }
  return truncated.trim() + '...';
}

function extractTags(content: string, sourceType: NeuralSourceType): string[] {
  const tags: string[] = [sourceType];
  const lowerContent = content.toLowerCase();

  const patterns: Record<string, RegExp> = {
    auth: /\b(auth|login|logout|session|jwt|token)\b/,
    api: /\b(api|endpoint|route|fetch|request|response)\b/,
    database: /\b(database|firestore|mongo|sql|query|collection)\b/,
    ui: /\b(component|render|jsx|tsx|button|form|input)\b/,
    test: /\b(test|spec|expect|describe|it\(|jest)\b/,
    error: /\b(error|catch|throw|exception|fail)\b/,
    config: /\b(config|env|settings|options)\b/,
    hook: /\b(usestate|useeffect|usememo|usecallback)\b/,
    style: /\b(css|style|tailwind|classname|styled)\b/,
  };

  for (const [tag, pattern] of Object.entries(patterns)) {
    if (pattern.test(lowerContent)) {
      tags.push(tag);
    }
  }

  return [...new Set(tags)];
}

function detectLanguage(filePath?: string): string | undefined {
  if (!filePath) return undefined;
  const ext = filePath.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    py: 'python', go: 'go', rs: 'rust',
    java: 'java', kt: 'kotlin', swift: 'swift',
    rb: 'ruby', php: 'php', css: 'css',
    scss: 'scss', html: 'html', json: 'json',
    yaml: 'yaml', yml: 'yaml', md: 'markdown',
  };
  return ext ? langMap[ext] : undefined;
}

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

// =============================================================================
// POST: Index Items
// =============================================================================

export async function POST(request: NextRequest) {
  console.log('[166.6][API] POST /api/neural/index');

  try {
    const body = await request.json() as IndexRequest;
    const { projectId, sourceType, items } = body;

    // Validation
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    if (!sourceType) {
      return NextResponse.json({ error: 'sourceType is required' }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    const now = Date.now();
    const indexed: NeuralMemoryItem[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    const batch = db.batch();

    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        const content = `${item.title}\n\n${item.content}`;
        const embedding = generateMockEmbedding(content);
        const tags = extractTags(item.content, sourceType);
        if (item.tags) tags.push(...item.tags);

        const language = item.language || detectLanguage(item.filePath);

        const neuralItem: NeuralMemoryItem = {
          id: generateId(`nm_${sourceType}`),
          projectId,
          sourceType,
          sourceRef: {
            projectId,
            ...item.sourceRef,
            filePath: item.filePath,
            lineStart: item.lineStart,
            lineEnd: item.lineEnd,
          },
          title: item.title,
          snippet: createSnippet(item.content),
          fullContent: item.content.slice(0, MAX_CONTENT_LENGTH),
          tags: [...new Set(tags)],
          embeddingVector: embedding,
          embeddingModel: 'mock-embeddings-v1',
          language,
          fileType: item.filePath?.split('.').pop(),
          tokenCount: Math.ceil(item.content.length / 4),
          createdAt: now,
          updatedAt: now,
        };

        const ref = db.collection(NEURAL_ITEMS_COLLECTION).doc(neuralItem.id);
        batch.set(ref, neuralItem);
        indexed.push(neuralItem);
      } catch (err) {
        errors.push({
          index: i,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Commit batch
    if (indexed.length > 0) {
      await batch.commit();
    }

    console.log('[166.6][API] Indexed:', indexed.length, 'items, errors:', errors.length);

    return NextResponse.json({
      success: true,
      indexed: indexed.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      itemIds: indexed.map(i => i.id),
    });
  } catch (error) {
    console.error('[166.6][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

// =============================================================================
// DELETE: Remove Items from Index
// =============================================================================

export async function DELETE(request: NextRequest) {
  console.log('[166.6][API] DELETE /api/neural/index');

  try {
    const body = await request.json();
    const { projectId, ids, filePath, sourceType } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    let toDelete: string[] = [];

    if (ids && ids.length > 0) {
      // Delete specific IDs
      toDelete = ids;
    } else if (filePath) {
      // Delete all items for a file path
      const snap = await db
        .collection(NEURAL_ITEMS_COLLECTION)
        .where('projectId', '==', projectId)
        .where('sourceRef.filePath', '==', filePath)
        .get();
      toDelete = snap.docs.map(d => d.id);
    } else if (sourceType) {
      // Delete all items of a source type
      const snap = await db
        .collection(NEURAL_ITEMS_COLLECTION)
        .where('projectId', '==', projectId)
        .where('sourceType', '==', sourceType)
        .get();
      toDelete = snap.docs.map(d => d.id);
    } else {
      return NextResponse.json(
        { error: 'Must provide ids, filePath, or sourceType' },
        { status: 400 },
      );
    }

    if (toDelete.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: 'No items found to delete',
      });
    }

    // Delete in batches of 500
    const batchSize = 500;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = db.batch();
      const chunk = toDelete.slice(i, i + batchSize);
      for (const id of chunk) {
        batch.delete(db.collection(NEURAL_ITEMS_COLLECTION).doc(id));
      }
      await batch.commit();
    }

    console.log('[166.6][API] Deleted:', toDelete.length, 'items');

    return NextResponse.json({
      success: true,
      deleted: toDelete.length,
      deletedIds: toDelete,
    });
  } catch (error) {
    console.error('[166.6][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
