/**
 * GitHub OAuth Functions
 *
 * Handles OAuth flow and token management
 */

import {onCall, HttpsError} from 'firebase-functions/v2/https';
import {db} from '../config';
import {Timestamp} from 'firebase-admin/firestore';
import fetch from 'node-fetch';
import {encryptToken, decryptToken} from '../lib/crypto';

// GitHub OAuth Configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;

/**
 * Exchange OAuth code for access token
 */
export const exchangeOAuthCode = onCall<{code: string; state: string}>(async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = req.auth.uid;
    const {code, state} = req.data;

    if (!code) {
      throw new HttpsError('invalid-argument', 'Missing authorization code');
    }

    try {
      // Verify state (anti-CSRF)
      // In production, validate state matches what was sent in authorization request

      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: GITHUB_REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange code for token');
      }

      const tokenData: any = await tokenResponse.json();

      if (tokenData.error) {
        throw new Error(tokenData.error_description || tokenData.error);
      }

      const accessToken = tokenData.access_token;
      const scope = tokenData.scope;

      // Get GitHub user info
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch GitHub user info');
      }

      const githubUser: any = await userResponse.json();

      // Encrypt the access token using AES-256-GCM
      const tokenEnc = encryptToken(accessToken);

      // Store GitHub account info in Firestore
      // docId = <uid>
      const accountRef = db.collection('ops_github_accounts').doc(userId);

      await accountRef.set({
        userId,
        login: githubUser.login,
        avatarUrl: githubUser.avatar_url,
        scopes: scope.split(','),
        connectedAt: Timestamp.now(),
        tokenEnc,
      });

      return {
        success: true,
        user: {
          login: githubUser.login,
          name: githubUser.name,
          avatarUrl: githubUser.avatar_url,
        },
      };
    } catch (error: any) {
      console.error('OAuth error:', error);
      throw new HttpsError('internal', error.message);
    }
  });

/**
 * Get GitHub access token for a user (decrypted)
 * Internal function - NOT exposed as callable
 */
export async function getGitHubToken(userId: string): Promise<string> {
  const accountDoc = await db.collection('ops_github_accounts').doc(userId).get();

  if (!accountDoc.exists) {
    throw new Error('GitHub account not connected');
  }

  const accountData = accountDoc.data();
  if (!accountData?.tokenEnc) {
    throw new Error('GitHub token not found');
  }

  return decryptToken(accountData.tokenEnc);
}

/**
 * Revoke GitHub connection
 */
export const revokeGitHubConnection = onCall(async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = req.auth.uid;

    try {
      // Get token before deleting
      const accountDoc = await db.collection('ops_github_accounts').doc(userId).get();

      if (accountDoc.exists) {
        const accountData = accountDoc.data();
        const accessToken = decryptToken(accountData!.tokenEnc);

        // Revoke token on GitHub (optional - GitHub doesn't provide this endpoint for OAuth apps)
        // For GitHub Apps, you would use DELETE /applications/{client_id}/grant

        // Delete account document
        await accountDoc.ref.delete();

        // Delete all connected repos
        const reposSnapshot = await db
          .collection('ops_github_repos')
          .where('userId', '==', userId)
          .get();

        const batch = db.batch();
        reposSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }

      return {success: true};
    } catch (error: any) {
      console.error('Revoke error:', error);
      throw new HttpsError('internal', error.message);
    }
  });

/**
 * Get GitHub account status
 */
export const getGitHubAccount = onCall(async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = req.auth.uid;

    try {
      const accountDoc = await db.collection('ops_github_accounts').doc(userId).get();

      if (!accountDoc.exists) {
        return {connected: false};
      }

      const accountData = accountDoc.data();

      return {
        connected: true,
        account: {
          login: accountData!.login,
          avatarUrl: accountData!.avatarUrl,
          scopes: accountData!.scopes,
          connectedAt: accountData!.connectedAt.toMillis(),
        },
      };
    } catch (error: any) {
      console.error('Get account error:', error);
      throw new HttpsError('internal', error.message);
    }
  });
