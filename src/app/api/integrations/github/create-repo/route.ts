/**
 * Phase 70.2: GitHub Repo Creation
 * POST /api/integrations/github/create-repo
 * Creates a GitHub repository and saves integration data
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { requireProjectOwner } from '@/lib/api/requireProjectOwner';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import type {
  CreateGitHubRepoRequest,
  CreateGitHubRepoResponse,
  GitHubIntegrationData,
} from '@/types/integrations';

export const dynamic = 'force-dynamic';

const db = getFirestore(adminApp);

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const user = await requireUser(req);

    // Parse request body
    const body: CreateGitHubRepoRequest = await req.json();
    const { projectId, repoName, token, isPrivate = true } = body;

    if (!projectId || !repoName || !token) {
      return NextResponse.json(
        { error: 'projectId, repoName, and token are required' },
        { status: 400 }
      );
    }

    // Verify project ownership
    await requireProjectOwner(user, projectId);

    // Create GitHub repository
    const response = await fetch(`https://api.github.com/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
        'User-Agent': 'F0-App',
      },
      body: JSON.stringify({
        name: repoName,
        private: isPrivate,
        auto_init: true, // Initialize with README
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      console.error('[GitHub] Repo creation failed:', json);
      return NextResponse.json(
        { error: json?.message || 'Failed to create repo' },
        { status: response.status }
      );
    }

    // Get user info from GitHub
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'F0-App',
      },
    });

    const userData = userRes.ok ? await userRes.json() : {};

    // Save integration data to Firestore
    const integrationData: GitHubIntegrationData = {
      connected: true,
      username: userData.login || json.owner?.login,
      repoName: json.name,
      repoUrl: json.html_url,
      branch: json.default_branch || 'main',
      lastSync: new Date().toISOString(),
    };

    await db
      .collection('projects')
      .doc(projectId)
      .collection('integrations')
      .doc('github')
      .set(integrationData);

    const result: CreateGitHubRepoResponse = {
      ok: true,
      repoUrl: json.html_url,
    };

    console.log(
      `[GitHub] Repository created: ${json.html_url} for project ${projectId}`
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[GitHub] Create repo endpoint error:', error);

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
