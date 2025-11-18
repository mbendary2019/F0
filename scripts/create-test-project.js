#!/usr/bin/env node
/**
 * Create a test project in Firestore Emulator
 * Usage: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/create-test-project.js <projectId>
 */

const admin = require('firebase-admin');

// Initialize Admin SDK for emulator
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'from-zero-84253',
  });
}

const db = admin.firestore();

async function createProject(projectId) {
  try {
    const projectRef = db.collection('ops_projects').doc(projectId);

    const projectData = {
      id: projectId,
      name: `Test Project ${projectId}`,
      description: 'Test project for Phase 73 Environment Variables',
      techStack: 'Next.js, Firebase, TypeScript',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ownerId: 'test-user-123',
      owners: ['test-user-123'],
      createdBy: 'test-user-123',
      status: 'active',
    };

    await projectRef.set(projectData);

    console.log(`✅ Created project: ${projectId}`);
    console.log(`   Name: ${projectData.name}`);
    console.log(`   Owner: ${projectData.ownerId}`);
    console.log(`\n🔗 View in Firestore Emulator UI:`);
    console.log(`   http://localhost:4000/firestore/data/ops_projects/${projectId}`);
    console.log(`\n📝 Now you can add environment variables to this project!`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating project:', error);
    process.exit(1);
  }
}

// Get project ID from command line
const projectId = process.argv[2];

if (!projectId) {
  console.error('❌ Usage: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/create-test-project.js <projectId>');
  console.error('   Example: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/create-test-project.js test-123');
  process.exit(1);
}

// Check if emulator is configured
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('⚠️  Warning: FIRESTORE_EMULATOR_HOST not set. This will write to production!');
  console.error('   Use: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/create-test-project.js');
  process.exit(1);
}

console.log(`🔧 Creating project "${projectId}" in Firestore Emulator...`);
console.log(`   Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}\n`);

createProject(projectId);
