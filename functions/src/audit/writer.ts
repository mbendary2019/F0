// F0 Phase 36 - Tamper-Evident Audit Writer

import * as admin from 'firebase-admin';
import crypto from 'crypto';
import { AuditEvent, AuditEntry, AuditMeta } from './types';

/**
 * SHA-256 hash
 */
function sha256(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

/**
 * Canonical JSON serialization (sorted keys for consistent hashing)
 */
function canonical(obj: any): string {
  if (obj === null || obj === undefined) return '{}';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return JSON.stringify(obj.map(canonical));
  const sorted = Object.keys(obj).sort();
  const pairs = sorted.map(k => `"${k}":${canonical(obj[k])}`);
  return `{${pairs.join(',')}}`;
}

/**
 * Get current day (YYYY-MM-DD) in UTC
 */
function getCurrentDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Write tamper-evident audit event
 * 
 * Creates a hash chain: chainHash = SHA256(prevHash + payloadHash)
 * Stores in /audits/{day}/events/{eventId} with transaction to update meta
 */
export async function writeAudit(ev: AuditEvent): Promise<{ id: string; day: string; chainHash: string }> {
  const db = admin.firestore();
  const day = getCurrentDay();
  
  const metaRef = db.doc(`audits_meta/${day}`);
  const eventsCol = db.collection(`audits/${day}/events`);
  const newEventRef = eventsCol.doc();

  // Get previous chain hash
  const meta = await metaRef.get();
  const prevHash = meta.exists ? (meta.get('lastChainHash') as string || '') : '';

  // Calculate hashes
  const payloadHash = sha256(canonical(ev.payload));
  const chainHash = sha256(prevHash + payloadHash);

  // Prepare audit entry
  const entry: AuditEntry = {
    ts: admin.firestore.FieldValue.serverTimestamp(),
    actor: ev.actor,
    action: ev.action,
    target: ev.target || null,
    ctx: {
      ok: ev.ok !== false,
      code: ev.code || null,
      latencyMs: ev.latencyMs || 0,
      errorMessage: ev.errorMessage || null,
      metadata: ev.metadata || null,
    },
    payloadHash,
    prevHash,
    chainHash,
  };

  // Write with transaction to ensure chain integrity
  await db.runTransaction(async (tx) => {
    // Write event
    tx.set(newEventRef, entry);

    // Update meta
    const metaUpdate: Partial<AuditMeta> = {
      lastEventId: newEventRef.id,
      lastChainHash: chainHash,
      eventCount: admin.firestore.FieldValue.increment(1) as any,
      lastEventTs: admin.firestore.FieldValue.serverTimestamp() as any,
    };

    if (!meta.exists) {
      metaUpdate.firstEventTs = admin.firestore.FieldValue.serverTimestamp() as any;
    }

    tx.set(metaRef, metaUpdate, { merge: true });
  });

  console.log(`✅ Audit event written: ${ev.action} by ${ev.actor.uid} (chain: ${chainHash.slice(0, 12)}...)`);

  return {
    id: newEventRef.id,
    day,
    chainHash,
  };
}

/**
 * Verify audit chain integrity for a given day
 */
export async function verifyAuditChain(day: string): Promise<{
  valid: boolean;
  totalEvents: number;
  brokenLinks: Array<{ eventId: string; expectedHash: string; actualHash: string }>;
}> {
  const db = admin.firestore();
  const eventsSnap = await db.collection(`audits/${day}/events`).orderBy('ts', 'asc').get();

  const brokenLinks: Array<{ eventId: string; expectedHash: string; actualHash: string }> = [];
  let prevHash = '';

  for (const doc of eventsSnap.docs) {
    const data = doc.data();
    const expectedChainHash = sha256(prevHash + data.payloadHash);

    if (data.chainHash !== expectedChainHash) {
      brokenLinks.push({
        eventId: doc.id,
        expectedHash: expectedChainHash,
        actualHash: data.chainHash,
      });
    }

    if (data.prevHash !== prevHash) {
      brokenLinks.push({
        eventId: doc.id,
        expectedHash: `prevHash should be ${prevHash}`,
        actualHash: `but got ${data.prevHash}`,
      });
    }

    prevHash = data.chainHash;
  }

  return {
    valid: brokenLinks.length === 0,
    totalEvents: eventsSnap.size,
    brokenLinks,
  };
}

/**
 * Get audit events for a day
 */
export async function getAuditEvents(day: string, limit = 200): Promise<any[]> {
  const db = admin.firestore();
  const snap = await db.collection(`audits/${day}/events`)
    .orderBy('ts', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map(doc => ({
    id: doc.id,
    day,
    ...doc.data(),
  }));
}

/**
 * Get audit events across all days (collection group query)
 */
export async function getRecentAuditEvents(limit = 200): Promise<any[]> {
  const db = admin.firestore();
  const snap = await db.collectionGroup('events')
    .orderBy('ts', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map(doc => {
    const dayDoc = doc.ref.parent.parent;
    return {
      id: doc.id,
      day: dayDoc?.id || 'unknown',
      ...doc.data(),
    };
  });
}


