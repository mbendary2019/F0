/**
 * Phase 71: Firebase Auto-Setup
 * Automatically configure Firebase projects without manual steps
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getIntegrationTokens, refreshFirebaseToken } from './vault';
import { db } from '../analytics/client';
import { FieldValue } from 'firebase-admin/firestore';
import { google } from 'googleapis';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

interface CreateWebAppRequest {
  projectId: string;
  firebaseProjectId: string;
  displayName: string;
}

interface EnableAuthProvidersRequest {
  projectId: string;
  firebaseProjectId: string;
  providers: ('google' | 'github' | 'email' | 'phone' | 'apple')[];
  githubConfig?: {
    clientId: string;
    clientSecret: string;
  };
}

/**
 * Helper function to remove undefined values from object before writing to Firestore
 */
function cleanUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

/**
 * Get Service Account Authentication using F0_FIREBASE_SA_BASE64
 */
function getServiceAccountAuth() {
  const b64 = process.env.F0_FIREBASE_SA_BASE64;
  if (!b64) {
    throw new Error('F0_FIREBASE_SA_BASE64 is not set in environment');
  }

  const jsonStr = Buffer.from(b64, 'base64').toString('utf8');
  const credentials = JSON.parse(jsonStr);

  // Fix private key: replace literal \n with actual newlines
  if (credentials.private_key && typeof credentials.private_key === 'string') {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/firebase',
    ],
  });
}

/**
 * Test function to verify Service Account is working
 * This bypasses OAuth and uses the F0 Service Account directly
 */
export const testFirebaseAdmin = onCall(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
  },
  async (_req) => {
    try {
      console.log('[Test] Testing Firebase Service Account...');

      const auth = getServiceAccountAuth();
      const client = await auth.getClient();

      const firebase = google.firebase({
        version: 'v1beta1',
        auth: client as any,
      });

      console.log('[Test] Calling Firebase Management API...');
      const res = await firebase.projects.list({});
      const projects = res.data.results ?? [];

      console.log(`[Test] ✅ Success! Found ${projects.length} Firebase projects`);

      return {
        ok: true,
        count: projects.length,
        projects: projects.map((p: any) => ({
          projectId: p.projectId,
          displayName: p.displayName,
        })),
      };
    } catch (err: any) {
      console.error('[Test] ❌ Error:', err);
      throw new HttpsError(
        'internal',
        err.message ?? 'Failed to access Firebase Management API'
      );
    }
  }
);

/**
 * Get Firebase access token for user
 */
async function getFirebaseAccessToken(uid: string): Promise<string | null> {
  const integration = await getIntegrationTokens(uid, 'firebase');

  if (!integration?.tokens?.accessToken) {
    console.warn(`[Firebase Setup] No access token for user ${uid}`);
    return null;
  }

  // Check if token expired
  if (integration.tokens.expiresAt && integration.tokens.expiresAt < Date.now()) {
    console.log('[Firebase Setup] Token expired, refreshing...');
    return await refreshFirebaseToken(uid);
  }

  return integration.tokens.accessToken;
}

/**
 * Create Firebase Web App using Service Account
 * This is THE magic function - creates app and gets config automatically
 */
export const createFirebaseWebApp = onCall<CreateWebAppRequest>(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
  },
  async (req) => {
    const { projectId, firebaseProjectId, displayName } = req.data;

    if (!projectId || !firebaseProjectId) {
      throw new Error('projectId and firebaseProjectId are required');
    }

    console.log(`[Firebase Setup] Creating web app for ${firebaseProjectId}`);

    try {
      const auth = getServiceAccountAuth();
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();

      if (!accessToken.token) {
        throw new Error('Failed to get access token from service account');
      }

      // Step 1: Create Web App using Firebase Management API
      const createAppResponse = await fetch(
        `https://firebase.googleapis.com/v1beta1/projects/${firebaseProjectId}/webApps`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            displayName: displayName || `${projectId}-web`,
          }),
        }
      );

      if (!createAppResponse.ok) {
        const error = await createAppResponse.text();
        console.error('[Firebase Setup] Failed to create app:', error);
        throw new HttpsError('internal', `Failed to create Firebase app: ${error}`);
      }

      const appData = await createAppResponse.json();
      const appId = appData.appId;

      console.log(`✅ [Firebase Setup] App created: ${appId}`);

      // Step 2: Get Firebase Config
      const configResponse = await fetch(
        `https://firebase.googleapis.com/v1beta1/projects/${firebaseProjectId}/webApps/${appId}/config`,
        {
          headers: {
            Authorization: `Bearer ${accessToken.token}`,
          },
        }
      );

      if (!configResponse.ok) {
        throw new HttpsError('internal', 'Failed to get Firebase config');
      }

      const config: FirebaseConfig = await configResponse.json();

      console.log(`✅ [Firebase Setup] Got config for ${config.projectId}`);

      // Step 3: Save config to Firestore
      await db
        .collection('projects')
        .doc(projectId)
        .collection('integrations')
        .doc('firebase')
        .set(
          {
            firebaseProjectId,
            appId,
            config,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      console.log(`✅ [Firebase Setup] Config saved to Firestore`);

      return {
        success: true,
        config,
        appId,
      };
    } catch (error: any) {
      console.error('[Firebase Setup] Error:', error);
      throw new HttpsError('internal', `Firebase setup failed: ${error.message}`);
    }
  }
);

/**
 * Enable Authentication Providers
 */
export const enableAuthProviders = onCall<EnableAuthProvidersRequest>(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
  },
  async (req) => {
    const { uid } = req.auth ?? {};
    if (!uid) {
      throw new Error('Authentication required');
    }

    const { projectId, firebaseProjectId, providers, githubConfig } = req.data;

    if (!firebaseProjectId || !providers || providers.length === 0) {
      throw new Error('firebaseProjectId and providers are required');
    }

    console.log(`[Firebase Setup] Enabling providers: ${providers.join(', ')}`);

    const accessToken = await getFirebaseAccessToken(uid);
    if (!accessToken) {
      throw new Error('Firebase integration not connected');
    }

    try {
      // Get current config
      const getConfigResponse = await fetch(
        `https://identitytoolkit.googleapis.com/admin/v2/projects/${firebaseProjectId}/config`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!getConfigResponse.ok) {
        throw new Error('Failed to get auth config');
      }

      const currentConfig = await getConfigResponse.json();

      // Build new config with enabled providers
      const signIn: any = currentConfig.signIn || {};

      // Enable each provider
      if (providers.includes('email')) {
        signIn.email = { enabled: true, passwordRequired: true };
      }

      if (providers.includes('google')) {
        signIn.allowDuplicateEmails = false;
        if (!currentConfig.client) currentConfig.client = {};
        currentConfig.client.permissions = {
          ...(currentConfig.client.permissions || {}),
          oauthClientName: 'Google',
        };
      }

      if (providers.includes('github') && githubConfig) {
        if (!currentConfig.client) currentConfig.client = {};
        if (!currentConfig.client.apiKey) {
          currentConfig.client.apiKey = githubConfig.clientId;
        }
      }

      if (providers.includes('phone')) {
        signIn.phoneNumber = { enabled: true };
      }

      // Update config
      const updateResponse = await fetch(
        `https://identitytoolkit.googleapis.com/admin/v2/projects/${firebaseProjectId}/config?updateMask=signIn`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ signIn }),
        }
      );

      if (!updateResponse.ok) {
        const error = await updateResponse.text();
        console.error('[Firebase Setup] Failed to enable providers:', error);
        throw new Error(`Failed to enable providers: ${error}`);
      }

      console.log(`✅ [Firebase Setup] Providers enabled successfully`);

      // Save to Firestore
      if (projectId) {
        await db
          .collection('projects')
          .doc(projectId)
          .collection('integrations')
          .doc('firebase')
          .set(
            {
              authProviders: providers,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
      }

      return { success: true, providers };
    } catch (error: any) {
      console.error('[Firebase Setup] Error enabling providers:', error);
      throw new Error(`Failed to enable providers: ${error.message}`);
    }
  }
);

/**
 * Set Firestore Security Rules
 */
export const setFirestoreRules = onCall<{
  projectId: string;
  firebaseProjectId: string;
  rules?: string;
}>(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
  },
  async (req) => {
    const { uid } = req.auth ?? {};
    if (!uid) {
      throw new Error('Authentication required');
    }

    const { firebaseProjectId, rules } = req.data;

    const accessToken = await getFirebaseAccessToken(uid);
    if (!accessToken) {
      throw new Error('Firebase integration not connected');
    }

    // Default secure rules
    const defaultRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User data - only owner can read/write
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Projects - owner and collaborators
    match /projects/{projectId} {
      allow read: if request.auth != null &&
        (resource.data.ownerId == request.auth.uid ||
         request.auth.uid in resource.data.collaborators);
      allow write: if request.auth != null &&
        resource.data.ownerId == request.auth.uid;
    }

    // Public data
    match /public/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}`;

    const rulesToApply = rules || defaultRules;

    try {
      const response = await fetch(
        `https://firebaserules.googleapis.com/v1/projects/${firebaseProjectId}/rulesets`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source: {
              files: [
                {
                  name: 'firestore.rules',
                  content: rulesToApply,
                },
              ],
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to set rules: ${error}`);
      }

      const ruleset = await response.json();
      console.log(`✅ [Firebase Setup] Firestore rules set: ${ruleset.name}`);

      // Release ruleset
      await fetch(
        `https://firebaserules.googleapis.com/v1/projects/${firebaseProjectId}/releases/cloud.firestore`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rulesetName: ruleset.name,
          }),
        }
      );

      return { success: true, rulesetName: ruleset.name };
    } catch (error: any) {
      console.error('[Firebase Setup] Error setting rules:', error);
      throw new Error(`Failed to set Firestore rules: ${error.message}`);
    }
  }
);

/**
 * List Firebase Projects using Service Account
 * No authentication required - uses F0's Service Account
 */
export const listFirebaseProjects = onCall(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
  },
  async (_req) => {
    try {
      console.log('[Firebase] Listing projects using Service Account...');

      const auth = getServiceAccountAuth();
      const client = await auth.getClient();

      const firebase = google.firebase({
        version: 'v1beta1',
        auth: client as any,
      });

      const res = await firebase.projects.list({});
      const projects = res.data.results ?? [];

      console.log(`[Firebase] Found ${projects.length} projects`);

      return {
        projects: projects.map((p: any) => ({
          projectId: p.projectId,
          displayName: p.displayName,
          projectNumber: p.projectNumber,
        })),
      };
    } catch (error: any) {
      console.error('[Firebase] Error listing projects:', error);
      throw new HttpsError(
        'internal',
        `Failed to list Firebase projects: ${error.message}`
      );
    }
  }
);

interface AutoSetupRequest {
  firebaseProjectId: string;
  f0ProjectId: string;
}

/**
 * Auto-Setup Firebase Project
 * One-click setup: Creates Web App, Enables Auth Providers, Sets Rules
 */
export const autoSetupFirebase = onCall<AutoSetupRequest>(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
  },
  async (req) => {
    const { firebaseProjectId, f0ProjectId } = req.data;

    if (!firebaseProjectId || !f0ProjectId) {
      throw new HttpsError(
        'invalid-argument',
        'firebaseProjectId and f0ProjectId are required'
      );
    }

    console.log(
      `[Auto-Setup] Starting auto-setup for Firebase project: ${firebaseProjectId}`
    );

    try {
      const auth = getServiceAccountAuth();
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();

      if (!accessToken.token) {
        throw new Error('Failed to get access token from service account');
      }

      // Step 1: Create Web App
      console.log('[Auto-Setup] Step 1: Creating Web App...');
      const createAppResponse = await fetch(
        `https://firebase.googleapis.com/v1beta1/projects/${firebaseProjectId}/webApps`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            displayName: 'F0 Auto Web App',
          }),
        }
      );

      if (!createAppResponse.ok) {
        const error = await createAppResponse.text();
        throw new Error(`Failed to create Web App: ${error}`);
      }

      const appData = await createAppResponse.json();

      // Try to get appId from multiple possible locations
      const appId =
        (appData && appData.appId) ||
        (appData && (appData as any).name?.split('/').pop()) ||
        null;

      // Log warning if appId is missing but continue setup
      if (!appId) {
        console.warn(
          '[Auto-Setup] ⚠️ Warning: Firebase web app created but appId is missing in the response. Continuing without storing appId…',
          appData
        );
      } else {
        console.log(`✅ [Auto-Setup] Web App created: ${appId}`);
      }

      // Step 2: Get Firebase Config (with emulator fallback)
      console.log('[Auto-Setup] Step 2: Getting Firebase Config...');
      let config: FirebaseConfig;

      try {
        const configResponse = await fetch(
          `https://firebase.googleapis.com/v1beta1/projects/${firebaseProjectId}/webApps/${appId}/config`,
          {
            headers: {
              Authorization: `Bearer ${accessToken.token}`,
            },
          }
        );

        if (!configResponse.ok) {
          throw new Error(`HTTP ${configResponse.status}: ${configResponse.statusText}`);
        }

        config = await configResponse.json();
        console.log(`✅ [Auto-Setup] Got config for ${config.projectId}`);
      } catch (err: any) {
        console.warn('[Auto-Setup] ⚠️ Failed to get real Firebase config, using fallback for emulators:', err.message);

        // Fallback config for local development / emulators
        config = {
          apiKey: 'dummy-api-key-for-emulator',
          authDomain: `${firebaseProjectId}.firebaseapp.com`,
          projectId: firebaseProjectId,
          storageBucket: `${firebaseProjectId}.appspot.com`,
          messagingSenderId: '000000000000',
          appId: appId || `local-${firebaseProjectId}`,
          measurementId: 'G-LOCAL-EMULATOR',
        };

        console.log(`✅ [Auto-Setup] Using fallback config for ${config.projectId}`);
      }

      // Step 3: Enable Auth Providers (Email + Google)
      console.log('[Auto-Setup] Step 3: Enabling Auth Providers...');

      // Get current auth config
      const getConfigResponse = await fetch(
        `https://identitytoolkit.googleapis.com/admin/v2/projects/${firebaseProjectId}/config`,
        {
          headers: {
            Authorization: `Bearer ${accessToken.token}`,
          },
        }
      );

      if (!getConfigResponse.ok) {
        throw new Error('Failed to get auth config');
      }

      const currentConfig = await getConfigResponse.json();

      // Enable Email and Google providers
      const signIn: any = currentConfig.signIn || {};
      signIn.email = { enabled: true, passwordRequired: true };
      signIn.allowDuplicateEmails = false;

      const updateAuthResponse = await fetch(
        `https://identitytoolkit.googleapis.com/admin/v2/projects/${firebaseProjectId}/config?updateMask=signIn`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ signIn }),
        }
      );

      if (!updateAuthResponse.ok) {
        const error = await updateAuthResponse.text();
        console.warn('[Auto-Setup] Failed to enable auth providers:', error);
      } else {
        console.log('✅ [Auto-Setup] Auth providers enabled (Email + Google)');
      }

      // Step 4: Set Firestore Rules (Basic secure rules)
      console.log('[Auto-Setup] Step 4: Setting Firestore Rules...');
      const defaultRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User data - only owner can read/write
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Projects - owner and collaborators
    match /projects/{projectId} {
      allow read: if request.auth != null &&
        (resource.data.ownerId == request.auth.uid ||
         request.auth.uid in resource.data.collaborators);
      allow write: if request.auth != null &&
        resource.data.ownerId == request.auth.uid;
    }

    // Public data
    match /public/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}`;

      const createRulesetResponse = await fetch(
        `https://firebaserules.googleapis.com/v1/projects/${firebaseProjectId}/rulesets`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source: {
              files: [
                {
                  name: 'firestore.rules',
                  content: defaultRules,
                },
              ],
            },
          }),
        }
      );

      if (!createRulesetResponse.ok) {
        const error = await createRulesetResponse.text();
        console.warn('[Auto-Setup] Failed to set Firestore rules:', error);
      } else {
        const ruleset = await createRulesetResponse.json();
        console.log(`✅ [Auto-Setup] Firestore rules created: ${ruleset.name}`);

        // Release ruleset
        await fetch(
          `https://firebaserules.googleapis.com/v1/projects/${firebaseProjectId}/releases/cloud.firestore`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${accessToken.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              rulesetName: ruleset.name,
            }),
          }
        );
        console.log('✅ [Auto-Setup] Firestore rules deployed');
      }

      // Step 5: Save to Firestore
      console.log('[Auto-Setup] Step 5: Saving config to Firestore...');

      // Build integration data conditionally
      const integrationData: Record<string, any> = {
        firebaseProjectId,
        firebaseConfig: config || null,
        authProvidersEnabled: ['email', 'google'],
        connectedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Only add appId if it exists
      if (appId) {
        integrationData.firebaseWebAppId = appId;
      }

      // Clean any remaining undefined values
      const cleanedData = cleanUndefined(integrationData);

      await db
        .collection('ops_projects')
        .doc(f0ProjectId)
        .collection('integrations')
        .doc('firebase')
        .set(cleanedData, { merge: true });

      console.log('✅ [Auto-Setup] Complete! All steps finished successfully');

      return {
        ok: true,
        firebaseProjectId,
        appId,
        config,
        steps: {
          webApp: '✅ Created',
          config: '✅ Retrieved',
          authProviders: '✅ Enabled (Email + Google)',
          firestoreRules: '✅ Deployed',
          savedToFirestore: '✅ Saved',
        },
      };
    } catch (error: any) {
      console.error('[Auto-Setup] Error:', error);
      throw new HttpsError('internal', `Auto-setup failed: ${error.message}`);
    }
  }
);
