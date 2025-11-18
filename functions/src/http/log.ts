/**
 * Phase 49: Log Ingestion Endpoint
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { redactPII } from '../util/redact';
import { hashIP, createFingerprint } from '../util/hash';
import { checkRate } from '../util/rateLimit';

const db = admin.firestore();

export const log = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-AppCheck');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  try {
    const body = req.body;
    const { level, service, code, message, stack, context, fingerprint } = body;
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '0.0.0.0').split(',')[0].trim();

    if (!checkRate('log:' + ip, 120, 60_000)) {
      res.status(429).json({ ok: false, error: 'rate_limited' });
      return;
    }

    const ts = Date.now();
    const expireAt = ts + (7 * 24 * 60 * 60 * 1000);

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

    await db.collection('ops_events').add(event);
    res.status(200).json({ ok: true, eventId: event.fingerprint });
  } catch (error: any) {
    console.error('Error in log endpoint:', error);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});
