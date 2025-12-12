/**
 * Phase 97.2: Deployment Complete API Route
 * POST /api/projects/[projectId]/deployments/complete
 *
 * Called when a deployment succeeds to:
 * 1. Record the deployment in ops_deployments
 * 2. Auto-sync the preview URL with the deployment URL
 *
 * Can be called from:
 * - Vercel webhook
 * - GitHub Actions
 * - Agent after successful deploy task
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { syncProjectPreviewUrlWithLatestDeployment } from '@/lib/server/deployments';
import type { DeploymentEnv } from '@/types/deployment';

const db = adminDb;

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

interface DeploymentCompleteBody {
  ownerUid: string;
  projectName: string;
  env?: DeploymentEnv;
  status: 'success' | 'failed';
  url?: string | null;
  logsUrl?: string | null;
  branch?: string;
  label?: string;
  provider?: 'vercel' | 'github-actions' | 'other';
  deploymentId?: string; // External deployment ID (e.g., Vercel deployment ID)
}

export async function POST(
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

    const body = (await request.json()) as DeploymentCompleteBody;
    const {
      ownerUid,
      projectName,
      env = 'production',
      status,
      url,
      logsUrl,
      branch = 'main',
      label,
      provider = 'vercel',
      deploymentId,
    } = body;

    if (!ownerUid) {
      return NextResponse.json(
        { ok: false, error: 'ownerUid is required' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { ok: false, error: 'status is required' },
        { status: 400 }
      );
    }

    const now = Date.now();

    // Create deployment record
    const deploymentData = {
      projectId,
      ownerUid,
      projectName: projectName || 'Unknown Project',
      env,
      status,
      url: url || null,
      logsUrl: logsUrl || null,
      branch,
      label: label || `Deployment ${new Date().toISOString()}`,
      provider,
      externalId: deploymentId || null,
      createdAt: now,
      finishedAt: now,
    };

    // Save to Firestore
    const docRef = await db.collection('ops_deployments').add(deploymentData);

    console.log(
      `[deployments/complete] Created deployment ${docRef.id} for project ${projectId} with status ${status}`
    );

    // If successful and has a URL, sync the preview URL
    let syncResult = { synced: false, url: null as string | null };
    if (status === 'success' && url) {
      syncResult = await syncProjectPreviewUrlWithLatestDeployment({
        projectId,
        env,
      });
    }

    return NextResponse.json({
      ok: true,
      deploymentId: docRef.id,
      status,
      url,
      previewSynced: syncResult.synced,
      previewUrl: syncResult.url,
    });
  } catch (error: any) {
    console.error('[deployments/complete] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to record deployment' },
      { status: 500 }
    );
  }
}
