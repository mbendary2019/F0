/**
 * GitHub Repository Management Functions
 *
 * Handles repository listing, connection, and management
 */

import {onCall, HttpsError} from 'firebase-functions/v2/https';
import {db} from '../config';
import {Timestamp} from 'firebase-admin/firestore';
import fetch from 'node-fetch';
import {getGitHubToken} from './oauth';

/**
 * List user's GitHub repositories
 */
export const listRepositories = onCall<{page?: number; perPage?: number}>(async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = req.auth.uid;
    const page = req.data.page || 1;
    const perPage = req.data.perPage || 30;

    try {
      const accessToken = await getGitHubToken(userId);

      // Fetch repositories from GitHub API
      const response = await fetch(
        `https://api.github.com/user/repos?page=${page}&per_page=${perPage}&sort=updated&affiliation=owner,collaborator`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const repos = (await response.json()) as any[];

      return {
        repos: repos.map((repo) => ({
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          owner: repo.owner.login,
          description: repo.description,
          private: repo.private,
          fork: repo.fork,
          defaultBranch: repo.default_branch,
          htmlUrl: repo.html_url,
          cloneUrl: repo.clone_url,
          sshUrl: repo.ssh_url,
          permissions: repo.permissions,
          archived: repo.archived,
          updatedAt: repo.updated_at,
        })),
        total: repos.length,
      };
    } catch (error: any) {
      console.error('List repos error:', error);
      throw new HttpsError('internal', error.message);
    }
  });

/**
 * Connect/link a repository to F0
 */
export const connectRepository = onCall<{
  repoId: number;
  fullName: string;
  syncEnabled?: boolean;
  autoSync?: boolean;
}>(async (req) => {
      if (!req.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
      }

      const userId = req.auth.uid;
      const {repoId, fullName, syncEnabled = true, autoSync = false} = req.data;

      if (!repoId || !fullName) {
        throw new HttpsError('invalid-argument', 'Missing required fields');
      }

      try {
        const accessToken = await getGitHubToken(userId);

        // Fetch repository details from GitHub
        const response = await fetch(`https://api.github.com/repos/${fullName}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch repository details');
        }

        const repo: any = await response.json();

        // Check if already connected
        const existingRepoQuery = await db
          .collection('ops_github_repos')
          .where('userId', '==', userId)
          .where('repoId', '==', repoId)
          .get();

        // Use compound docId: <uid>__<repoId>
        const docId = `${userId}__${repoId}`;
        const repoDocRef = db.collection('ops_github_repos').doc(docId);

        const repoDoc = await repoDocRef.get();

        if (repoDoc.exists) {
          // Update existing
          await repoDocRef.update({
            syncEnabled,
            lastSyncAt: Timestamp.now(),
          });
        } else {
          // Create new
          await repoDocRef.set({
            userId,
            repoId: repo.id,
            fullName: repo.full_name,
            defaultBranch: repo.default_branch,
            permissions: repo.permissions,
            syncEnabled,
            lastSyncAt: Timestamp.now(),
          });
        }

        return {
          success: true,
          repoId: repoDocRef.id,
        };
      } catch (error: any) {
        console.error('Connect repo error:', error);
        throw new HttpsError('internal', error.message);
      }
    });

/**
 * Disconnect a repository
 */
export const disconnectRepository = onCall<{repoId: string}>(async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = req.auth.uid;
    const {repoId} = req.data;

    if (!repoId) {
      throw new HttpsError('invalid-argument', 'Missing repoId');
    }

    try {
      const repoDoc = await db.collection('ops_github_repos').doc(repoId).get();

      if (!repoDoc.exists) {
        throw new Error('Repository not found');
      }

      const repoData = repoDoc.data();

      if (repoData!.userId !== userId) {
        throw new HttpsError('permission-denied', 'Access denied');
      }

      await repoDoc.ref.delete();

      return {success: true};
    } catch (error: any) {
      console.error('Disconnect repo error:', error);
      throw new HttpsError('internal', error.message);
    }
  });

/**
 * Get connected repositories
 */
export const getConnectedRepositories = onCall(async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = req.auth.uid;

    try {
      const snapshot = await db
        .collection('ops_github_repos')
        .where('userId', '==', userId)
        .orderBy('updatedAt', 'desc')
        .get();

      const repos = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return {
        repos,
        total: repos.length,
      };
    } catch (error: any) {
      console.error('Get connected repos error:', error);
      throw new HttpsError('internal', error.message);
    }
  });

/**
 * Update repository sync settings
 */
export const updateRepositorySettings = onCall<{
  repoId: string;
  syncEnabled?: boolean;
  autoSync?: boolean;
  syncMode?: 'push' | 'pull' | 'pr' | 'both';
}>(async (req) => {
      if (!req.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
      }

      const userId = req.auth.uid;
      const {repoId, ...updates} = req.data;

      if (!repoId) {
        throw new HttpsError('invalid-argument', 'Missing repoId');
      }

      try {
        const repoDoc = await db.collection('ops_github_repos').doc(repoId).get();

        if (!repoDoc.exists) {
          throw new Error('Repository not found');
        }

        const repoData = repoDoc.data();

        if (repoData!.userId !== userId) {
          throw new HttpsError('permission-denied', 'Access denied');
        }

        await repoDoc.ref.update({
          ...updates,
          updatedAt: Timestamp.now(),
        });

        return {success: true};
      } catch (error: any) {
        console.error('Update repo settings error:', error);
        throw new HttpsError('internal', error.message);
      }
    });
