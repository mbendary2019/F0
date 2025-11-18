#!/usr/bin/env node

/**
 * Create Deployment Record
 * Called by CI/CD to record deployment metadata
 */

const admin = require("firebase-admin");
const { execSync } = require("child_process");

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
    admin.initializeApp();
  }
}

const db = admin.firestore();

async function createDeploymentRecord() {
  try {
    // Get git information
    const commit = execSync("git rev-parse HEAD").toString().trim();
    const shortCommit = execSync("git rev-parse --short HEAD")
      .toString()
      .trim();
    const branch = execSync("git rev-parse --abbrev-ref HEAD")
      .toString()
      .trim();
    const author = execSync("git log -1 --pretty=format:'%an'")
      .toString()
      .trim();
    const message = execSync("git log -1 --pretty=format:'%s'")
      .toString()
      .trim();

    // Get GitHub Actions context if available
    const ciContext = {
      workflow: process.env.GITHUB_WORKFLOW,
      runId: process.env.GITHUB_RUN_ID,
      runNumber: process.env.GITHUB_RUN_NUMBER,
      actor: process.env.GITHUB_ACTOR,
      repository: process.env.GITHUB_REPOSITORY,
      ref: process.env.GITHUB_REF,
    };

    // Create deployment record
    const deployment = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      commit: {
        sha: commit,
        short: shortCommit,
        message,
        author,
        branch,
      },
      ci: ciContext,
      status: "deployed",
      phase: "canary",
      initialRollout: parseInt(process.env.ROLLOUT_PERCENT || "10", 10),
      environment: process.env.NODE_ENV || "production",
    };

    const docRef = await db.collection("deployments").add(deployment);

    console.log("✅ Deployment record created:", docRef.id);
    console.log(`   Commit: ${shortCommit} (${author})`);
    console.log(`   Message: ${message}`);
    console.log(`   Branch: ${branch}`);

    // Also update latest deployment pointer
    await db.doc("deployments/latest").set(
      {
        ...deployment,
        deploymentId: docRef.id,
      },
      { merge: true }
    );

    console.log("📝 Latest deployment pointer updated");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating deployment record:", error.message);
    process.exit(1);
  }
}

createDeploymentRecord();
