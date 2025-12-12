/**
 * Phase 97.2: Latest Deployment API Route
 * GET /api/projects/[projectId]/deployments/latest
 * Returns the latest successful deployment for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLatestSuccessfulDeployment } from '@/lib/server/deployments';
import type { DeploymentEnv } from '@/types/deployment';

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { projectId } = await context.params;

    if (!projectId) {
      return NextResponse.json(
        { ok: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Optional env filter from query params
    const { searchParams } = new URL(request.url);
    const envParam = searchParams.get('env') as DeploymentEnv | null;

    const deployment = await getLatestSuccessfulDeployment(projectId, envParam);

    if (!deployment) {
      return NextResponse.json({
        ok: true,
        deployment: null,
        url: null,
        message: 'No successful deployment found',
      });
    }

    return NextResponse.json({
      ok: true,
      deployment: {
        id: deployment.id,
        env: deployment.env,
        url: deployment.url,
        branch: deployment.branch,
        label: deployment.label,
        provider: deployment.provider,
        createdAt: deployment.createdAt,
        finishedAt: deployment.finishedAt,
      },
      url: deployment.url,
    });
  } catch (error: any) {
    console.error('[deployments/latest] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to get latest deployment' },
      { status: 500 }
    );
  }
}
