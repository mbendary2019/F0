/**
 * Phase 44 - Figma Integration
 * Pulls design assets from Figma files and stores in Firestore
 */

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import fetch from 'node-fetch';

const db = admin.firestore();

// Get Figma token from runtime config
const getFigmaToken = () => {
  const token = process.env.FIGMA_TOKEN;
  if (!token) throw new Error('FIGMA_TOKEN not configured');
  return token;
};

// Get file IDs from runtime config
const getFileIds = () => {
  const ids = process.env.FIGMA_FILE_IDS || '';
  return ids.split(',').map((s) => s.trim()).filter(Boolean);
};

/**
 * Pull assets from a single Figma file
 */
async function pullFile(fileId: string) {
  const token = getFigmaToken();
  const url = `https://api.figma.com/v1/files/${fileId}`;

  console.log(`[figmaPull] Fetching ${fileId}...`);

  const res = await fetch(url, {
    headers: { 'X-Figma-Token': token },
  });

  if (!res.ok) {
    throw new Error(`Figma API failed: ${res.status} ${res.statusText}`);
  }

  const data: any = await res.json();
  const components = data.components || {};
  const now = admin.firestore.FieldValue.serverTimestamp();

  const writes: Promise<any>[] = [];

  for (const nodeId of Object.keys(components)) {
    const component = components[nodeId];
    const assetId = `${fileId}_${nodeId}`;

    writes.push(
      db
        .collection('ops_assets')
        .doc(assetId)
        .set(
          {
            source: 'figma',
            fileId,
            nodeId,
            name: component.name || 'Unnamed',
            type: component.type || 'COMPONENT',
            url: `https://www.figma.com/file/${fileId}?node-id=${encodeURIComponent(nodeId)}`,
            updatedAt: now,
          },
          { merge: true }
        )
    );
  }

  await Promise.all(writes);
  console.log(`[figmaPull] Saved ${writes.length} assets from ${fileId}`);
}

/**
 * Scheduled function: Pull Figma assets every 6 hours
 */
export const figmaScheduledPull = onSchedule(
  {
    schedule: 'every 6 hours',
    timeZone: 'UTC',
    retryCount: 2,
    memory: '256MiB',
  },
  async (event) => {
    const ids = getFileIds();

    if (ids.length === 0) {
      console.log('[figmaScheduledPull] No file IDs configured, skipping');
      return;
    }

    console.log(`[figmaScheduledPull] Pulling ${ids.length} files...`);

    for (const id of ids) {
      try {
        await pullFile(id);
      } catch (error: any) {
        console.error(`[figmaScheduledPull] Error pulling ${id}:`, error.message);
      }
    }
  }
);

/**
 * Callable function: On-demand Figma pull (admins only)
 */
export const figmaPullOnDemand = onCall(
  { memory: '256MiB' },
  async (request) => {
    // Admin check
    if (!request.auth?.token?.admin) {
      throw new HttpsError('permission-denied', 'Admins only');
    }

    const fileIds: string[] = request.data?.fileIds || getFileIds();

    if (fileIds.length === 0) {
      throw new HttpsError('invalid-argument', 'No file IDs provided');
    }

    console.log(`[figmaPullOnDemand] Pulling ${fileIds.length} files...`);

    for (const id of fileIds) {
      await pullFile(id);
    }

    return { ok: true, count: fileIds.length };
  }
);
