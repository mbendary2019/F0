// functions/src/integrations/github/applyPatchToGithub.ts
// Phase 83.3: Apply F0 Patch to GitHub Branch + Open PR

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import {
  createBranch,
  getFileContent,
  updateFileOnBranch,
  createPullRequest,
} from './client';
import { parsePatch } from '../../lib/patch/parsePatch';
import { applyPatch } from '../../lib/patch/applyPatch';

const db = admin.firestore();

interface ApplyPatchData {
  projectId: string;
  patchId: string;
  targetBranch?: string;
  createNewBranch?: boolean;
  branchName?: string;
  openPullRequest?: boolean;
}

export const applyPatchToGithubBranch = functions.https.onCall(
  async (data: ApplyPatchData, context: any) => {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Auth required');
    }

    const {
      projectId,
      patchId,
      targetBranch,
      createNewBranch,
      branchName,
      openPullRequest,
    } = data || {};

    if (!projectId || !patchId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'projectId and patchId are required'
      );
    }

    console.log(`[applyPatchToGithubBranch] Starting for project ${projectId}, patch ${patchId}`);

    // 1. Get project and patch data
    const projectRef = db.collection('projects').doc(projectId);
    const patchRef = projectRef.collection('patches').doc(patchId);

    const [projectSnap, patchSnap] = await Promise.all([
      projectRef.get(),
      patchRef.get(),
    ]);

    if (!projectSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Project not found');
    }

    if (!patchSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Patch not found');
    }

    const project = projectSnap.data() as any;
    const patch = patchSnap.data() as any;

    // 2. Verify GitHub link
    const github = project.github;
    if (!github?.owner || !github?.repo) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Project is not linked to a GitHub repository'
      );
    }

    const owner = github.owner;
    const repo = github.repo;
    const baseBranch = targetBranch || github.defaultBranch || 'main';
    const finalBranch =
      createNewBranch && branchName
        ? branchName
        : createNewBranch
        ? `f0/patch-${patchId}`
        : baseBranch;

    console.log(`[applyPatchToGithubBranch] GitHub: ${owner}/${repo}, base: ${baseBranch}, target: ${finalBranch}`);

    // 3. Create new branch if needed
    if (createNewBranch && finalBranch !== baseBranch) {
      try {
        await createBranch(owner, repo, baseBranch, finalBranch);
        console.log(`[applyPatchToGithubBranch] Created branch: ${finalBranch}`);
      } catch (err: any) {
        console.error('[applyPatchToGithubBranch] Failed to create branch:', err);
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Failed to create branch: ${err.message}`
        );
      }
    }

    // 4. Get patchText from patch document
    const patchText: string | undefined = patch.patchText;
    if (!patchText) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Patch document does not contain patchText'
      );
    }

    // 5. Parse unified diff
    let patches;
    try {
      patches = parsePatch(patchText);
      console.log(`[applyPatchToGithubBranch] Parsed ${patches.length} file patches`);
    } catch (err: any) {
      console.error('[applyPatchToGithubBranch] Failed to parse patch:', err);
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Invalid patch format: ${err.message}`
      );
    }

    // 6. Apply each file patch
    const updatedFiles: { path: string; newContent: string }[] = [];

    for (const filePatch of patches) {
      const path = filePatch.filePath;
      console.log(`[applyPatchToGithubBranch] Processing file: ${path}`);

      try {
        // Get current file content from GitHub
        const originalContent = await getFileContent(owner, repo, path, finalBranch);

        // Apply patch in memory
        const result = applyPatch(originalContent, filePatch);

        if (!result.success) {
          console.error(`[applyPatchToGithubBranch] Failed to apply patch for ${path}:`, result.error);
          throw new functions.https.HttpsError(
            'failed-precondition',
            `Patch failed for ${path}: ${result.error || 'Unknown error'}`
          );
        }

        if (!result.content) {
          throw new functions.https.HttpsError(
            'internal',
            `Patch succeeded but no content returned for ${path}`
          );
        }

        updatedFiles.push({ path, newContent: result.content });
      } catch (err: any) {
        console.error(`[applyPatchToGithubBranch] Error processing ${path}:`, err);
        throw new functions.https.HttpsError(
          'internal',
          `Failed to process file ${path}: ${err.message}`
        );
      }
    }

    // 7. Commit changes to GitHub
    const commitMessage = `Apply F0 patch ${patchId}`;

    for (const file of updatedFiles) {
      try {
        await updateFileOnBranch(
          owner,
          repo,
          file.path,
          file.newContent,
          commitMessage,
          finalBranch
        );
        console.log(`[applyPatchToGithubBranch] Updated file on GitHub: ${file.path}`);
      } catch (err: any) {
        console.error(`[applyPatchToGithubBranch] Failed to update ${file.path}:`, err);
        throw new functions.https.HttpsError(
          'internal',
          `Failed to commit file ${file.path} to GitHub: ${err.message}`
        );
      }
    }

    // 8. Open PR if requested
    let prNumber: number | null = null;

    if (openPullRequest && finalBranch !== baseBranch) {
      try {
        const pr = await createPullRequest(
          owner,
          repo,
          `F0 Patch ${patchId}`,
          finalBranch,
          baseBranch,
          `This PR was automatically generated by F0 for patch ${patchId}.\\n\\n` +
          `Patch applies ${updatedFiles.length} file(s).`
        );
        prNumber = pr.number;
        console.log(`[applyPatchToGithubBranch] Created PR #${prNumber}`);
      } catch (err: any) {
        console.error('[applyPatchToGithubBranch] Failed to create PR:', err);
        // Don't fail the whole operation if PR creation fails
        console.warn('[applyPatchToGithubBranch] Continuing despite PR failure');
      }
    }

    // 9. Update patch document with GitHub info
    await patchRef.set(
      {
        github: {
          branch: finalBranch,
          baseBranch,
          commitMessage,
          pullRequestNumber: prNumber,
          status: prNumber ? 'pr_opened' : 'applied_to_branch',
          filesCount: updatedFiles.length,
          appliedAt: admin.firestore.FieldValue.serverTimestamp(),
          appliedBy: context.auth.uid,
        },
      },
      { merge: true }
    );

    console.log(`[applyPatchToGithubBranch] Successfully completed for patch ${patchId}`);

    return {
      ok: true,
      branch: finalBranch,
      baseBranch,
      pullRequestNumber: prNumber,
      filesCount: updatedFiles.length,
    };
  }
);
