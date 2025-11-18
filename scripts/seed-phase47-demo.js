#!/usr/bin/env node
/**
 * Phase 47 - Seed Demo Data
 * Creates sample organization with members and invites
 */

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function seedPhase47Demo() {
  console.log('📦 Seeding Phase 47 demo data...\n');

  // Demo org and user IDs
  const demoOrgId = 'demo-org-001';
  const ownerUid = process.env.OWNER_UID || 'owner-demo-uid';
  const adminUid = process.env.ADMIN_UID || 'admin-demo-uid';
  const memberUid = process.env.MEMBER_UID || 'member-demo-uid';

  // 1. Create demo organization
  console.log('1️⃣  Creating demo organization...');
  await db.doc(`ops_orgs/${demoOrgId}`).set({
    id: demoOrgId,
    name: 'Acme Corporation',
    seats: 10,
    usedSeats: 3,
    createdBy: ownerUid,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log('   ✅ Organization created: Acme Corporation\n');

  // 2. Create demo members
  console.log('2️⃣  Creating demo members...');

  // Owner
  await db.doc(`ops_org_members/${demoOrgId}_${ownerUid}`).set({
    orgId: demoOrgId,
    uid: ownerUid,
    role: 'owner',
    joinedAt: Timestamp.now(),
  });
  console.log('   ✅ Owner added');

  // Admin
  await db.doc(`ops_org_members/${demoOrgId}_${adminUid}`).set({
    orgId: demoOrgId,
    uid: adminUid,
    role: 'admin',
    joinedAt: Timestamp.now(),
  });
  console.log('   ✅ Admin added');

  // Member
  await db.doc(`ops_org_members/${demoOrgId}_${memberUid}`).set({
    orgId: demoOrgId,
    uid: memberUid,
    role: 'member',
    joinedAt: Timestamp.now(),
  });
  console.log('   ✅ Member added\n');

  // 3. Create demo invites
  console.log('3️⃣  Creating demo invites...');

  const expiresAt = Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Pending invite
  await db.doc('ops_org_invites/invite-demo-001').set({
    id: 'invite-demo-001',
    orgId: demoOrgId,
    orgName: 'Acme Corporation',
    email: 'newuser@example.com',
    role: 'member',
    invitedBy: ownerUid,
    status: 'pending',
    createdAt: Timestamp.now(),
    expiresAt,
  });
  console.log('   ✅ Pending invite created: newuser@example.com');

  // Accepted invite (for history)
  await db.doc('ops_org_invites/invite-demo-002').set({
    id: 'invite-demo-002',
    orgId: demoOrgId,
    orgName: 'Acme Corporation',
    email: 'admin@example.com',
    role: 'admin',
    invitedBy: ownerUid,
    status: 'accepted',
    acceptedBy: adminUid,
    createdAt: Timestamp.fromMillis(Date.now() - 2 * 24 * 60 * 60 * 1000),
    acceptedAt: Timestamp.fromMillis(Date.now() - 1 * 24 * 60 * 60 * 1000),
    expiresAt,
  });
  console.log('   ✅ Accepted invite created: admin@example.com\n');

  console.log('✅ Phase 47 demo data seeded successfully!\n');
  console.log('📊 Summary:');
  console.log('   - Organization: Acme Corporation (10 seats, 3 used)');
  console.log('   - Members: 1 owner, 1 admin, 1 member');
  console.log('   - Invites: 1 pending, 1 accepted\n');

  console.log('🧪 Test with:');
  console.log(`   OWNER_UID=${ownerUid} node test-org-functions.js\n`);
}

seedPhase47Demo()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error seeding data:', err);
    process.exit(1);
  });
