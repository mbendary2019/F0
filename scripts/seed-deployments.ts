#!/usr/bin/env node

/**
 * Seed Deployments for Testing
 * Creates sample deployment records in ops_deployments collection
 * Run: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm tsx scripts/seed-deployments.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_FILE ||
  path.join(process.env.HOME || '', '.secrets/firebase.json');

let app;
try {
  const serviceAccount = require(serviceAccountPath);
  app = initializeApp({
    credential: cert(serviceAccount),
    projectId: 'from-zero-84253',
  });
  console.log('✅ Firebase Admin initialized with service account');
} catch (err) {
  console.warn('⚠️  Service account not found, using default credentials');
  app = initializeApp({
    projectId: 'from-zero-84253',
  });
}

const db = getFirestore(app);

// Sample deployment data
const sampleDeployments = [
  {
    ownerUid: 'test-user-1',
    projectId: 'QNnGNj3QRLlaVwg9y8Lz',
    projectName: 'F0 Platform',
    env: 'production',
    status: 'success',
    branch: 'main',
    label: 'feat: Phase 85 - Deployments System',
    provider: 'vercel',
    url: 'https://f0-platform.vercel.app',
    logsUrl: 'https://vercel.com/from-zero/f0-platform/deployments/abc123',
    createdAt: Date.now() - 3600000, // 1 hour ago
    finishedAt: Date.now() - 3540000, // 59 minutes ago
  },
  {
    ownerUid: 'test-user-1',
    projectId: 'QNnGNj3QRLlaVwg9y8Lz',
    projectName: 'F0 Platform',
    env: 'preview',
    status: 'success',
    branch: 'dev',
    label: 'feat: Add deployment tracking',
    provider: 'vercel',
    url: 'https://f0-platform-dev.vercel.app',
    logsUrl: 'https://vercel.com/from-zero/f0-platform/deployments/def456',
    createdAt: Date.now() - 7200000, // 2 hours ago
    finishedAt: Date.now() - 7140000, // 1h 59m ago
  },
  {
    ownerUid: 'test-user-1',
    projectId: 'QNnGNj3QRLlaVwg9y8Lz',
    projectName: 'F0 Platform',
    env: 'production',
    status: 'failed',
    branch: 'main',
    label: 'fix: Deployment configuration',
    provider: 'github-actions',
    logsUrl: 'https://github.com/from-zero/f0-platform/actions/runs/123456',
    createdAt: Date.now() - 10800000, // 3 hours ago
    finishedAt: Date.now() - 10740000, // 2h 59m ago
  },
  {
    ownerUid: 'test-user-1',
    projectId: 'another-project-id',
    projectName: 'E-commerce Store',
    env: 'production',
    status: 'success',
    branch: 'main',
    label: 'feat: Add payment gateway',
    provider: 'vercel',
    url: 'https://ecommerce-store.vercel.app',
    logsUrl: 'https://vercel.com/from-zero/ecommerce/deployments/ghi789',
    createdAt: Date.now() - 14400000, // 4 hours ago
    finishedAt: Date.now() - 14340000, // 3h 59m ago
  },
  {
    ownerUid: 'test-user-1',
    projectId: 'another-project-id',
    projectName: 'E-commerce Store',
    env: 'preview',
    status: 'in_progress',
    branch: 'feature/checkout',
    label: 'feat: Implement checkout flow',
    provider: 'vercel',
    createdAt: Date.now() - 300000, // 5 minutes ago
    finishedAt: null,
  },
];

async function seedDeployments() {
  try {
    console.log('🌱 Seeding deployments...\n');

    const batch = db.batch();
    const deploymentIds: string[] = [];

    for (const deployment of sampleDeployments) {
      const docRef = db.collection('ops_deployments').doc();
      batch.set(docRef, deployment);
      deploymentIds.push(docRef.id);

      console.log(`📦 Creating deployment: ${deployment.projectName} (${deployment.env})`);
      console.log(`   Status: ${deployment.status}`);
      console.log(`   Branch: ${deployment.branch}`);
      console.log(`   Provider: ${deployment.provider}`);
      console.log(`   ID: ${docRef.id}\n`);
    }

    await batch.commit();

    console.log('✅ Successfully seeded deployments!');
    console.log(`\n📊 Summary:`);
    console.log(`   Total deployments: ${sampleDeployments.length}`);
    console.log(`   Production: ${sampleDeployments.filter(d => d.env === 'production').length}`);
    console.log(`   Preview: ${sampleDeployments.filter(d => d.env === 'preview').length}`);
    console.log(`   Success: ${sampleDeployments.filter(d => d.status === 'success').length}`);
    console.log(`   Failed: ${sampleDeployments.filter(d => d.status === 'failed').length}`);
    console.log(`   In Progress: ${sampleDeployments.filter(d => d.status === 'in_progress').length}`);
    console.log(`\n🔗 View deployments at:`);
    console.log(`   All: http://localhost:3030/en/deployments`);
    console.log(`   Project 1: http://localhost:3030/en/deployments?project=QNnGNj3QRLlaVwg9y8Lz`);
    console.log(`   Project 2: http://localhost:3030/en/deployments?project=another-project-id`);

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error seeding deployments:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seedDeployments();
