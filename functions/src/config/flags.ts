/**
 * Phase 36-37 - Feature Flags
 * Central configuration for feature toggles and kill switches
 */

export const FLAGS = {
  learning: {
    enabled: true,
    autoActivatePolicies: false, // require admin approval by default
  },
  ops: {
    autoScaling: true,
    watchdog: true,
    feedbackLoop: true,
    canaryManager: true,
  },
  adaptive: {
    enabled: true,
    minConfidenceToAct: 0.65,
    minSampleSize: 80,
    maxChangeMagnitude: 0.10, // max 10% weight delta per decision
    ab: { adaptive: 0.1, control: 0.1, prod: 0.8 },
  },
  scheduler: {
    autoTune: true,
    minCadenceMins: 5,   // lower bound
    maxCadenceMins: 60,  // upper bound
  },
};
