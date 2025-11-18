#!/usr/bin/env tsx
/**
 * Backfill Script: Migrate stripePaymentIntent → paymentIntentId
 *
 * Run once to migrate legacy orders from the old field name to the new unified field.
 *
 * Usage:
 *   npx tsx scripts/migrate-payment-intent-field.ts
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS set or default credentials configured
 *   - Admin SDK initialized with proper permissions
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

interface LegacyOrder {
  stripePaymentIntent?: string;
  paymentIntentId?: string | null;
  [key: string]: any;
}

async function migratePaymentIntentFields() {
  console.log('🔄 Starting payment intent field migration...\n');

  try {
    // Query orders that might need migration
    const snap = await db.collection('orders')
      .where('paymentIntentId', '==', null)
      .get();

    console.log(`📊 Found ${snap.size} orders with null paymentIntentId\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of snap.docs) {
      const data = doc.data() as LegacyOrder;

      // Check if migration is needed
      if (data.stripePaymentIntent && !data.paymentIntentId) {
        try {
          await doc.ref.update({
            paymentIntentId: data.stripePaymentIntent,
            // Keep legacy field for audit trail
            _legacyFields: {
              stripePaymentIntent: data.stripePaymentIntent,
              migratedAt: new Date().toISOString()
            }
          });

          updated++;
          console.log(`✅ Migrated order ${doc.id}: ${data.stripePaymentIntent}`);
        } catch (err) {
          errors++;
          console.error(`❌ Error migrating order ${doc.id}:`, err);
        }
      } else {
        skipped++;
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Updated: ${updated} orders`);
    console.log(`   ⏭️  Skipped: ${skipped} orders (no stripePaymentIntent)`);
    console.log(`   ❌ Errors: ${errors} orders`);

    if (errors === 0) {
      console.log('\n✨ Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with errors. Please review logs.');
      process.exit(1);
    }

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

// Dry run option
const isDryRun = process.argv.includes('--dry-run');

if (isDryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');
  db.collection('orders')
    .where('paymentIntentId', '==', null)
    .get()
    .then(snap => {
      let needsMigration = 0;
      snap.docs.forEach(doc => {
        const data = doc.data() as LegacyOrder;
        if (data.stripePaymentIntent && !data.paymentIntentId) {
          needsMigration++;
          console.log(`Would migrate: ${doc.id} → ${data.stripePaymentIntent}`);
        }
      });
      console.log(`\n📊 Total orders needing migration: ${needsMigration}`);
      console.log('Run without --dry-run to apply changes');
    });
} else {
  migratePaymentIntentFields();
}
