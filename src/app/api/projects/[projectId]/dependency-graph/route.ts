// src/app/api/projects/[projectId]/dependency-graph/route.ts
// Phase 124.1: Dependency Graph API
// GET - Load cached graph, POST - Save graph, DELETE - Clear cache

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase';

/**
 * Dependency graph structure (minimal for storage)
 */
interface DependencyGraphCache {
  totalFiles: number;
  edges: number;
  nodes: Array<{
    file: string;
    imports: string[];
    importedBy: string[];
  }>;
  orphans: string[];
  hubs: string[];
  generatedAt: string;
}

/**
 * GET /api/projects/[projectId]/dependency-graph
 * Load cached dependency graph from Firestore
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID required' },
        { status: 400 }
      );
    }

    // Get graph from Firestore
    const graphDoc = await adminDb
      .collection('projects')
      .doc(projectId)
      .collection('meta')
      .doc('dependency_graph')
      .get();

    if (!graphDoc.exists) {
      return NextResponse.json(
        { error: 'No dependency graph found' },
        { status: 404 }
      );
    }

    const data = graphDoc.data();

    return NextResponse.json({
      success: true,
      graph: data?.graph || null,
      stats: data?.stats || null,
      updatedAt: data?.updatedAt || null,
    });
  } catch (error) {
    console.error('[dependency-graph/GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load dependency graph' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[projectId]/dependency-graph
 * Save dependency graph to Firestore
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { graph, stats, userId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID required' },
        { status: 400 }
      );
    }

    if (!graph && !stats) {
      return NextResponse.json(
        { error: 'Graph or stats data required' },
        { status: 400 }
      );
    }

    // Save to Firestore
    const now = new Date().toISOString();
    const graphRef = adminDb
      .collection('projects')
      .doc(projectId)
      .collection('meta')
      .doc('dependency_graph');

    // Get existing to track version
    const existing = await graphRef.get();
    const version = existing.exists ? (existing.data()?.version || 0) + 1 : 1;

    await graphRef.set({
      graph: graph || null,
      stats: stats || null,
      userId: userId || 'anonymous',
      version,
      createdAt: existing.exists ? existing.data()?.createdAt : now,
      updatedAt: now,
    });

    console.log(`[dependency-graph/POST] Saved graph for project ${projectId} v${version}`);

    return NextResponse.json({
      success: true,
      docId: projectId,
      version,
    });
  } catch (error) {
    console.error('[dependency-graph/POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save dependency graph' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[projectId]/dependency-graph
 * Delete cached dependency graph
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID required' },
        { status: 400 }
      );
    }

    await adminDb
      .collection('projects')
      .doc(projectId)
      .collection('meta')
      .doc('dependency_graph')
      .delete();

    return NextResponse.json({
      success: true,
      message: 'Dependency graph deleted',
    });
  } catch (error) {
    console.error('[dependency-graph/DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete dependency graph' },
      { status: 500 }
    );
  }
}

/**
 * Query endpoints for dependency analysis
 * These are POST because they may have complex body parameters
 */

/**
 * POST /api/projects/[projectId]/dependency-graph/affected
 * Find files affected by a change to the given file
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { action, filePath, maxDepth = 5 } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID required' },
        { status: 400 }
      );
    }

    // Load cached graph
    const graphDoc = await adminDb
      .collection('projects')
      .doc(projectId)
      .collection('meta')
      .doc('dependency_graph')
      .get();

    if (!graphDoc.exists) {
      return NextResponse.json(
        { error: 'No dependency graph cached. Generate a snapshot first.' },
        { status: 404 }
      );
    }

    const graph = graphDoc.data()?.graph;
    if (!graph?.nodes) {
      return NextResponse.json(
        { error: 'Invalid graph data' },
        { status: 400 }
      );
    }

    // Build node map for quick lookup
    const nodeMap = new Map<string, { file: string; imports: string[]; importedBy: string[] }>();
    for (const node of graph.nodes) {
      nodeMap.set(node.file, node);
    }

    if (action === 'affected') {
      // Find all files affected by a change
      const affected = new Set<string>();
      const queue: Array<{ file: string; depth: number }> = [{ file: filePath, depth: 0 }];

      while (queue.length > 0) {
        const { file, depth } = queue.shift()!;
        if (depth > maxDepth) continue;
        if (affected.has(file)) continue;

        affected.add(file);

        const node = nodeMap.get(file);
        if (node) {
          for (const importer of node.importedBy) {
            if (!affected.has(importer)) {
              queue.push({ file: importer, depth: depth + 1 });
            }
          }
        }
      }

      affected.delete(filePath);

      return NextResponse.json({
        success: true,
        action: 'affected',
        file: filePath,
        affectedFiles: Array.from(affected),
        count: affected.size,
      });
    }

    if (action === 'dependencies') {
      // Find all dependencies of a file
      const dependencies = new Set<string>();
      const queue: Array<{ file: string; depth: number }> = [{ file: filePath, depth: 0 }];

      while (queue.length > 0) {
        const { file, depth } = queue.shift()!;
        if (depth > maxDepth) continue;
        if (dependencies.has(file)) continue;

        dependencies.add(file);

        const node = nodeMap.get(file);
        if (node) {
          for (const imported of node.imports) {
            if (!dependencies.has(imported)) {
              queue.push({ file: imported, depth: depth + 1 });
            }
          }
        }
      }

      dependencies.delete(filePath);

      return NextResponse.json({
        success: true,
        action: 'dependencies',
        file: filePath,
        dependencies: Array.from(dependencies),
        count: dependencies.size,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "affected" or "dependencies"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[dependency-graph/PUT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze dependencies' },
      { status: 500 }
    );
  }
}
