/**
 * Phase 70.2: Vercel Project Creation
 * POST /api/integrations/vercel/create-project
 * Creates a Vercel project connected to GitHub repo
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { requireProjectOwner } from '@/lib/api/requireProjectOwner';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import type {
  CreateVercelProjectRequest,
  CreateVercelProjectResponse,
  VercelIntegrationData,
} from '@/types/integrations';

const db = getFirestore(adminApp);

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const user = await requireUser(req);

    // Parse request body
    const body: CreateVercelProjectRequest = await req.json();
    const { projectId, projectName, githubRepo } = body;

    if (!projectId || !projectName || !githubRepo) {
      return NextResponse.json(
        { error: 'projectId, projectName, and githubRepo are required' },
        { status: 400 }
      );
    }

    // Verify project ownership
    await requireProjectOwner(user, projectId);

    // Get Vercel API token from environment
    const token = process.env.F0_VERCEL_API_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'Vercel not configured. Please set F0_VERCEL_API_TOKEN.' },
        { status: 500 }
      );
    }

    // Create Vercel project
    const res = await fetch(`https://api.vercel.com/v9/projects`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        gitRepository: {
          type: 'github',
          repo: githubRepo, // format: "username/repo"
        },
        framework: 'nextjs', // Assuming Next.js projects
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      console.error('[Vercel] Project creation failed:', json);
      return NextResponse.json(
        { error: json.error?.message || 'Failed to create Vercel project' },
        { status: res.status }
      );
    }

    // Save integration data to Firestore
    const integrationData: VercelIntegrationData = {
      connected: true,
      projectId: json.id,
      projectName: json.name,
      deploymentUrl: json.link?.url,
      lastDeploy: null, // Will be updated after first deployment
    };

    await db
      .collection('projects')
      .doc(projectId)
      .collection('integrations')
      .doc('vercel')
      .set(integrationData);

    const result: CreateVercelProjectResponse = {
      ok: true,
      vercelProjectId: json.id,
    };

    console.log(
      `[Vercel] Project created: ${json.id} for project ${projectId}`
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[Vercel] Create project endpoint error:', error);

    // Handle authentication errors
    if (error.message === 'NO_TOKEN' || error.message === 'INVALID_TOKEN') {
      return NextResponse.json(
        { error: 'Unauthorized', details: error.message },
        { status: 401 }
      );
    }

    // Handle ownership errors
    if (error.message?.includes('FORBIDDEN')) {
      return NextResponse.json(
        { error: 'You do not own this project' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
