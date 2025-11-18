// F0 Minimal Functions Export - Phase 35 & 36 Only
// This file exports only working functions, skipping old phases with errors

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (once)
if (!admin.apps.length) {
  admin.initializeApp();
}

// ============================================================
// HEALTH CHECK (Essential)
// ============================================================

export const readyz = functions.https.onRequest((_req, res) => {
  res.status(200).json({ 
    ok: true, 
    ts: Date.now(),
    service: 'f0-functions',
    version: '1.0.0',
    phase: '35+36'
  });
});

// ============================================================
// PHASE 35: Cross-Device Sync (Conditional Exports)
// ============================================================

// Try to export Phase 35 functions if they exist and are error-free
// If import fails, we skip them gracefully

try {
  // Import with .js extension for ES modules compatibility
  const { heartbeat } = require('./sync/presence');
  if (heartbeat) {
    exports.heartbeat = heartbeat;
    console.log('✅ Exported: heartbeat');
  }
} catch (error) {
  console.warn('⚠️  Skipping heartbeat:', error.message);
}

try {
  const { registerToken } = require('./sync/deviceTokens');
  if (registerToken) {
    exports.registerToken = registerToken;
    console.log('✅ Exported: registerToken');
  }
} catch (error) {
  console.warn('⚠️  Skipping registerToken:', error.message);
}

try {
  const { processQueues } = require('./sync/queueWorker');
  if (processQueues) {
    exports.processQueues = processQueues;
    console.log('✅ Exported: processQueues');
  }
} catch (error) {
  console.warn('⚠️  Skipping processQueues:', error.message);
}

try {
  const { createHandoff } = require('./sync/handoff');
  if (createHandoff) {
    exports.createHandoff = createHandoff;
    console.log('✅ Exported: createHandoff');
  }
} catch (error) {
  console.warn('⚠️  Skipping createHandoff:', error.message);
}

// ============================================================
// PHASE 36: Audit System (Conditional Exports)
// ============================================================

// Note: Audit functions are primarily used as middleware
// They don't need to be exported as standalone functions
// But we can export a test function

export const auditTest = functions.https.onRequest(async (req, res) => {
  try {
    // Try to use audit writer if available
    const { writeAudit } = require('./audit/writer');
    
    await writeAudit({
      action: 'test.audit',
      actor: {
        uid: 'test-user',
        ip: req.ip || 'unknown',
      },
      ok: true,
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({ 
      ok: true, 
      message: 'Audit test successful',
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('Audit test failed:', error);
    res.status(200).json({ 
      ok: false, 
      message: 'Audit system not available',
      error: error.message
    });
  }
});

// ============================================================
// LEGACY SUPPORT (Stub)
// ============================================================

// Provide stub for old webhook endpoint if needed
export const stripeWebhook = functions.https.onRequest((req, res) => {
  res.status(200).json({ 
    ok: false, 
    message: 'This endpoint has been moved. Use /api/webhooks/stripe in the Next.js app instead.',
    redirect: '/api/webhooks/stripe'
  });
});

console.log('✅ F0 Minimal Functions loaded successfully');


