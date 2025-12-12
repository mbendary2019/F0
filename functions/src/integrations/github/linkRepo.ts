// functions/src/integrations/github/linkRepo.ts
// Phase 83.1: Link GitHub Repository to Project

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getRepo } from './client';

const db = admin.firestore();

interface LinkRepoData {
  projectId: string;
  owner: string;
  repo: string;
  defaultBranch?: string;
}

export const linkGithubRepo = functions.https.onCall(
  async (data: LinkRepoData, context: any) => {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Auth required');
    }

    const { projectId, owner, repo, defaultBranch } = data;

    if (!projectId || !owner || !repo) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'projectId, owner, repo are required'
      );
    }

    // Check if project exists
    const projectRef = db.collection('projects').doc(projectId);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Project not found');
    }

    // Verify that the GitHub repo exists and is accessible
    try {
      await getRepo(owner, repo);
      console.log(`✅ [linkGithubRepo] Successfully verified repo ${owner}/${repo}`);
    } catch (err: any) {
      console.error('[linkGithubRepo] GitHub repo access error:', err);
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Cannot access GitHub repo ${owner}/${repo}. Make sure GITHUB_TOKEN is set and has access to this repo.`
      );
    }

    const branch = defaultBranch || 'main';

    // Save GitHub info to project document
    await projectRef.set(
      {
        github: {
          provider: 'github',
          owner,
          repo,
          defaultBranch: branch,
          linkedAt: admin.firestore.FieldValue.serverTimestamp(),
          linkedBy: context.auth.uid,
        },
      },
      { merge: true }
    );

    console.log(`✅ [linkGithubRepo] Linked project ${projectId} to ${owner}/${repo} (${branch})`);

    return {
      ok: true,
      owner,
      repo,
      defaultBranch: branch,
    };
  }
);
