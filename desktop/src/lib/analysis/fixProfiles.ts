// desktop/src/lib/analysis/fixProfiles.ts
// Phase 124.8.x: Safe Preset Profiles & Filters for Code Fixes

/**
 * Categories for classifying code issues and fixes
 */
export type FixCategory =
  | 'logging'      // console.log, console.debug, console.error
  | 'types'        // any, null checks, type safety
  | 'style'        // formatting, naming, code style
  | 'deadCode'     // unused variables, unreachable code
  | 'security'     // XSS, injection, hardcoded secrets
  | 'performance'  // inefficient patterns
  | 'other';       // unclassified

/**
 * Profile IDs for quick selection
 */
export type FixProfileId =
  | 'logging_only'
  | 'types_only'
  | 'style_only'
  | 'safe_mix'
  | 'all';

/**
 * A fix profile defines which categories of fixes to apply
 */
export type FixProfile = {
  id: FixProfileId;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  allowedCategories: FixCategory[];
  /** Icon emoji for the profile */
  icon: string;
};

/**
 * Predefined fix profiles (v1)
 */
export const FIX_PROFILES: FixProfile[] = [
  {
    id: 'logging_only',
    label: 'Logging cleanup',
    labelAr: 'تنظيف السجلات',
    description: 'Remove debug logs and console spam.',
    descriptionAr: 'إزالة سجلات التصحيح والـ console.',
    allowedCategories: ['logging'],
    icon: '🧹',
  },
  {
    id: 'types_only',
    label: 'Type safety',
    labelAr: 'أمان الأنواع',
    description: 'Fix TypeScript types and null checks.',
    descriptionAr: 'إصلاح أنواع TypeScript وفحوصات null.',
    allowedCategories: ['types'],
    icon: '🔒',
  },
  {
    id: 'style_only',
    label: 'Code style',
    labelAr: 'تنسيق الكود',
    description: 'Fix formatting and naming issues.',
    descriptionAr: 'إصلاح التنسيق والتسمية.',
    allowedCategories: ['style'],
    icon: '✨',
  },
  {
    id: 'safe_mix',
    label: 'Safe mix',
    labelAr: 'مزيج آمن',
    description: 'Logging + Types + Style (no security).',
    descriptionAr: 'السجلات + الأنواع + التنسيق (بدون أمان).',
    allowedCategories: ['logging', 'types', 'style', 'deadCode', 'performance'],
    icon: '🛡️',
  },
  {
    id: 'all',
    label: 'All fixes',
    labelAr: 'كل الإصلاحات',
    description: 'Apply all available fixes.',
    descriptionAr: 'تطبيق جميع الإصلاحات المتاحة.',
    allowedCategories: ['logging', 'types', 'style', 'deadCode', 'security', 'performance', 'other'],
    icon: '⚡',
  },
];

/**
 * Get a profile by ID
 */
export function getFixProfile(id: FixProfileId): FixProfile {
  return FIX_PROFILES.find(p => p.id === id) ?? FIX_PROFILES.find(p => p.id === 'safe_mix')!;
}

/**
 * Categorize an issue message into a FixCategory
 */
export function categorizeIssue(message: string, category?: string): FixCategory {
  const lowerMessage = message.toLowerCase();
  const lowerCategory = category?.toLowerCase() ?? '';

  // Logging patterns
  if (
    lowerMessage.includes('console.log') ||
    lowerMessage.includes('console.debug') ||
    lowerMessage.includes('console.info') ||
    lowerMessage.includes('debugger') ||
    lowerMessage.includes('remove console') ||
    lowerMessage.includes('remove debug')
  ) {
    return 'logging';
  }

  // Type safety patterns
  if (
    lowerMessage.includes('"any"') ||
    lowerMessage.includes('any type') ||
    lowerMessage.includes('null check') ||
    lowerMessage.includes('undefined') ||
    lowerMessage.includes('type safety') ||
    lowerMessage.includes('return type') ||
    lowerCategory === 'types'
  ) {
    return 'types';
  }

  // Security patterns
  if (
    lowerMessage.includes('security') ||
    lowerMessage.includes('xss') ||
    lowerMessage.includes('injection') ||
    lowerMessage.includes('eval(') ||
    lowerMessage.includes('innerhtml') ||
    lowerMessage.includes('hardcoded secret') ||
    lowerMessage.includes('password') ||
    lowerCategory === 'security'
  ) {
    return 'security';
  }

  // Performance patterns
  if (
    lowerMessage.includes('performance') ||
    lowerMessage.includes('synchronous') ||
    lowerMessage.includes('blocking') ||
    lowerMessage.includes('inefficient') ||
    lowerCategory === 'performance'
  ) {
    return 'performance';
  }

  // Style patterns
  if (
    lowerMessage.includes('===') ||
    lowerMessage.includes('!==') ||
    lowerMessage.includes('var ') ||
    lowerMessage.includes('formatting') ||
    lowerMessage.includes('naming') ||
    lowerMessage.includes('style') ||
    lowerMessage.includes('todo') ||
    lowerMessage.includes('fixme') ||
    lowerCategory === 'style' ||
    lowerCategory === 'best-practice'
  ) {
    return 'style';
  }

  // Dead code patterns
  if (
    lowerMessage.includes('unused') ||
    lowerMessage.includes('unreachable') ||
    lowerMessage.includes('dead code')
  ) {
    return 'deadCode';
  }

  return 'other';
}

/**
 * Filter issues by a fix profile
 */
export function filterIssuesByProfile<T extends { message: string; category?: string }>(
  issues: T[],
  profileId: FixProfileId
): T[] {
  const profile = getFixProfile(profileId);
  const allowedSet = new Set<FixCategory>(profile.allowedCategories);

  return issues.filter(issue => {
    const issueCategory = categorizeIssue(issue.message, issue.category);
    return allowedSet.has(issueCategory);
  });
}

export default FIX_PROFILES;
