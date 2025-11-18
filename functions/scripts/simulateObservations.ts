#!/usr/bin/env node
/**
 * Phase 36 - Observation Simulation Script
 * Generates 500 test observations for learning system validation
 */

import * as admin from 'firebase-admin';
import { v4 as uuid } from 'uuid';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || 'from-zero-84253',
  });
}

const db = admin.firestore();

type Outcome = 'success' | 'degraded' | 'failure' | 'timeout';

interface Observation {
  id: string;
  ts: number;
  component: string;
  policyVersion?: string;
  durationMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  outcome: Outcome;
  errorCode?: string;
  meta?: Record<string, any>;
}

// Components to simulate
const COMPONENTS = [
  'AutoScaler',
  'router:gpt-5',
  'router:gemini',
  'router:claude',
  'CanaryManager',
  'Watchdog',
  'FeedbackLoop',
];

// Outcome distribution: 80% success, 10% failure, 10% timeout
const OUTCOMES: Outcome[] = [
  ...Array(80).fill('success'),
  ...Array(10).fill('failure'),
  ...Array(10).fill('timeout'),
];

function randomOutcome(): Outcome {
  return OUTCOMES[Math.floor(Math.random() * OUTCOMES.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateObservation(component: string, tsOffset: number): Observation {
  const outcome = randomOutcome();
  const now = Date.now() - tsOffset; // Distribute over last hour

  const obs: Observation = {
    id: uuid(),
    ts: now,
    component,
    outcome,
  };

  // Add duration (latency)
  if (component.startsWith('router:')) {
    obs.durationMs = outcome === 'timeout'
      ? randomInt(4000, 8000)  // Timeout: 4-8s
      : outcome === 'failure'
      ? randomInt(2000, 5000)  // Failure: 2-5s
      : randomInt(150, 3000);  // Success: 150ms-3s

    obs.tokensIn = randomInt(50, 500);
    obs.tokensOut = randomInt(100, 1500);

    // Cost based on tokens (rough estimate)
    const totalTokens = obs.tokensIn + obs.tokensOut;
    obs.costUsd = (totalTokens / 1000) * randomFloat(0.01, 0.05);

    obs.policyVersion = 'router-core@1.0.0';
  } else if (component === 'AutoScaler') {
    obs.durationMs = randomInt(100, 500);
    obs.costUsd = randomFloat(0.001, 0.01);
    obs.policyVersion = 'scaler-core@1.0.0';
    obs.meta = {
      from: randomInt(80, 200),
      to: randomInt(80, 200),
      reason: outcome === 'success' ? 'normal' : 'high_load',
    };
  } else if (component === 'CanaryManager') {
    obs.durationMs = randomInt(50, 300);
    obs.costUsd = randomFloat(0.0001, 0.005);
    obs.policyVersion = 'canary-core@1.0.0';
    obs.meta = {
      rolloutPercent: randomInt(0, 100),
      decision: outcome === 'success' ? 'promote' : 'rollback',
    };
  } else {
    obs.durationMs = randomInt(50, 500);
    obs.costUsd = randomFloat(0.0001, 0.01);
  }

  // Add error code for failures
  if (outcome === 'failure') {
    obs.errorCode = ['RATE_LIMIT', 'INVALID_REQUEST', 'SERVER_ERROR'][randomInt(0, 2)];
  } else if (outcome === 'timeout') {
    obs.errorCode = 'TIMEOUT';
  }

  return obs;
}

async function runSimulation() {
  console.log('🚀 Starting Phase 36 Observation Simulation');
  console.log('=' .repeat(60));
  console.log(`📊 Target: 500 observations`);
  console.log(`🎯 Distribution: 80% success, 10% failure, 10% timeout`);
  console.log(`⏰ Time Range: Last 60 minutes`);
  console.log('=' .repeat(60));
  console.log('');

  const observations: Observation[] = [];
  const TOTAL_OBS = 500;
  const BATCH_SIZE = 50;

  // Generate observations distributed over last hour
  for (let i = 0; i < TOTAL_OBS; i++) {
    const component = COMPONENTS[Math.floor(Math.random() * COMPONENTS.length)];
    const tsOffset = Math.floor((i / TOTAL_OBS) * 60 * 60 * 1000); // Distribute over 1 hour
    observations.push(generateObservation(component, tsOffset));
  }

  console.log(`✅ Generated ${observations.length} observations`);
  console.log('');

  // Write to Firestore in batches
  console.log('📝 Writing to Firestore...');
  const batches = [];

  for (let i = 0; i < observations.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchObs = observations.slice(i, i + BATCH_SIZE);

    batchObs.forEach((obs) => {
      const ref = db.collection('ops_observations').doc(obs.id);
      batch.set(ref, obs);
    });

    batches.push(batch.commit());
    process.stdout.write(`\r  Progress: ${i + batchObs.length}/${observations.length}`);
  }

  await Promise.all(batches);
  console.log('\n');

  // Print statistics
  const stats = {
    total: observations.length,
    byOutcome: {} as Record<string, number>,
    byComponent: {} as Record<string, number>,
    avgLatency: 0,
    avgCost: 0,
  };

  observations.forEach((obs) => {
    stats.byOutcome[obs.outcome] = (stats.byOutcome[obs.outcome] || 0) + 1;
    stats.byComponent[obs.component] = (stats.byComponent[obs.component] || 0) + 1;
    stats.avgLatency += obs.durationMs || 0;
    stats.avgCost += obs.costUsd || 0;
  });

  stats.avgLatency /= observations.length;
  stats.avgCost /= observations.length;

  console.log('=' .repeat(60));
  console.log('📊 Simulation Results');
  console.log('=' .repeat(60));
  console.log('');
  console.log('Outcome Distribution:');
  Object.entries(stats.byOutcome).forEach(([outcome, count]) => {
    const percent = ((count / stats.total) * 100).toFixed(1);
    console.log(`  ${outcome.padEnd(10)}: ${count.toString().padStart(3)} (${percent}%)`);
  });

  console.log('');
  console.log('Component Distribution:');
  Object.entries(stats.byComponent).forEach(([component, count]) => {
    const percent = ((count / stats.total) * 100).toFixed(1);
    console.log(`  ${component.padEnd(20)}: ${count.toString().padStart(3)} (${percent}%)`);
  });

  console.log('');
  console.log('Performance Metrics:');
  console.log(`  Avg Latency: ${stats.avgLatency.toFixed(0)} ms`);
  console.log(`  Avg Cost:    $${stats.avgCost.toFixed(4)}`);

  console.log('');
  console.log('=' .repeat(60));
  console.log('✅ Simulation Complete!');
  console.log('=' .repeat(60));
  console.log('');
  console.log('Next Steps:');
  console.log('  1. Wait 5 minutes for scoreObservations function to run');
  console.log('  2. Check dashboard: http://localhost:3000/ops/learning');
  console.log('  3. Verify stats: firebase firestore:query ops_stats');
  console.log('  4. Check rewards: firebase firestore:query ops_rewards --limit 10');
  console.log('');

  process.exit(0);
}

// Run simulation
runSimulation().catch((error) => {
  console.error('❌ Simulation failed:', error);
  process.exit(1);
});
