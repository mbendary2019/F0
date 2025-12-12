// desktop/src/lib/ace/acePlanner.ts
// Phase 128.3: Evolution Plan Generator

import type { AcePlan, AcePlanPhase, AceSuggestion } from './aceTypes';

/**
 * Phase templates with bilingual text
 */
const PHASE_TEMPLATES = {
  critical: {
    id: 'phase-1-critical',
    title: 'Phase 1: Critical Fixes',
    titleAr: 'المرحلة 1: الإصلاحات الحرجة',
    description: 'Address security issues, high-risk files, and critical structural problems.',
    descriptionAr: 'معالجة مشاكل الأمان، الملفات عالية الخطورة، والمشاكل الهيكلية الحرجة.',
    order: 1,
    estimatedEffort: 'L' as const,
  },
  structure: {
    id: 'phase-2-structure',
    title: 'Phase 2: Structural Improvements',
    titleAr: 'المرحلة 2: تحسينات هيكلية',
    description: 'Improve code structure, split large files, and reduce complexity.',
    descriptionAr: 'تحسين هيكل الكود، تقسيم الملفات الكبيرة، وتقليل التعقيد.',
    order: 2,
    estimatedEffort: 'M' as const,
  },
  quality: {
    id: 'phase-3-quality',
    title: 'Phase 3: Quality & Types',
    titleAr: 'المرحلة 3: الجودة والأنواع',
    description: 'Add proper TypeScript types, fix any types, and improve type safety.',
    descriptionAr: 'إضافة أنواع TypeScript المناسبة، إصلاح أنواع any، وتحسين أمان الأنواع.',
    order: 3,
    estimatedEffort: 'M' as const,
  },
  cleanup: {
    id: 'phase-4-cleanup',
    title: 'Phase 4: Cleanup & Polish',
    titleAr: 'المرحلة 4: تنظيف وتلميع',
    description: 'Clean up logging, remove dead code, archive legacy files.',
    descriptionAr: 'تنظيف الـ logging، إزالة الكود الميت، أرشفة الملفات القديمة.',
    order: 4,
    estimatedEffort: 'S' as const,
  },
  testing: {
    id: 'phase-5-testing',
    title: 'Phase 5: Testing & Documentation',
    titleAr: 'المرحلة 5: الاختبارات والتوثيق',
    description: 'Add tests for critical paths and improve documentation.',
    descriptionAr: 'إضافة اختبارات للمسارات الحرجة وتحسين التوثيق.',
    order: 5,
    estimatedEffort: 'L' as const,
  },
};

/**
 * Categorize suggestions into phases
 */
function categorizeSuggestions(suggestions: AceSuggestion[]): {
  critical: string[];
  structure: string[];
  quality: string[];
  cleanup: string[];
  testing: string[];
} {
  const result = {
    critical: [] as string[],
    structure: [] as string[],
    quality: [] as string[],
    cleanup: [] as string[],
    testing: [] as string[],
  };

  for (const s of suggestions) {
    switch (s.type) {
      case 'improve_security_rules':
        result.critical.push(s.id);
        break;
      case 'split_large_file':
      case 'reduce_file_complexity':
      case 'extract_shared_utils':
        result.structure.push(s.id);
        break;
      case 'convert_js_to_ts':
      case 'reduce_any_types':
      case 'tighten_tsconfig':
        result.quality.push(s.id);
        break;
      case 'cleanup_logging_heavy_file':
      case 'cleanup_dead_code':
      case 'remove_legacy_backups':
        result.cleanup.push(s.id);
        break;
      case 'improve_test_coverage':
        result.testing.push(s.id);
        break;
      default:
        // Put unknown types in cleanup
        result.cleanup.push(s.id);
    }
  }

  return result;
}

/**
 * Build an evolution plan from suggestions
 */
export function buildAcePlanFromSuggestions(suggestions: AceSuggestion[]): AcePlan {
  const now = new Date().toISOString();
  const categorized = categorizeSuggestions(suggestions);
  const phases: AcePlanPhase[] = [];

  // Add phases that have suggestions
  if (categorized.critical.length > 0) {
    phases.push({
      ...PHASE_TEMPLATES.critical,
      suggestionIds: categorized.critical,
      status: 'pending',
    });
  }

  if (categorized.structure.length > 0) {
    phases.push({
      ...PHASE_TEMPLATES.structure,
      order: phases.length + 1,
      suggestionIds: categorized.structure,
      status: 'pending',
    });
  }

  if (categorized.quality.length > 0) {
    phases.push({
      ...PHASE_TEMPLATES.quality,
      order: phases.length + 1,
      suggestionIds: categorized.quality,
      status: 'pending',
    });
  }

  if (categorized.cleanup.length > 0) {
    phases.push({
      ...PHASE_TEMPLATES.cleanup,
      order: phases.length + 1,
      suggestionIds: categorized.cleanup,
      status: 'pending',
    });
  }

  if (categorized.testing.length > 0) {
    phases.push({
      ...PHASE_TEMPLATES.testing,
      order: phases.length + 1,
      suggestionIds: categorized.testing,
      status: 'pending',
    });
  }

  // Calculate summary
  const totalSuggestions = suggestions.length;
  const highImpact = suggestions.filter((s) => s.estimatedImpact === 'high').length;

  const plan: AcePlan = {
    id: `ace-plan-${Date.now()}`,
    name: 'Code Evolution Plan',
    nameAr: 'خطة تطوير الكود',
    createdAt: now,
    summary: `Auto-generated plan with ${phases.length} phases and ${totalSuggestions} improvements. ${highImpact} high-impact changes recommended.`,
    summaryAr: `خطة مولدة تلقائياً من ${phases.length} مراحل و ${totalSuggestions} تحسين. ${highImpact} تغيير عالي التأثير موصى به.`,
    phases,
    progress: 0,
  };

  return plan;
}

/**
 * Get suggestions for a specific phase
 */
export function getSuggestionsForPhase(
  plan: AcePlan,
  phaseId: string,
  allSuggestions: AceSuggestion[]
): AceSuggestion[] {
  const phase = plan.phases.find((p) => p.id === phaseId);
  if (!phase) return [];

  return allSuggestions.filter((s) => phase.suggestionIds.includes(s.id));
}

/**
 * Mark a phase as in progress
 */
export function markPhaseInProgress(plan: AcePlan, phaseId: string): AcePlan {
  return {
    ...plan,
    phases: plan.phases.map((p) =>
      p.id === phaseId ? { ...p, status: 'in_progress' as const } : p
    ),
  };
}

/**
 * Mark a phase as completed
 */
export function markPhaseCompleted(plan: AcePlan, phaseId: string): AcePlan {
  const newPhases = plan.phases.map((p) =>
    p.id === phaseId ? { ...p, status: 'completed' as const } : p
  );

  const completedCount = newPhases.filter((p) => p.status === 'completed').length;
  const progress = Math.round((completedCount / newPhases.length) * 100);

  return {
    ...plan,
    phases: newPhases,
    progress,
  };
}

/**
 * Get the next incomplete phase
 */
export function getNextPhase(plan: AcePlan): AcePlanPhase | null {
  return plan.phases.find((p) => p.status !== 'completed') ?? null;
}

/**
 * Calculate total effort for the plan
 */
export function calculateTotalEffort(plan: AcePlan): { small: number; medium: number; large: number } {
  const result = { small: 0, medium: 0, large: 0 };

  for (const phase of plan.phases) {
    if (phase.estimatedEffort === 'S') result.small++;
    else if (phase.estimatedEffort === 'M') result.medium++;
    else result.large++;
  }

  return result;
}

export default {
  buildAcePlanFromSuggestions,
  getSuggestionsForPhase,
  markPhaseInProgress,
  markPhaseCompleted,
  getNextPhase,
  calculateTotalEffort,
};
