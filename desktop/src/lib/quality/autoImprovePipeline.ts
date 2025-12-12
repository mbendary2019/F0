// desktop/src/lib/quality/autoImprovePipeline.ts
// Phase 135.5: Auto-Improve Pipeline
// One-click optimization that runs multiple quality actions in sequence

import type { QualityActionType } from './policyActions';

export interface PipelineStep {
  action: QualityActionType;
  labelEn: string;
  labelAr: string;
  icon: string;
  /** Whether this step is conditional (e.g., security fix only if alerts exist) */
  conditional?: boolean;
}

export interface PipelineProgress {
  currentStep: number;
  totalSteps: number;
  currentAction: QualityActionType | null;
  isComplete: boolean;
  completedSteps: QualityActionType[];
}

/**
 * Default pipeline steps for auto-improvement
 */
export const DEFAULT_PIPELINE_STEPS: PipelineStep[] = [
  {
    action: 'AUTO_FIX_ISSUES',
    labelEn: 'Auto-fix issues',
    labelAr: 'إصلاح تلقائي للمشاكل',
    icon: '🔧',
  },
  {
    action: 'GENERATE_TESTS',
    labelEn: 'Generate tests',
    labelAr: 'توليد اختبارات',
    icon: '🧪',
  },
  {
    action: 'SECURITY_FIX',
    labelEn: 'Security fixes',
    labelAr: 'إصلاحات أمنية',
    icon: '🛡️',
    conditional: true, // Only run if security alerts exist
  },
  {
    action: 'RUN_FULL_REVIEW',
    labelEn: 'Full review',
    labelAr: 'مراجعة كاملة',
    icon: '📋',
  },
];

export interface AutoImprovePipelineOptions {
  /** The steps to run (defaults to DEFAULT_PIPELINE_STEPS) */
  steps?: PipelineStep[];
  /** Whether to skip conditional steps (like security fix if no alerts) */
  skipConditional?: boolean;
  /** Callback for progress updates */
  onProgress?: (progress: PipelineProgress) => void;
  /** Delay between steps in ms (for UI feedback) */
  stepDelay?: number;
}

/**
 * Run the auto-improve pipeline
 * Executes multiple quality actions in sequence
 */
export async function runAutoImprovePipeline(
  runAction: (action: QualityActionType) => Promise<void>,
  options: AutoImprovePipelineOptions = {}
): Promise<void> {
  const {
    steps = DEFAULT_PIPELINE_STEPS,
    skipConditional = false,
    onProgress,
    stepDelay = 500,
  } = options;

  // Filter out conditional steps if requested
  const activeSteps = skipConditional
    ? steps.filter((s) => !s.conditional)
    : steps;

  const totalSteps = activeSteps.length;
  const completedSteps: QualityActionType[] = [];

  for (let i = 0; i < activeSteps.length; i++) {
    const step = activeSteps[i];

    // Report progress
    onProgress?.({
      currentStep: i + 1,
      totalSteps,
      currentAction: step.action,
      isComplete: false,
      completedSteps: [...completedSteps],
    });

    // Run the action
    try {
      await runAction(step.action);
      completedSteps.push(step.action);
    } catch (error) {
      console.error(`[AutoImprovePipeline] Step ${step.action} failed:`, error);
      // Continue with next step even if one fails
    }

    // Small delay between steps for UI feedback
    if (stepDelay > 0 && i < activeSteps.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, stepDelay));
    }
  }

  // Report completion
  onProgress?.({
    currentStep: totalSteps,
    totalSteps,
    currentAction: null,
    isComplete: true,
    completedSteps,
  });
}

/**
 * Get a localized label for a pipeline step
 */
export function getPipelineStepLabel(
  step: PipelineStep,
  locale: 'en' | 'ar'
): string {
  return locale === 'ar' ? step.labelAr : step.labelEn;
}

/**
 * Create a custom pipeline with specific steps
 */
export function createCustomPipeline(
  actions: QualityActionType[]
): PipelineStep[] {
  const actionLabels: Record<QualityActionType, { en: string; ar: string; icon: string }> = {
    AUTO_FIX_ISSUES: { en: 'Auto-fix issues', ar: 'إصلاح تلقائي', icon: '🔧' },
    GENERATE_TESTS: { en: 'Generate tests', ar: 'توليد اختبارات', icon: '🧪' },
    SECURITY_FIX: { en: 'Security fixes', ar: 'إصلاحات أمنية', icon: '🛡️' },
    RUN_FULL_REVIEW: { en: 'Full review', ar: 'مراجعة كاملة', icon: '📋' },
  };

  return actions.map((action) => {
    const labels = actionLabels[action] || { en: action, ar: action, icon: '▶️' };
    return {
      action,
      labelEn: labels.en,
      labelAr: labels.ar,
      icon: labels.icon,
    };
  });
}
