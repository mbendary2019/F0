/**
 * Cognitive Ops Copilot Module
 * Reinforcement Learning & Autonomous Decision Making
 */

export { cognitiveOrchestrator } from './orchestrator';
export { outcomeTracker } from './outcomeTracker';

export {
  initPolicyParams,
  selectAction,
  updatePolicy,
  explainAction,
  contextToFeatures,
  getFeatureDimension
} from './policy';

export {
  assessRisk,
  applyGuardrails,
  logGuardrailDecision
} from './governor';

export type {
  Action,
  RiskLevel,
  ApprovalStatus,
  Context,
  PolicyParams,
  Decision,
  MetricsSnapshot,
  Guardrail,
  Outcome,
  GovernorDecision
} from './types';


