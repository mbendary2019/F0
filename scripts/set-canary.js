#!/usr/bin/env node

/**
 * Set Canary Rollout Percentage
 * Usage:
 *   node scripts/set-canary.js 50
 *   node scripts/set-canary.js 0 --rollback
 *   node scripts/set-canary.js 100 --promote
 */

const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : null;

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    console.warn(
      "⚠️  GOOGLE_APPLICATION_CREDENTIALS not set, using default credentials"
    );
    admin.initializeApp();
  }
}

const db = admin.firestore();

async function setCanary() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
📊 Canary Rollout Control

Usage:
  node scripts/set-canary.js <percent> [options]

Arguments:
  <percent>    Rollout percentage (0-100)

Options:
  --rollback   Force rollback (sets rollbackRequested: true)
  --promote    Mark as manual promotion
  --pause      Pause canary progression
  --resume     Resume canary progression

Examples:
  node scripts/set-canary.js 50               # Set to 50%
  node scripts/set-canary.js 0 --rollback     # Rollback to 0%
  node scripts/set-canary.js 100 --promote    # Full rollout
  node scripts/set-canary.js 25 --pause       # Pause at 25%
    `);
    process.exit(0);
  }

  const percent = parseInt(args[0], 10);
  const isRollback = args.includes("--rollback");
  const isPromotion = args.includes("--promote");
  const isPause = args.includes("--pause");
  const isResume = args.includes("--resume");

  if (isNaN(percent) || percent < 0 || percent > 100) {
    console.error("❌ Error: Percentage must be between 0 and 100");
    process.exit(1);
  }

  console.log("🔧 Setting canary rollout...");

  const update = {
    rolloutPercent: percent,
    rollbackRequested: isRollback,
    paused: isPause ? true : isResume ? false : undefined,
    lastDecision: isRollback
      ? "manual_rollback"
      : isPromotion
      ? "manual_promote"
      : "manual_set",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    manualOverride: true,
    manualOverrideBy: process.env.USER || "script",
    manualOverrideAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Remove undefined fields
  Object.keys(update).forEach(
    (key) => update[key] === undefined && delete update[key]
  );

  try {
    await db.doc("config/canary").set(update, { merge: true });

    console.log("✅ Canary configuration updated:");
    console.log(`   Rollout: ${percent}%`);
    if (isRollback) console.log(`   🔄 Rollback requested`);
    if (isPromotion) console.log(`   ✨ Manual promotion`);
    if (isPause) console.log(`   ⏸️  Progression paused`);
    if (isResume) console.log(`   ▶️  Progression resumed`);

    console.log(`\n📊 View status: https://dashboard.fz-labs.io/ops`);

    // Create audit log
    await db.collection("admin_activity").add({
      ts: admin.firestore.FieldValue.serverTimestamp(),
      action: "canary.manual_set",
      actor: {
        source: "script",
        user: process.env.USER || "unknown",
      },
      target: {
        type: "canary_config",
        rolloutPercent: percent,
      },
      metadata: {
        rollback: isRollback,
        promotion: isPromotion,
        pause: isPause,
        resume: isResume,
      },
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error setting canary:", error.message);
    process.exit(1);
  }
}

setCanary();
