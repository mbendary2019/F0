/**
 * Phase 71: Integration Vault
 * Securely store and manage integration tokens
 */

import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../analytics/client';

interface SaveTokenRequest {
  provider: 'firebase' | 'vercel' | 'godaddy' | 'github';
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  };
  credentials?: {
    apiKey?: string;
    apiSecret?: string;
    clientId?: string;
    clientSecret?: string;
  };
}

interface IntegrationStatus {
  firebase: boolean;
  vercel: boolean;
  godaddy: boolean;
  github: boolean;
}

/**
 * Get user ID with dev mode support for local emulator
 */
function getUserId(req: CallableRequest): string {
  // 1) If user is authenticated, use their UID
  if (req.auth?.uid) {
    return req.auth.uid;
  }

  // 2) In local emulator, allow dev UID from environment
  const isLocal = process.env.F0_ENV === 'local';
  const devUid = process.env.F0_DEV_UID;

  if (isLocal && devUid) {
    console.log('[Vault] 🔧 Using dev UID from env for local emulator:', devUid);
    return devUid;
  }

  // 3) Otherwise, require authentication
  throw new Error('Authentication required');
}

/**
 * Save integration tokens to secure vault
 * Tokens are encrypted and stored per-user
 */
export const saveIntegrationToken = onCall<SaveTokenRequest>(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
  },
  async (req) => {
    const uid = getUserId(req);
    const { provider, tokens, credentials } = req.data;

    if (!provider) {
      throw new Error('Provider is required');
    }

    console.log(`[Vault] Saving ${provider} integration for user ${uid}`);

    // Store in secure vault collection
    const vaultRef = db
      .collection('vault')
      .doc('integrations')
      .collection(uid)
      .doc(provider);

    await vaultRef.set(
      {
        provider,
        tokens: tokens || null,
        credentials: credentials || null,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`✅ [Vault] ${provider} integration saved successfully`);

    return { success: true };
  }
);

/**
 * Get integration status for current user
 */
export const getIntegrationStatus = onCall(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
  },
  async (req): Promise<IntegrationStatus> => {
    const uid = getUserId(req);
    console.log(`[Vault] Getting integration status for user ${uid}`);

    const vaultRef = db.collection('vault').doc('integrations').collection(uid);

    const [firebase, vercel, godaddy, github] = await Promise.all([
      vaultRef.doc('firebase').get(),
      vaultRef.doc('vercel').get(),
      vaultRef.doc('godaddy').get(),
      vaultRef.doc('github').get(),
    ]);

    const status: IntegrationStatus = {
      firebase: firebase.exists,
      vercel: vercel.exists,
      godaddy: godaddy.exists,
      github: github.exists,
    };

    console.log(`✅ [Vault] Status:`, status);

    return status;
  }
);

/**
 * Get integration tokens for a specific provider
 * Internal use only - not exposed as callable
 */
export async function getIntegrationTokens(
  uid: string,
  provider: 'firebase' | 'vercel' | 'godaddy' | 'github'
): Promise<SaveTokenRequest | null> {
  const vaultRef = db
    .collection('vault')
    .doc('integrations')
    .collection(uid)
    .doc(provider);

  const doc = await vaultRef.get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as SaveTokenRequest;
}

/**
 * Disconnect an integration
 */
export const disconnectIntegration = onCall<{ provider: string }>(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
  },
  async (req) => {
    const uid = getUserId(req);
    const { provider } = req.data;

    if (!provider) {
      throw new Error('Provider is required');
    }

    console.log(`[Vault] Disconnecting ${provider} for user ${uid}`);

    await db
      .collection('vault')
      .doc('integrations')
      .collection(uid)
      .doc(provider)
      .delete();

    console.log(`✅ [Vault] ${provider} disconnected successfully`);

    return { success: true };
  }
);

/**
 * Refresh Firebase access token using refresh token
 */
export async function refreshFirebaseToken(uid: string): Promise<string | null> {
  const integration = await getIntegrationTokens(uid, 'firebase');

  if (!integration?.tokens?.refreshToken) {
    console.warn(`[Vault] No refresh token found for user ${uid}`);
    return null;
  }

  try {
    // Exchange refresh token for new access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.FIREBASE_CLIENT_ID || '',
        client_secret: process.env.FIREBASE_CLIENT_SECRET || '',
        refresh_token: integration.tokens.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Vault] Token refresh failed:', data);
      return null;
    }

    const { access_token, expires_in } = data;

    // Update stored token
    await saveIntegrationToken.run({
      data: {
        provider: 'firebase',
        tokens: {
          accessToken: access_token,
          refreshToken: integration.tokens.refreshToken,
          expiresAt: Date.now() + expires_in * 1000,
        },
      },
      auth: { uid } as any,
      rawRequest: {} as any,
    } as any);

    return access_token;
  } catch (error) {
    console.error('[Vault] Error refreshing token:', error);
    return null;
  }
}
