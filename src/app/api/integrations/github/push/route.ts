/**
 * Phase 74: Auto GitHub Push
 * POST /api/integrations/github/push
 * Pushes project files to connected GitHub repository
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { requireProjectOwner } from '@/lib/api/requireProjectOwner';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import { getProjectFilesSnapshot } from '@/lib/server/projectFiles';
import { GitHubClient, GitHubRepoInfo } from '@/lib/server/githubClient';
import type {
  GitHubPushRequest,
  GitHubPushResponse,
  GitHubPushResult,
} from '@/types/files';
import type { GitHubIntegrationData } from '@/types/integrations';

export const dynamic = 'force-dynamic';

const db = getFirestore(adminApp);

export async function POST(req: NextRequest) {
  try {
    // 1. Verify authentication
    const user = await requireUser(req);

    // 2. Parse request body
    const body: GitHubPushRequest = await req.json();
    const { projectId, commitMessage = 'chore: sync from F0' } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    // 3. Verify project ownership
    await requireProjectOwner(user, projectId);

    // 4. Read GitHub integration document
    const ghDoc = await db
      .collection('projects')
      .doc(projectId)
      .collection('integrations')
      .doc('github')
      .get();

    if (!ghDoc.exists) {
      return NextResponse.json(
        { error: 'GitHub integration not configured for this project' },
        { status: 400 }
      );
    }

    const ghData = ghDoc.data() as GitHubIntegrationData;

    // 5. Validate GitHub integration data
    const repoUrl = ghData.repoUrl;
    const repoName = ghData.repoName;
    const username = ghData.username;
    const branch = ghData.branch || 'main';

    if (!repoUrl || !repoName || !username) {
      return NextResponse.json(
        { error: 'GitHub repo data incomplete. Please reconnect GitHub integration.' },
        { status: 400 }
      );
    }

    // 6. Get GitHub access token from user's integration
    // For better security, token should be stored per-user, not per-project
    // For now, we'll assume it's in the project integration (can be refactored)
    const userGhDoc = await db
      .collection('users')
      .doc(user.uid)
      .collection('integrations')
      .doc('github')
      .get();

    let accessToken: string | undefined;

    if (userGhDoc.exists) {
      // Preferred: Token stored at user level
      accessToken = (userGhDoc.data() as any)?.accessToken;
    } else if ((ghData as any).accessToken) {
      // Fallback: Token stored at project level (less secure)
      accessToken = (ghData as any).accessToken;
    }

    if (!accessToken) {
      return NextResponse.json(
        {
          error: 'GitHub access token not found. Please reconnect GitHub integration.',
        },
        { status: 400 }
      );
    }

    // 7. Get project files snapshot
    const files = await getProjectFilesSnapshot(projectId);

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No project files found to push' },
        { status: 400 }
      );
    }

    // 8. Initialize GitHub client and push files
    const client = new GitHubClient(accessToken);

    const repo: GitHubRepoInfo = {
      owner: username,
      name: repoName,
      defaultBranch: branch,
    };

    console.log(
      `[GitHub Push] Pushing ${files.length} files to ${username}/${repoName} for project ${projectId}`
    );

    const pushResult = await client.pushFiles(repo, files, commitMessage);

    // 9. Prepare response result
    const result: GitHubPushResult = {
      repoUrl,
      branch,
      commitSha: pushResult.commitSha,
      commitUrl: client.getCommitUrl(username, repoName, pushResult.commitSha),
    };

    // 10. Update Firestore integration doc with last sync info
    await ghDoc.ref.set(
      {
        lastSync: new Date().toISOString(),
        lastCommitSha: pushResult.commitSha,
        lastCommitMessage: commitMessage,
      },
      { merge: true }
    );

    console.log(
      `[GitHub Push] Successfully pushed to ${username}/${repoName}, commit: ${pushResult.commitSha}`
    );

    const response: GitHubPushResponse = {
      ok: true,
      result,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[GitHub Push] Error:', error);

    // Handle authentication errors
    if (error.message === 'NO_TOKEN' || error.message === 'INVALID_TOKEN') {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized', details: error.message },
        { status: 401 }
      );
    }

    // Handle ownership errors
    if (error.message?.includes('FORBIDDEN')) {
      return NextResponse.json(
        { ok: false, error: 'You do not own this project' },
        { status: 403 }
      );
    }

    // Handle GitHub API errors
    if (error.message?.includes('GitHub')) {
      return NextResponse.json(
        { ok: false, error: 'GitHub API error', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
