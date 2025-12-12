// src/app/api/media/memory/route.ts
// =============================================================================
// Phase 165.5 – Media Memory API
// GET: List/search memory nodes
// POST: Create memory node manually
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initFirebaseAdmin } from '@/lib/server/firebase';

// Initialize Firebase
initFirebaseAdmin();
const db = getFirestore();

// =============================================================================
// Types (mirrored from orchestrator)
// =============================================================================

type MediaMemoryKind = 'image' | 'pdf' | 'audio';

interface MediaMemoryTag {
  key: string;
  value: string;
  source: 'auto' | 'user' | 'agent';
  confidence?: number;
}

interface MediaMemoryStyleHints {
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  shadowLevel?: 0 | 1 | 2 | 3;
  spacing?: 'tight' | 'normal' | 'roomy';
  theme?: 'light' | 'dark' | 'auto';
}

interface MediaMemoryNode {
  id: string;
  projectId: string;
  attachmentId: string;
  preprocessJobId: string;
  kind: MediaMemoryKind;
  title?: string;
  summary: string;
  layoutTypes: string[];
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColors: string[];
  styleHints: MediaMemoryStyleHints;
  entities: string[];
  components: string[];
  tags: MediaMemoryTag[];
  createdAt: number;
  updatedAt: number;
  conversationId?: string;
  turnId?: string;
  createdBy?: string;
}

interface MediaMemorySearchResult {
  node: MediaMemoryNode;
  score: number;
  matchedOn: string[];
}

// =============================================================================
// Helpers
// =============================================================================

function generateId(prefix = 'mem'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// GET: List/Search Memory Nodes
// =============================================================================

export async function GET(request: NextRequest) {
  console.log('[165.5][API] GET /api/media/memory');

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const kind = searchParams.get('kind') as MediaMemoryKind | null;
    const layoutTypes = searchParams.get('layoutTypes')?.split(',').filter(Boolean);
    const entities = searchParams.get('entities')?.split(',').filter(Boolean);
    const components = searchParams.get('components')?.split(',').filter(Boolean);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const attachmentId = searchParams.get('attachmentId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // If attachmentId provided, get specific node
    if (attachmentId) {
      const snap = await db
        .collection('mediaMemoryNodes')
        .where('projectId', '==', projectId)
        .where('attachmentId', '==', attachmentId)
        .limit(1)
        .get();

      if (snap.empty) {
        return NextResponse.json({
          success: true,
          node: null,
          message: 'No memory node found for this attachment',
        });
      }

      return NextResponse.json({
        success: true,
        node: snap.docs[0].data() as MediaMemoryNode,
      });
    }

    // Build query
    let query = db
      .collection('mediaMemoryNodes')
      .where('projectId', '==', projectId);

    if (kind) {
      query = query.where('kind', '==', kind);
    }

    // Firestore supports only one array-contains-any, so we pick layoutTypes first
    if (layoutTypes && layoutTypes.length > 0) {
      query = query.where('layoutTypes', 'array-contains-any', layoutTypes.slice(0, 10));
    }

    const snap = await query.orderBy('createdAt', 'desc').limit(limit * 2).get();
    let nodes = snap.docs.map(doc => doc.data() as MediaMemoryNode);

    // Post-filter for entities and components (not supported directly in Firestore)
    const results: MediaMemorySearchResult[] = [];

    for (const node of nodes) {
      const matchedOn: string[] = [];
      let score = 1.0;

      // Layout match
      if (layoutTypes && layoutTypes.length > 0) {
        const overlap = layoutTypes.filter(lt => node.layoutTypes.includes(lt)).length;
        if (overlap > 0) {
          matchedOn.push('layout');
          score += overlap / layoutTypes.length;
        } else if (layoutTypes.length > 0) {
          // Required but not matched - skip this node
          continue;
        }
      }

      // Entity match (post-filter)
      if (entities && entities.length > 0) {
        const overlap = entities.filter(e =>
          node.entities.some(ne => ne.toLowerCase().includes(e.toLowerCase()))
        ).length;
        if (overlap > 0) {
          matchedOn.push('entity');
          score += overlap / entities.length;
        }
      }

      // Component match (post-filter)
      if (components && components.length > 0) {
        const overlap = components.filter(c =>
          node.components.some(nc => nc.toLowerCase().includes(c.toLowerCase()))
        ).length;
        if (overlap > 0) {
          matchedOn.push('component');
          score += overlap / components.length;
        }
      }

      results.push({ node, score, matchedOn });
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    const finalResults = results.slice(0, limit);

    return NextResponse.json({
      success: true,
      nodes: finalResults.map(r => r.node),
      results: finalResults,
      total: finalResults.length,
    });
  } catch (error) {
    console.error('[165.5][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST: Create Memory Node Manually
// =============================================================================

export async function POST(request: NextRequest) {
  console.log('[165.5][API] POST /api/media/memory');

  try {
    const body = await request.json();
    const {
      projectId,
      attachmentId,
      preprocessJobId,
      kind,
      title,
      summary,
      layoutTypes = [],
      primaryColor,
      secondaryColor,
      accentColors = [],
      styleHints = {},
      entities = [],
      components = [],
      tags = [],
      conversationId,
      turnId,
      createdBy,
    } = body;

    // Validation
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    if (!attachmentId) {
      return NextResponse.json({ error: 'attachmentId is required' }, { status: 400 });
    }
    if (!kind || !['image', 'pdf', 'audio'].includes(kind)) {
      return NextResponse.json({ error: 'kind must be "image", "pdf", or "audio"' }, { status: 400 });
    }
    if (!summary) {
      return NextResponse.json({ error: 'summary is required' }, { status: 400 });
    }

    const now = Date.now();
    const nodeId = generateId('mem');

    const node: MediaMemoryNode = {
      id: nodeId,
      projectId,
      attachmentId,
      preprocessJobId: preprocessJobId || '',
      kind,
      title,
      summary,
      layoutTypes,
      primaryColor: primaryColor || null,
      secondaryColor: secondaryColor || null,
      accentColors,
      styleHints: {
        borderRadius: styleHints.borderRadius || 'md',
        shadowLevel: styleHints.shadowLevel || 1,
        spacing: styleHints.spacing || 'normal',
        theme: styleHints.theme || 'auto',
      },
      entities,
      components,
      tags: [
        { key: 'kind', value: kind, source: 'auto' as const, confidence: 1.0 },
        ...tags,
      ],
      createdAt: now,
      updatedAt: now,
      conversationId,
      turnId,
      createdBy,
    };

    // Save to Firestore
    await db.collection('mediaMemoryNodes').doc(nodeId).set(node);

    console.log('[165.5][API] Created memory node:', nodeId);

    return NextResponse.json({
      success: true,
      node,
    });
  } catch (error) {
    console.error('[165.5][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
