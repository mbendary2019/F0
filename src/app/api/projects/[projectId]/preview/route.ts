/**
 * Phase 97.1: Preview URL API Route
 * GET /api/projects/[projectId]/preview - Get preview URL
 * PATCH /api/projects/[projectId]/preview - Update preview URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProjectPreviewUrl, updateProjectPreviewUrl } from '@/lib/server/projectPreview';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

/**
 * GET: Retrieve preview URL for a project
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { projectId } = await context.params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const previewUrl = await getProjectPreviewUrl(projectId);

    return NextResponse.json({
      projectId,
      previewUrl,
    });
  } catch (error: any) {
    console.error('[preview/GET] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to get preview URL' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Update preview URL for a project
 * Body: { previewUrl: string | null }
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { projectId } = await context.params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { previewUrl } = body;

    // previewUrl can be string or null (to clear)
    if (previewUrl !== null && typeof previewUrl !== 'string') {
      return NextResponse.json(
        { error: 'previewUrl must be a string or null' },
        { status: 400 }
      );
    }

    await updateProjectPreviewUrl({ projectId, previewUrl });

    return NextResponse.json({
      success: true,
      projectId,
      previewUrl,
    });
  } catch (error: any) {
    console.error('[preview/PATCH] Error:', error);

    // Handle specific errors
    if (error?.message === 'Project not found') {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (error?.message?.includes('must start with http')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error?.message || 'Failed to update preview URL' },
      { status: 500 }
    );
  }
}
