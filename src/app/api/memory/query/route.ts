// =============================================================
// Phase 59 — Cognitive Memory Mesh - Query API
// REST endpoint for querying memory graph
// =============================================================

import { NextRequest, NextResponse } from 'next/server';
import { queryRelatedNodes, queryRelatedNodesFromNode } from '@/lib/memory/linkBuilder';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, queryText, queryEmbedding, nodeId, threshold, topK } = body;

    // Validate required params
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    // Query by text or embedding
    if (queryText || queryEmbedding) {
      const results = await queryRelatedNodes({
        workspaceId,
        queryText,
        queryEmbedding,
        threshold: threshold || 0.75,
        topK: topK || 12,
      });

      return NextResponse.json({
        success: true,
        results,
        count: results.length,
        method: 'embedding',
      });
    }

    // Query from specific node
    if (nodeId) {
      const results = await queryRelatedNodesFromNode(workspaceId, nodeId, topK || 12);

      return NextResponse.json({
        success: true,
        results,
        count: results.length,
        method: 'graph',
      });
    }

    return NextResponse.json(
      { error: 'Either queryText/queryEmbedding or nodeId is required' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[memory/query] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json(
    {
      endpoint: '/api/memory/query',
      method: 'POST',
      description: 'Query memory graph for related nodes',
      parameters: {
        workspaceId: 'string (required)',
        queryText: 'string (optional, for semantic search)',
        queryEmbedding: 'number[] (optional, precomputed embedding)',
        nodeId: 'string (optional, query from specific node)',
        threshold: 'number (optional, default 0.75)',
        topK: 'number (optional, default 12)',
      },
      examples: [
        {
          description: 'Semantic search by text',
          body: {
            workspaceId: 'workspace_123',
            queryText: 'how to deploy functions',
            topK: 10,
          },
        },
        {
          description: 'Graph traversal from node',
          body: {
            workspaceId: 'workspace_123',
            nodeId: 'snippet_abc',
            topK: 8,
          },
        },
      ],
    },
    { status: 200 }
  );
}
