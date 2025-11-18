/**
 * Self-Evolving Ops Module
 * Auto-tuning, adaptation, and meta-learning
 */

export { autoPolicyTuner } from './tuner';
export { guardrailAdapt } from './guardrailAdapt';
export { metaLearner } from './metaLearner';
export { autoDoc } from './autoDoc';

export type { Tuning, WindowStats, PolicyVersion, GuardrailAdaptation, AutoDocEntry } from './types';


