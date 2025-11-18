/**
 * Phase 49: Log Ingestion Endpoint
 * HTTPS endpoint for receiving logs from clients
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { redactPII } from '../util/redact';
import { hashIP, createFingerprint } from '../util/hash';
import { checkRate } from '../util/rateLimit';

const db = admin.firestore();

export const log = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-AppCheck');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const body = req.body;
    const { level, service, code, message, stack, context, fingerprint } = body;

    // Get IP
    const ip = (req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || '0.0.0.0').split(',')[0].trim();

    // Rate limit: 120 requests per minute per IP
    if (!checkRate(`log:${ip}`, 120, 60_000)) {
      return res.status(429).json({ ok: false, error: 'rate_limited' });
    }

    // Optional App Check verification
    const forceAppCheck = process.env.FORCE_APPCHECK === '1';
    if (forceAppCheck) {
      const appCheckToken = req.headers['x-firebase-appcheck'] as string;
      if (!appCheckToken) {
        return res.status(403).json({ ok: false, error: 'app_check_required' });
      }
      // Verify App Check token here if needed
    }

    // Build event
    const ts = Date.now();
    const expireAt = ts + (7 * 24 * 60 * 60 * 1000); // 7 days TTL

    const event = {
      type: 'log',
      level: level || 'info',
      service: service || 'unknown',
      code: code || 0,
      message: redactPII(message || ''),
      stack: stack ? redactPII(stack) : null,
      context: context || {},
      fingerprint: fingerprint || createFingerprint(service || 'unknown', code || 0, context?.route || '/'),
      ipHash: hashIP(ip),
      ts,
      expireAt,
    };

    // Write to Firestore
    await db.collection('ops_events').add(event);

    return res.status(200).json({ ok: true, eventId: event.fingerprint });
  } catch (error: any) {
    console.error('Error in log endpoint:', error);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});
