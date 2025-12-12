// desktop/src/lib/ace/aceSuggestions.ts
// Phase 128.2: Refactor Suggestions Engine

import type { AceFileScore, AceSuggestion, AceSuggestionId } from './aceTypes';

/**
 * Input for building suggestions
 */
export type BuildSuggestionsInput = {
  fileScores: AceFileScore[];
};

/** Counter for unique IDs */
let suggestionCounter = 0;
const nextId = () => `ace-suggestion-${Date.now()}-${++suggestionCounter}`;

/**
 * Suggestion templates with bilingual text
 */
const SUGGESTION_TEMPLATES: Record<AceSuggestionId, {
  icon: string;
  title: (ctx: { count?: number; file?: string }) => string;
  titleAr: (ctx: { count?: number; file?: string }) => string;
  description: (ctx: { count?: number; file?: string; issues?: number }) => string;
  descriptionAr: (ctx: { count?: number; file?: string; issues?: number }) => string;
}> = {
  split_large_file: {
    icon: '📦',
    title: ({ file }) => `Split large file: ${file}`,
    titleAr: ({ file }) => `تقسيم الملف الكبير: ${file}`,
    description: ({ file, issues }) =>
      `The file "${file}" is large and has ${issues} issues. Consider splitting it into smaller, focused modules.`,
    descriptionAr: ({ file, issues }) =>
      `الملف "${file}" كبير ولديه ${issues} مشكلة. فكر في تقسيمه لوحدات أصغر ومركزة.`,
  },
  convert_js_to_ts: {
    icon: '🔷',
    title: ({ count }) => `Convert ${count} JS files to TypeScript`,
    titleAr: ({ count }) => `تحويل ${count} ملف JS إلى TypeScript`,
    description: ({ count }) =>
      `${count} high-risk JavaScript files would benefit from TypeScript types for better safety and maintainability.`,
    descriptionAr: ({ count }) =>
      `${count} ملف JavaScript عالي الخطورة سيستفيد من أنواع TypeScript لأمان وصيانة أفضل.`,
  },
  cleanup_logging_heavy_file: {
    icon: '🔇',
    title: ({ count }) => `Clean up ${count} logging-heavy files`,
    titleAr: ({ count }) => `تنظيف ${count} ملف كثير الـ logging`,
    description: ({ count }) =>
      `${count} files contain excessive logging. Cleaning up debug logs will improve readability and performance.`,
    descriptionAr: ({ count }) =>
      `${count} ملف يحتوي على logging مفرط. تنظيف سجلات التصحيح سيحسن القراءة والأداء.`,
  },
  reduce_any_types: {
    icon: '🎯',
    title: ({ count }) => `Replace 'any' types in ${count} files`,
    titleAr: ({ count }) => `استبدال أنواع 'any' في ${count} ملف`,
    description: ({ count }) =>
      `${count} files use 'any' types excessively. Adding proper types will catch bugs and improve IDE support.`,
    descriptionAr: ({ count }) =>
      `${count} ملف يستخدم أنواع 'any' بشكل مفرط. إضافة الأنواع المناسبة سيكشف الأخطاء ويحسن دعم IDE.`,
  },
  extract_shared_utils: {
    icon: '🔧',
    title: () => 'Extract shared utilities',
    titleAr: () => 'استخراج الأدوات المشتركة',
    description: ({ count }) =>
      `${count || 'Several'} files contain duplicated utility code. Consider extracting to a shared utils module.`,
    descriptionAr: ({ count }) =>
      `${count || 'عدة'} ملفات تحتوي على كود أدوات مكرر. فكر في استخراجه لوحدة أدوات مشتركة.`,
  },
  tighten_tsconfig: {
    icon: '⚙️',
    title: () => 'Tighten TypeScript configuration',
    titleAr: () => 'تشديد إعدادات TypeScript',
    description: () =>
      'Enable stricter TypeScript options (strict, noImplicitAny) to catch more errors at compile time.',
    descriptionAr: () =>
      'تفعيل خيارات TypeScript أكثر صرامة (strict, noImplicitAny) لاكتشاف المزيد من الأخطاء وقت الترجمة.',
  },
  remove_legacy_backups: {
    icon: '🗑️',
    title: ({ count }) => `Review ${count} legacy/backup files`,
    titleAr: ({ count }) => `مراجعة ${count} ملف قديم/نسخة احتياطية`,
    description: ({ count }) =>
      `There are ${count} backup or legacy files in the codebase. Consider archiving or removing them.`,
    descriptionAr: ({ count }) =>
      `يوجد ${count} ملف نسخة احتياطية أو قديم في قاعدة الكود. فكر في أرشفتها أو حذفها.`,
  },
  improve_security_rules: {
    icon: '🔒',
    title: ({ count }) => `Fix security issues in ${count} files`,
    titleAr: ({ count }) => `إصلاح مشاكل الأمان في ${count} ملف`,
    description: ({ count }) =>
      `${count} files have security-related issues. These should be prioritized for review and fixing.`,
    descriptionAr: ({ count }) =>
      `${count} ملف لديه مشاكل متعلقة بالأمان. يجب إعطاء الأولوية لمراجعتها وإصلاحها.`,
  },
  reduce_file_complexity: {
    icon: '🧩',
    title: ({ count }) => `Reduce complexity in ${count} files`,
    titleAr: ({ count }) => `تقليل التعقيد في ${count} ملف`,
    description: ({ count }) =>
      `${count} files have high complexity scores. Consider refactoring to improve maintainability.`,
    descriptionAr: ({ count }) =>
      `${count} ملف لديه درجات تعقيد عالية. فكر في إعادة هيكلته لتحسين قابلية الصيانة.`,
  },
  cleanup_dead_code: {
    icon: '💀',
    title: ({ count }) => `Remove dead code from ${count} files`,
    titleAr: ({ count }) => `إزالة الكود الميت من ${count} ملف`,
    description: ({ count }) =>
      `${count} files contain unused or dead code. Removing it will simplify the codebase.`,
    descriptionAr: ({ count }) =>
      `${count} ملف يحتوي على كود غير مستخدم أو ميت. إزالته ستبسط قاعدة الكود.`,
  },
  improve_test_coverage: {
    icon: '🧪',
    title: ({ count }) => `Add tests for ${count} high-risk files`,
    titleAr: ({ count }) => `إضافة اختبارات لـ ${count} ملف عالي الخطورة`,
    description: ({ count }) =>
      `${count} high-risk files likely lack proper test coverage. Adding tests will prevent regressions.`,
    descriptionAr: ({ count }) =>
      `${count} ملف عالي الخطورة على الأرجح يفتقر لتغطية اختبارات مناسبة. إضافة الاختبارات ستمنع التراجعات.`,
  },
};

/**
 * Build evolution suggestions from file scores
 */
export function buildAceSuggestions(input: BuildSuggestionsInput): AceSuggestion[] {
  const { fileScores } = input;
  const suggestions: AceSuggestion[] = [];
  const now = new Date().toISOString();

  const highRisk = fileScores.filter((f) => f.riskLevel === 'high');
  const mediumRisk = fileScores.filter((f) => f.riskLevel === 'medium');

  // 1) Large high-risk files → split_large_file
  for (const f of highRisk) {
    if (f.sizeLines > 400 || f.healthIssues > 30) {
      const template = SUGGESTION_TEMPLATES.split_large_file;
      const ctx = { file: f.relativePath, issues: f.healthIssues };
      suggestions.push({
        id: nextId(),
        type: 'split_large_file',
        title: template.title(ctx),
        titleAr: template.titleAr(ctx),
        description: template.description(ctx),
        descriptionAr: template.descriptionAr(ctx),
        targetFiles: [f.filePath],
        estimatedImpact: 'high',
        estimatedEffort: 'M',
        createdAt: now,
        icon: template.icon,
      });
    }
  }

  // 2) JS high-risk → convert_js_to_ts
  const jsHighRisk = highRisk.filter((f) => f.filePath.endsWith('.js') || f.filePath.endsWith('.jsx'));
  if (jsHighRisk.length >= 3) {
    const template = SUGGESTION_TEMPLATES.convert_js_to_ts;
    const ctx = { count: jsHighRisk.length };
    suggestions.push({
      id: nextId(),
      type: 'convert_js_to_ts',
      title: template.title(ctx),
      titleAr: template.titleAr(ctx),
      description: template.description(ctx),
      descriptionAr: template.descriptionAr(ctx),
      targetFiles: jsHighRisk.slice(0, 15).map((f) => f.filePath),
      estimatedImpact: 'high',
      estimatedEffort: 'L',
      createdAt: now,
      icon: template.icon,
    });
  }

  // 3) Logging-heavy files
  const loggingHeavy = [...mediumRisk, ...highRisk].filter((f) => f.categoryWeights.logging > 10);
  if (loggingHeavy.length >= 2) {
    const template = SUGGESTION_TEMPLATES.cleanup_logging_heavy_file;
    const ctx = { count: loggingHeavy.length };
    suggestions.push({
      id: nextId(),
      type: 'cleanup_logging_heavy_file',
      title: template.title(ctx),
      titleAr: template.titleAr(ctx),
      description: template.description(ctx),
      descriptionAr: template.descriptionAr(ctx),
      targetFiles: loggingHeavy.slice(0, 15).map((f) => f.filePath),
      estimatedImpact: 'medium',
      estimatedEffort: 'S',
      createdAt: now,
      icon: template.icon,
    });
  }

  // 4) Type issues (any types)
  const typeHeavy = [...mediumRisk, ...highRisk].filter((f) => f.categoryWeights.types > 5);
  if (typeHeavy.length >= 2) {
    const template = SUGGESTION_TEMPLATES.reduce_any_types;
    const ctx = { count: typeHeavy.length };
    suggestions.push({
      id: nextId(),
      type: 'reduce_any_types',
      title: template.title(ctx),
      titleAr: template.titleAr(ctx),
      description: template.description(ctx),
      descriptionAr: template.descriptionAr(ctx),
      targetFiles: typeHeavy.slice(0, 15).map((f) => f.filePath),
      estimatedImpact: 'medium',
      estimatedEffort: 'M',
      createdAt: now,
      icon: template.icon,
    });
  }

  // 5) Security issues
  const securityIssues = fileScores.filter((f) => f.categoryWeights.security > 0);
  if (securityIssues.length > 0) {
    const template = SUGGESTION_TEMPLATES.improve_security_rules;
    const ctx = { count: securityIssues.length };
    suggestions.push({
      id: nextId(),
      type: 'improve_security_rules',
      title: template.title(ctx),
      titleAr: template.titleAr(ctx),
      description: template.description(ctx),
      descriptionAr: template.descriptionAr(ctx),
      targetFiles: securityIssues.map((f) => f.filePath),
      estimatedImpact: 'high',
      estimatedEffort: 'M',
      createdAt: now,
      icon: template.icon,
    });
  }

  // 6) Dead code
  const deadCodeFiles = fileScores.filter((f) => f.categoryWeights.deadCode > 3);
  if (deadCodeFiles.length >= 2) {
    const template = SUGGESTION_TEMPLATES.cleanup_dead_code;
    const ctx = { count: deadCodeFiles.length };
    suggestions.push({
      id: nextId(),
      type: 'cleanup_dead_code',
      title: template.title(ctx),
      titleAr: template.titleAr(ctx),
      description: template.description(ctx),
      descriptionAr: template.descriptionAr(ctx),
      targetFiles: deadCodeFiles.slice(0, 15).map((f) => f.filePath),
      estimatedImpact: 'medium',
      estimatedEffort: 'S',
      createdAt: now,
      icon: template.icon,
    });
  }

  // 7) Backup files
  const backupFiles = fileScores.filter(
    (f) =>
      f.filePath.includes('/backup/') ||
      f.filePath.includes('_backup') ||
      f.filePath.includes('.backup') ||
      f.filePath.match(/_\d{4,}/)
  );
  if (backupFiles.length > 0) {
    const template = SUGGESTION_TEMPLATES.remove_legacy_backups;
    const ctx = { count: backupFiles.length };
    suggestions.push({
      id: nextId(),
      type: 'remove_legacy_backups',
      title: template.title(ctx),
      titleAr: template.titleAr(ctx),
      description: template.description(ctx),
      descriptionAr: template.descriptionAr(ctx),
      targetFiles: backupFiles.map((f) => f.filePath),
      estimatedImpact: 'low',
      estimatedEffort: 'S',
      createdAt: now,
      icon: template.icon,
    });
  }

  // 8) High complexity files
  const complexFiles = fileScores.filter((f) => f.complexity > 50);
  if (complexFiles.length >= 2) {
    const template = SUGGESTION_TEMPLATES.reduce_file_complexity;
    const ctx = { count: complexFiles.length };
    suggestions.push({
      id: nextId(),
      type: 'reduce_file_complexity',
      title: template.title(ctx),
      titleAr: template.titleAr(ctx),
      description: template.description(ctx),
      descriptionAr: template.descriptionAr(ctx),
      targetFiles: complexFiles.slice(0, 10).map((f) => f.filePath),
      estimatedImpact: 'high',
      estimatedEffort: 'L',
      createdAt: now,
      icon: template.icon,
    });
  }

  // 9) Test coverage for high-risk files
  if (highRisk.length >= 3) {
    const template = SUGGESTION_TEMPLATES.improve_test_coverage;
    const ctx = { count: highRisk.length };
    suggestions.push({
      id: nextId(),
      type: 'improve_test_coverage',
      title: template.title(ctx),
      titleAr: template.titleAr(ctx),
      description: template.description(ctx),
      descriptionAr: template.descriptionAr(ctx),
      targetFiles: highRisk.slice(0, 10).map((f) => f.filePath),
      estimatedImpact: 'high',
      estimatedEffort: 'L',
      createdAt: now,
      icon: template.icon,
    });
  }

  // Sort by impact (high first)
  const impactOrder = { high: 0, medium: 1, low: 2 };
  return suggestions.sort((a, b) => impactOrder[a.estimatedImpact] - impactOrder[b.estimatedImpact]);
}

/**
 * Get suggestions by impact level
 */
export function getSuggestionsByImpact(
  suggestions: AceSuggestion[],
  impact: 'low' | 'medium' | 'high'
): AceSuggestion[] {
  return suggestions.filter((s) => s.estimatedImpact === impact);
}

/**
 * Get suggestions by type
 */
export function getSuggestionsByType(
  suggestions: AceSuggestion[],
  type: AceSuggestionId
): AceSuggestion[] {
  return suggestions.filter((s) => s.type === type);
}

export default {
  buildAceSuggestions,
  getSuggestionsByImpact,
  getSuggestionsByType,
};
