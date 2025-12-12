// functions/src/integrations/github/syncToVfs.ts
// Phase 83.2: Sync from GitHub → VFS

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { listTree, getFileContent } from './client';

const db = admin.firestore();

export const syncFromGithubToVfs = functions.https.onCall(
  async (data: any, context: any) => {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Auth required');
    }

    const { projectId, branch } = data || {};

    if (!projectId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'projectId is required'
      );
    }

    // تأكد إن المشروع موجود
    const projectRef = db.collection('projects').doc(projectId);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Project not found');
    }

    const project = projectSnap.data() as any;
    const github = project.github;

    if (!github?.owner || !github?.repo) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Project is not linked to a GitHub repository'
      );
    }

    const owner = github.owner;
    const repo = github.repo;
    const branchName = branch || github.defaultBranch || 'main';

    console.log(`[syncFromGithubToVfs] Syncing ${owner}/${repo}@${branchName} to VFS for project ${projectId}`);

    // نجيب شجرة الملفات من GitHub
    const tree = await listTree(owner, repo, branchName);

    // فلترة الملفات اللي هنحطها في الـ VFS
    const files = tree.tree.filter(
      (item: any) =>
        item.type === 'blob' &&
        item.path &&
        !item.path.startsWith('node_modules') &&
        !item.path.startsWith('.git') &&
        !item.path.startsWith('.next') &&
        !item.path.endsWith('.lock') &&
        !item.path.endsWith('.lockb')
    );

    console.log(`[syncFromGithubToVfs] Found ${files.length} files to sync`);

    const vfsCollection = projectRef.collection('vfs');

    // استخدام batch علشان ما نعملش write لكل ملف لوحده
    const batch = db.batch();

    for (const file of files) {
      const filePath = file.path as string;

      const content = await getFileContent(owner, repo, filePath, branchName);

      const docRef = vfsCollection.doc(filePath);
      batch.set(
        docRef,
        {
          path: filePath,
          content,
          syncedFrom: {
            provider: 'github',
            owner,
            repo,
            branch: branchName,
          },
          syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();

    // حدّث بيانات الربط في المشروع
    await projectRef.set(
      {
        github: {
          ...github,
          lastSyncedBranch: branchName,
          lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

    console.log(`✅ [syncFromGithubToVfs] Synced ${files.length} files successfully`);

    return {
      ok: true,
      filesCount: files.length,
      branch: branchName,
    };
  }
);
