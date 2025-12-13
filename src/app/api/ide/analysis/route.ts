/**
 * Phase 85.3: Project Dependency Analysis API
 * POST /api/ide/analysis - Analyze project dependencies
 * GET /api/ide/analysis?projectId=xxx - Retrieve cached analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  buildDependencyGraph,
  analyzeDependencyGraph,
} from '@/lib/ide/dependencyGraph';
import {

export const dynamic = 'force-dynamic';
  saveProjectAnalysis,
  loadProjectAnalysis,
} from '@/lib/ide/projectAnalysisStore';

/**
 * POST /api/ide/analysis
 * Analyze project dependencies and save to Firestore
 *
 * Body:
 * {
 *   projectId: string;
 *   files: Array<{ path: string; content: string; languageId?: string }>;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, files } = body;

    if (!projectId || !files || !Array.isArray(files)) {
      return NextResponse.json(
        { error: 'Missing projectId or files array' },
        { status: 400 }
      );
    }

    // Build dependency graph
    const graph = buildDependencyGraph(files);

    // Analyze graph for issues, hotspots, cycles
    const analysis = analyzeDependencyGraph(projectId, graph);

    // Save to Firestore
    await saveProjectAnalysis(projectId, analysis);

    return NextResponse.json({
      success: true,
      summary: analysis.summary,
    });
  } catch (error) {
    console.error('[IDE Analysis API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze project' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ide/analysis?projectId=xxx
 * Retrieve cached analysis from Firestore
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing projectId query parameter' },
        { status: 400 }
      );
    }

    // Load from Firestore
    const analysis = await loadProjectAnalysis(projectId);

    if (!analysis) {
      return NextResponse.json(
        { error: 'No analysis found for this project' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('[IDE Analysis API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load analysis' },
      { status: 500 }
    );
  }
}
