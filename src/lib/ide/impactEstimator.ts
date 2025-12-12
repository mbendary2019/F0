/**
 * Phase 85.4.1: Impact & Risk Estimation Engine
 * Analyzes workspace plan steps to predict impact, risk, and blast radius
 */

import {
  IdeProjectAnalysisDocument,
  WorkspacePlanStep,
  WorkspacePlanStepImpact,
  ImpactLevel,
  RiskLevel,
} from '@/types/ideBridge';

/**
 * Estimates the impact and risk of a single plan step
 * Uses dependency analysis to calculate blast radius and risk levels
 */
export function estimateStepImpact(
  step: WorkspacePlanStep,
  analysis: IdeProjectAnalysisDocument
): WorkspacePlanStepImpact {
  const { summary, files } = analysis;

  // Analyze each target file
  const fileImpacts = step.targetFiles.map((path) => {
    const file = files.find((f) => f.path === path);

    if (!file) {
      // File not found in analysis - assume low impact
      return {
        path,
        fanIn: 0,
        fanOut: 0,
        isCore: false,
        isGodFile: false,
        isCycleParticipant: false,
        predictedBlastRadius: 0,
        impact: 'low' as ImpactLevel,
        risk: 'low' as RiskLevel,
      };
    }

    // Check if file is in any cycles
    const inCycle = summary.cycles?.some((cycle) => cycle.includes(path)) ?? false;

    // Determine if file is "core" (high fan-in = many dependents)
    const isCore = (file.fanIn ?? 0) >= 10;

    // Determine if file is "god file" (high fan-out = many dependencies)
    const isGod = (file.fanOut ?? 0) >= 10;

    // Calculate blast radius using weighted formula
    // fanIn has more weight because changes affect all dependents
    // Cycles and core files increase blast radius significantly
    const blast =
      (file.fanIn ?? 0) * 0.7 +
      (file.fanOut ?? 0) * 0.3 +
      (inCycle ? 10 : 0) +
      (isCore ? 5 : 0);

    // Determine impact level based on blast radius
    const impact: ImpactLevel =
      blast >= 20 ? 'high' : blast >= 8 ? 'medium' : 'low';

    // Determine risk level
    // Cycles, god files, and core files are always high risk
    const risk: RiskLevel =
      inCycle || isGod || isCore ? 'high' : impact;

    return {
      path,
      fanIn: file.fanIn ?? 0,
      fanOut: file.fanOut ?? 0,
      isCore,
      isGodFile: isGod,
      isCycleParticipant: inCycle,
      predictedBlastRadius: Math.round(blast),
      impact,
      risk,
    };
  });

  // Calculate overall impact (highest of all files)
  const maxImpact = fileImpacts.reduce(
    (acc, f) =>
      f.impact === 'high' ? 'high' : f.impact === 'medium' ? 'medium' : acc,
    'low' as ImpactLevel
  );

  // Calculate overall risk (highest of all files)
  const maxRisk = fileImpacts.reduce(
    (acc, f) =>
      f.risk === 'high' ? 'high' : f.risk === 'medium' ? 'medium' : acc,
    'low' as RiskLevel
  );

  // Calculate total blast radius
  const totalBlastRadius = fileImpacts.reduce(
    (sum, f) => sum + f.predictedBlastRadius,
    0
  );

  // Generate safety notes based on risk level
  let notes = '';
  if (maxRisk === 'high') {
    notes =
      'This step affects high-impact or cyclic files. Consider applying isolated patches and running tests.';
  } else if (maxRisk === 'medium') {
    notes = 'Moderate impact. Review patches before applying.';
  } else {
    notes = 'Low impact step.';
  }

  return {
    fileImpacts,
    overallImpact: maxImpact,
    overallRisk: maxRisk,
    blastRadius: totalBlastRadius,
    notes,
  };
}

/**
 * Attaches impact estimation to all steps in a workspace plan
 * Mutates the plan steps by adding impact data
 */
export function attachImpactToPlan(
  plan: any,
  analysis: IdeProjectAnalysisDocument | null
): any {
  if (!analysis) {
    console.log('[Impact Estimator] No analysis available - skipping impact estimation');
    return plan;
  }

  console.log('[Impact Estimator] Estimating impact for', plan.steps.length, 'steps');

  plan.steps = plan.steps.map((step: WorkspacePlanStep) => ({
    ...step,
    impact: estimateStepImpact(step, analysis),
  }));

  console.log('[Impact Estimator] Impact estimation complete');

  return plan;
}
