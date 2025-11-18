/**
 * Initialize Anomaly Detection Tuning Configs
 * Run this script once after deploying Phase 31
 * 
 * Usage:
 *   node INIT_TUNING_CONFIGS.js
 * 
 * Or via Firebase Console:
 *   Copy/paste this code into Cloud Firestore Rules Editor
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const metrics = ['errors', 'calls', 'latency_p95'];
const windows = ['1m', '5m', '15m'];

async function initTuning() {
  console.log('🔧 Initializing Anomaly Detection Tuning Configs...');
  console.log('');

  let count = 0;

  for (const metric of metrics) {
    for (const window of windows) {
      const docId = `${metric}_${window}`;
      
      try {
        await db.collection('anomaly_tuning').doc(docId).set({
          metric,
          window,
          sensitivity: 3,              // Default: 3 (1=very sensitive, 5=less sensitive)
          fusionWeights: [0.5, 0.5],   // [zscore_weight, ewma_weight]
          minSupport: 8,               // Minimum data points required
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        
        console.log(`✅ Created: ${docId}`);
        count++;
      } catch (error) {
        console.error(`❌ Failed to create ${docId}:`, error.message);
      }
    }
  }

  console.log('');
  console.log(`🎉 Successfully initialized ${count}/${metrics.length * windows.length} tuning configs`);
  console.log('');
  console.log('📍 Verify in Firebase Console:');
  console.log('   https://console.firebase.google.com/project/YOUR_PROJECT/firestore/data/anomaly_tuning');
  console.log('');
  
  process.exit(0);
}

// Run the initialization
initTuning().catch(error => {
  console.error('❌ Error initializing tuning configs:', error);
  process.exit(1);
});

