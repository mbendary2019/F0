// desktop/src/state/qualityPolicyTypes.ts
// Phase 135.0: Quality Profiles & Policies - Types
// Phase 136.4: Enhanced Security Policy Thresholds
// Phase 137.0: Test Policy Foundations

/**
 * Quality profile identifiers
 * - strict: For production apps, high standards
 * - balanced: Default, reasonable for most projects
 * - relaxed: For dev/sandbox/side projects
 * - custom: User-defined thresholds
 */
export type QualityProfileId = 'strict' | 'balanced' | 'relaxed' | 'custom';

/**
 * Phase 137.0: Test Policy Thresholds
 * Controls how tests affect deployment decisions
 */
export interface TestPolicyThresholds {
  /** Whether tests must have run recently before deploy */
  requireRecentTests: boolean;
  /** Max hours since last test run before triggering warning */
  maxTestAgeHours: number;
  /** Minimum test coverage % for OK status */
  minCoverageForOK: number;
  /** Minimum test coverage % before blocking deploy */
  minCoverageForDeploy: number;
}

/**
 * Thresholds that define quality policy behavior
 */
export interface QualityPolicyThresholds {
  /** Health score below this triggers Caution (0-100) */
  minHealthForCaution: number;
  /** Health score at or above this is OK (0-100) */
  minHealthForOk: number;
  /** Max issues before triggering Blocked */
  maxIssuesForOk: number;
  /** If true, any security alert blocks deployment (legacy - replaced by granular controls) */
  treatSecurityAlertsAsBlock: boolean;
  /** If true, tests must have run recently to be OK */
  requireRecentTests: boolean;
  /** Hours before a scan is considered stale */
  staleScanHours: number;

  // --- Phase 136.4: Granular Security Thresholds ---
  /** Max security alerts before triggering CAUTION (0 = always CAUTION if any) */
  maxSecurityAlertsForOK: number;
  /** Max security alerts before triggering BLOCK (alerts above this = blocked) */
  maxSecurityAlertsForDeploy: number;
  /** If true, any critical security alert blocks deployment immediately */
  alwaysBlockOnCriticalSecurity: boolean;

  // --- Phase 137.0: Test Policy Thresholds ---
  /** Advanced test policy settings */
  testPolicy: TestPolicyThresholds;
}

/**
 * Complete policy state
 */
export interface QualityPolicyState {
  /** Currently selected profile */
  profile: QualityProfileId;
  /** Active thresholds (from profile or custom) */
  thresholds: QualityPolicyThresholds;
}

/**
 * Profile metadata for UI display
 */
export interface QualityProfileMeta {
  id: QualityProfileId;
  label: { en: string; ar: string };
  description: { en: string; ar: string };
  icon: string;
  color: string;
}

/**
 * Default thresholds for each profile
 */
export const PROFILE_DEFAULTS: Record<QualityProfileId, QualityPolicyThresholds> = {
  strict: {
    minHealthForCaution: 80,
    minHealthForOk: 90,
    maxIssuesForOk: 50,
    treatSecurityAlertsAsBlock: true,
    requireRecentTests: true,
    staleScanHours: 12,
    // Phase 136.4: Strict - zero tolerance for security
    maxSecurityAlertsForOK: 0,
    maxSecurityAlertsForDeploy: 0,
    alwaysBlockOnCriticalSecurity: true,
    // Phase 137.0: Strict test policy - high standards
    testPolicy: {
      requireRecentTests: true,
      maxTestAgeHours: 2,
      minCoverageForOK: 80,
      minCoverageForDeploy: 60,
    },
  },
  balanced: {
    minHealthForCaution: 60,
    minHealthForOk: 80,
    maxIssuesForOk: 200,
    treatSecurityAlertsAsBlock: true,
    requireRecentTests: false,
    staleScanHours: 24,
    // Phase 136.4: Balanced - some tolerance
    maxSecurityAlertsForOK: 1,
    maxSecurityAlertsForDeploy: 3,
    alwaysBlockOnCriticalSecurity: true,
    // Phase 137.0: Balanced test policy
    testPolicy: {
      requireRecentTests: true,
      maxTestAgeHours: 12,
      minCoverageForOK: 60,
      minCoverageForDeploy: 40,
    },
  },
  relaxed: {
    minHealthForCaution: 40,
    minHealthForOk: 70,
    maxIssuesForOk: 500,
    treatSecurityAlertsAsBlock: false,
    requireRecentTests: false,
    staleScanHours: 48,
    // Phase 136.4: Relaxed - higher tolerance
    maxSecurityAlertsForOK: 3,
    maxSecurityAlertsForDeploy: 10,
    alwaysBlockOnCriticalSecurity: false,
    // Phase 137.0: Relaxed test policy - lenient
    testPolicy: {
      requireRecentTests: false,
      maxTestAgeHours: 48,
      minCoverageForOK: 40,
      minCoverageForDeploy: 0,
    },
  },
  custom: {
    // Default custom starts as balanced
    minHealthForCaution: 60,
    minHealthForOk: 80,
    maxIssuesForOk: 200,
    treatSecurityAlertsAsBlock: true,
    requireRecentTests: false,
    staleScanHours: 24,
    // Phase 136.4: Custom defaults to balanced
    maxSecurityAlertsForOK: 1,
    maxSecurityAlertsForDeploy: 3,
    alwaysBlockOnCriticalSecurity: true,
    // Phase 137.0: Custom test policy - defaults to balanced
    testPolicy: {
      requireRecentTests: true,
      maxTestAgeHours: 24,
      minCoverageForOK: 60,
      minCoverageForDeploy: 30,
    },
  },
};

/**
 * Profile metadata for UI
 */
export const PROFILE_META: QualityProfileMeta[] = [
  {
    id: 'strict',
    label: { en: 'Strict', ar: 'صارم' },
    description: {
      en: 'For production apps. High standards, blocks on security issues.',
      ar: 'للتطبيقات الإنتاجية. معايير عالية، يحظر عند وجود مشاكل أمنية.',
    },
    icon: '🔒',
    color: 'red',
  },
  {
    id: 'balanced',
    label: { en: 'Balanced', ar: 'متوازن' },
    description: {
      en: 'Default. Reasonable thresholds for most projects.',
      ar: 'الافتراضي. حدود معقولة لمعظم المشاريع.',
    },
    icon: '⚖️',
    color: 'amber',
  },
  {
    id: 'relaxed',
    label: { en: 'Relaxed', ar: 'مرن' },
    description: {
      en: 'For dev/sandbox. More lenient, fewer blockers.',
      ar: 'للتطوير والتجارب. أكثر تساهلاً، حواجز أقل.',
    },
    icon: '🧪',
    color: 'emerald',
  },
  {
    id: 'custom',
    label: { en: 'Custom', ar: 'مخصص' },
    description: {
      en: 'Define your own thresholds.',
      ar: 'حدد حدودك الخاصة.',
    },
    icon: '⚙️',
    color: 'violet',
  },
];

/**
 * Get profile meta by ID
 */
export function getProfileMeta(id: QualityProfileId): QualityProfileMeta {
  return PROFILE_META.find((p) => p.id === id) ?? PROFILE_META[1]; // Default to balanced
}

/**
 * Get profile color classes for Tailwind
 */
export function getProfileColorClasses(id: QualityProfileId): {
  bg: string;
  border: string;
  text: string;
} {
  switch (id) {
    case 'strict':
      return {
        bg: 'bg-red-500/20',
        border: 'border-red-500/40',
        text: 'text-red-100',
      };
    case 'balanced':
      return {
        bg: 'bg-amber-500/20',
        border: 'border-amber-500/40',
        text: 'text-amber-100',
      };
    case 'relaxed':
      return {
        bg: 'bg-emerald-500/20',
        border: 'border-emerald-500/40',
        text: 'text-emerald-100',
      };
    case 'custom':
      return {
        bg: 'bg-violet-500/20',
        border: 'border-violet-500/40',
        text: 'text-violet-100',
      };
  }
}
