#!/usr/bin/env node
/**
 * Check Firebase User Custom Claims
 * Usage: node scripts/check-user-claims.mjs email@example.com
 */

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_FILE ||
  `${process.env.HOME}/.secrets/firebase.json`;

try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
} catch (e) {
  console.error('Failed to initialize Firebase Admin:', e.message);
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/check-user-claims.mjs email@example.com');
  process.exit(1);
}

async function checkClaims(email) {
  try {
    const user = await getAuth().getUserByEmail(email);
    console.log('\n✓ User found:');
    console.log('  UID:', user.uid);
    console.log('  Email:', user.email);
    console.log('  Email Verified:', user.emailVerified);
    console.log('\n📋 Custom Claims:');
    console.log(JSON.stringify(user.customClaims || {}, null, 2));

    if (!user.customClaims || Object.keys(user.customClaims).length === 0) {
      console.log('\n⚠️  No custom claims set for this user.');
      console.log('   Run this to set admin claims:');
      console.log(`   node scripts/set-admin.mjs "${email}"`);
    }
  } catch (e) {
    console.error('\n✗ Error:', e.message);
    process.exit(1);
  }
}

checkClaims(email).then(() => process.exit(0));
