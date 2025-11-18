#!/usr/bin/env node
// Enable F0 feature flag in Firestore
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_FILE ||
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
  path.join(__dirname, '../serviceAccountKey.json');

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'from-zero-84253'
  });
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  console.log('ℹ️  Make sure serviceAccountKey.json exists or FIREBASE_SERVICE_ACCOUNT_JSON is set');
  process.exit(1);
}

const db = admin.firestore();

async function enableF0Flag() {
  try {
    console.log('📝 Creating/updating feature_flags document...');

    await db.collection('ops_config').doc('feature_flags').set({
      'f0.enabled': true,
      'f0.orchestratorUrl': 'http://localhost:8080',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log('✅ Feature flag enabled successfully!');
    console.log('   f0.enabled: true');
    console.log('   f0.orchestratorUrl: http://localhost:8080');

    // Read back to confirm
    const doc = await db.collection('ops_config').doc('feature_flags').get();
    console.log('\n📋 Current feature_flags:', doc.data());

    process.exit(0);
  } catch (error) {
    console.error('❌ Error enabling F0 flag:', error);
    process.exit(1);
  }
}

enableF0Flag();
