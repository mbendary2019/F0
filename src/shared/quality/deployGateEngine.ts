// src/shared/quality/deployGateEngine.ts
// =============================================================================
// Phase 150.4.1 – Shared Deploy Gate Engine
// Single source of truth for gate logic between Desktop & Web
// =============================================================================
// 🔒 LOCK (Phase 150.7): This file contains the gate logic shared between Desktop & Web.
//    deriveGateDecision() must produce IDENTICAL results on both platforms.
//    Any changes here MUST be tested on BOTH Desktop and Web.
// =============================================================================

/**
 * Gate status levels
 */
export type GateStatus = 'ready' | 'warning' | 'blocked';

/**
 * Quality input for gate decision
 */
export interface GateQualityInput {
  score: number;
  status: 'good' | 'caution' | 'needs_work' | 'blocked';
  totalIssues?: number;
}

/**
 * Security input for gate decision
 */
export interface GateSecurityInput {
  totalAlerts: number;
  hasBlocking: boolean;
}

/**
 * Tests input for gate decision
 */
export interface GateTestsInput {
  status: 'ok' | 'not_run' | 'failing';
  coverage?: number;
  lastRunAt?: string | null;
}

/**
 * Policy configuration
 */
export interface GatePolicyInput {
  minHealthForOK: number;
  blockOnSecurityAlerts: boolean;
  requireRecentTests: boolean;
  minCoveragePercent?: number;
}

/**
 * All inputs needed for gate decision
 */
export interface GateInputs {
  quality: GateQualityInput | null;
  security: GateSecurityInput | null;
  tests: GateTestsInput | null;
  policy: GatePolicyInput;
}

/**
 * Gate decision reason codes
 */
export type GateReasonCode =
  | 'security_blocking'
  | 'low_health'
  | 'tests_not_run'
  | 'tests_failing'
  | 'low_coverage'
  | 'quality_needs_work';

/**
 * Gate decision result
 */
export interface GateDecision {
  status: GateStatus;
  reasons: GateReasonCode[];
}

/**
 * Reason labels for display (Arabic & English)
 */
export const GATE_REASON_LABELS: Record<GateReasonCode, { en: string; ar: string }> = {
  security_blocking: {
    en: 'Security alerts blocking deployment',
    ar: 'تنبيهات أمنية تمنع النشر',
  },
  low_health: {
    en: 'Health score below threshold',
    ar: 'درجة الصحة أقل من الحد المطلوب',
  },
  tests_not_run: {
    en: 'Tests have not been run',
    ar: 'الاختبارات لم تُشغّل بعد',
  },
  tests_failing: {
    en: 'Tests are failing',
    ar: 'الاختبارات فاشلة',
  },
  low_coverage: {
    en: 'Test coverage below threshold',
    ar: 'تغطية الاختبارات أقل من الحد المطلوب',
  },
  quality_needs_work: {
    en: 'Quality status needs attention',
    ar: 'حالة الجودة تحتاج اهتمام',
  },
};

/**
 * Status labels for display
 */
export const GATE_STATUS_LABELS: Record<GateStatus, { en: string; ar: string }> = {
  ready: {
    en: 'Deploy Ready',
    ar: 'جاهز للنشر',
  },
  warning: {
    en: 'Check Before Deploy',
    ar: 'تحقق قبل النشر',
  },
  blocked: {
    en: 'Deploy Blocked',
    ar: 'النشر محظور',
  },
};

/**
 * Default policy presets
 */
export const POLICY_PRESETS = {
  strict: {
    minHealthForOK: 80,
    blockOnSecurityAlerts: true,
    requireRecentTests: true,
    minCoveragePercent: 70,
  },
  balanced: {
    minHealthForOK: 60,
    blockOnSecurityAlerts: true,
    requireRecentTests: false,
    minCoveragePercent: 50,
  },
  relaxed: {
    minHealthForOK: 40,
    blockOnSecurityAlerts: false,
    requireRecentTests: false,
    minCoveragePercent: 0,
  },
} as const;

export type PolicyPreset = keyof typeof POLICY_PRESETS;

/**
 * Derive gate decision from inputs
 * Single source of truth for Desktop & Web
 */
export function deriveGateDecision(inputs: GateInputs): GateDecision {
  const reasons: GateReasonCode[] = [];

  // Check security
  if (inputs.security?.hasBlocking && inputs.policy.blockOnSecurityAlerts) {
    reasons.push('security_blocking');
  }

  // Check quality health score
  if (inputs.quality) {
    if (inputs.quality.score < inputs.policy.minHealthForOK) {
      reasons.push('low_health');
    }
    if (inputs.quality.status === 'needs_work' || inputs.quality.status === 'blocked') {
      reasons.push('quality_needs_work');
    }
  }

  // Check tests
  if (inputs.tests) {
    if (inputs.tests.status === 'not_run' && inputs.policy.requireRecentTests) {
      reasons.push('tests_not_run');
    }
    if (inputs.tests.status === 'failing') {
      reasons.push('tests_failing');
    }
    if (
      inputs.policy.minCoveragePercent &&
      inputs.tests.coverage !== undefined &&
      inputs.tests.coverage < inputs.policy.minCoveragePercent
    ) {
      reasons.push('low_coverage');
    }
  }

  // Determine status based on reasons
  const hasBlockingReason =
    reasons.includes('security_blocking') ||
    reasons.includes('low_health') ||
    reasons.includes('tests_failing');

  if (hasBlockingReason) {
    return { status: 'blocked', reasons };
  }

  if (reasons.length > 0) {
    return { status: 'warning', reasons };
  }

  return { status: 'ready', reasons: [] };
}

/**
 * Get human-readable reason text
 */
export function getReasonLabel(
  reason: GateReasonCode,
  locale: 'en' | 'ar' = 'en',
): string {
  return GATE_REASON_LABELS[reason]?.[locale] ?? reason;
}

/**
 * Get human-readable status text
 */
export function getStatusLabel(
  status: GateStatus,
  locale: 'en' | 'ar' = 'en',
): string {
  return GATE_STATUS_LABELS[status]?.[locale] ?? status;
}

/**
 * Get policy preset by name
 */
export function getPolicyPreset(preset: PolicyPreset): GatePolicyInput {
  return POLICY_PRESETS[preset];
}

export default {
  deriveGateDecision,
  getReasonLabel,
  getStatusLabel,
  getPolicyPreset,
  POLICY_PRESETS,
  GATE_REASON_LABELS,
  GATE_STATUS_LABELS,
};
