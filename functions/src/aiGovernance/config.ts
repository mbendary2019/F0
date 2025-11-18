/**
 * AI Governance - Configuration Management
 * Handles feature flags, sampling rates, and thresholds with caching
 */

import * as admin from 'firebase-admin';

export interface AIGovConfig {
  enabled: boolean;
  sampleRate: number; // 0..1 (0 = never, 1 = always)
  thresholds: {
    toxicity: number;
    bias: number;
  };
  alertFlagRatePct: number; // Alert threshold percentage (e.g., 10 = 10%)
}

// Cache with 60s TTL to reduce Firestore reads
let cache: { v: AIGovConfig; ts: number } | null = null;

/**
 * Get AI Governance configuration with fallback to environment variables
 * Results are cached for 60 seconds
 */
export async function getAIGovConfig(
  db = admin.firestore()
): Promise<AIGovConfig> {
  const now = Date.now();

  // Return cached config if still valid
  if (cache && now - cache.ts < 60_000) {
    return cache.v;
  }

  // Fetch from Firestore
  const snap = await db.collection('config').doc('ai_governance').get();
  const d = snap.exists ? snap.data()! : {};

  // Build config with fallback to env vars
  const v: AIGovConfig = {
    enabled: d.enabled ?? (process.env.AI_EVAL_ENABLED === 'true'),
    sampleRate: d.sampleRate ?? Number(process.env.AI_EVAL_SAMPLE_RATE ?? 1),
    thresholds: {
      toxicity:
        d.thresholds?.toxicity ??
        Number(process.env.AI_TOXICITY_THRESHOLD ?? 50),
      bias:
        d.thresholds?.bias ?? Number(process.env.AI_BIAS_THRESHOLD ?? 30),
    },
    alertFlagRatePct: d.alertFlagRatePct ?? 10,
  };

  // Update cache
  cache = { v, ts: now };

  return v;
}

/**
 * Clear the config cache (useful for testing or immediate config updates)
 */
export function clearConfigCache(): void {
  cache = null;
}
