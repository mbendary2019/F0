// src/app/api/rag/query/route.ts
// Phase 58: RAG query API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { recall } from '@/lib/rag/recallEngine';
import { RecallOpts } from '@/lib/rag/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/rag/query
 *
 * Query the RAG system for relevant context
 *
 * Request body:
 * {
 *   q: string;              // Query text
 *   workspaceId: string;    // Workspace ID
 *   topK?: number;          // Number of results (default: 8)
 *   strategy?: "auto" | "dense" | "sparse" | "hybrid";
 *   useMMR?: boolean;       // Enable MMR (default: true)
 *   mmrLambda?: number;     // MMR lambda (default: 0.65)
 *   budgetTokens?: number;  // Token budget (default: 1200)
 * }
 *
 * Response:
 * {
 *   items: RecallItem[];
 *   diagnostics: RecallDiagnostics;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      q,
      workspaceId,
      topK,
      strategy,
      useMMR,
      mmrLambda,
      budgetTokens,
    } = body;

    // Validation
    if (!q || typeof q !== 'string') {
      return NextResponse.json(
        { error: 'Query "q" is required and must be a string' },
        { status: 400 }
      );
    }

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        { error: 'workspaceId is required and must be a string' },
        { status: 400 }
      );
    }

    // TODO: Add authentication check
    // const user = await getUser(req);
    // if (!user || !user.workspaces.includes(workspaceId)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Build options
    const opts: RecallOpts = {
      workspaceId,
      topK: topK ?? 8,
      strategy: strategy ?? 'auto',
      useMMR: useMMR !== false,
      mmrLambda: mmrLambda ?? 0.65,
      budgetTokens: budgetTokens ?? 1200,
    };

    // Perform recall
    const result = await recall(q, opts);

    return NextResponse.json({
      items: result.items,
      diagnostics: result.diagnostics,
    });
  } catch (error) {
    console.error('[RAG API] Error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rag/query?q=...&workspaceId=...
 *
 * Alternative GET endpoint for simple queries
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const q = searchParams.get('q');
    const workspaceId = searchParams.get('workspaceId');

    if (!q || !workspaceId) {
      return NextResponse.json(
        { error: 'Query parameters "q" and "workspaceId" are required' },
        { status: 400 }
      );
    }

    const opts: RecallOpts = {
      workspaceId,
      topK: parseInt(searchParams.get('topK') || '8'),
      strategy: (searchParams.get('strategy') as RecallOpts['strategy']) || 'auto',
    };

    const result = await recall(q, opts);

    return NextResponse.json({
      items: result.items,
      diagnostics: result.diagnostics,
    });
  } catch (error) {
    console.error('[RAG API] Error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
