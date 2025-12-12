// src/lib/agents/modelSelector.ts
// Phase 188: Model Selector for Desktop IDE Chat
// Intelligent routing of chat messages to appropriate LLM providers

import capabilities from './capabilities.json';

// ============================================
// Types
// ============================================

export type LLMProvider = 'openai' | 'anthropic' | 'gemini';

export type ModelProfile =
  | 'codeHeavy'      // TypeScript, React, Next.js code generation
  | 'longContext'    // Large file analysis, refactoring
  | 'reasoning'      // Business logic, architecture decisions
  | 'multimodal'     // Image analysis, UI design
  | 'quickChat'      // Simple greetings, short answers
  | 'debug'          // Error analysis, debugging
  | 'docs';          // Documentation, explanations

export interface ModelCandidate {
  provider: LLMProvider;
  model: string;
  score: number;
  reason: string;
}

export interface ModelSelectorDecision {
  provider: LLMProvider;
  model: string;
  profile: ModelProfile;
  candidates: ModelCandidate[];
  reason: string;
  fallbackChain: string[];
}

export interface ModelSelectorInput {
  message: string;
  locale: 'ar' | 'en';
  hasFileContext: boolean;
  hasRunnerContext: boolean;
  hasImageAttachments: boolean;
  historyLength: number;
  fileContextLength?: number;
  messageLength: number;
  tags?: string[];
}

// ============================================
// Model Configurations
// ============================================

const MODEL_CONFIG = {
  openai: {
    provider: 'openai' as LLMProvider,
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    miniModel: process.env.OPENAI_MODEL_MINI || 'gpt-4o-mini',
    strengths: ['typescript', 'react', 'nextjs', 'api', 'firebase', 'planning'],
    contextWindow: 128000,
  },
  anthropic: {
    provider: 'anthropic' as LLMProvider,
    model: 'claude-3-5-sonnet-20241022',
    strengths: ['refactor', 'long-context', 'code-review', 'debugging', 'architecture', 'docs'],
    contextWindow: 200000,
  },
  gemini: {
    provider: 'gemini' as LLMProvider,
    model: 'gemini-1.5-pro',
    strengths: ['vision', 'multimodal', 'translation', 'ui-text', 'mobile'],
    contextWindow: 2000000,
  },
};

// Profile to Provider mapping
const PROFILE_ROUTING: Record<ModelProfile, { primary: LLMProvider; fallback: LLMProvider[] }> = {
  codeHeavy: { primary: 'openai', fallback: ['anthropic', 'gemini'] },
  longContext: { primary: 'anthropic', fallback: ['gemini', 'openai'] },
  reasoning: { primary: 'anthropic', fallback: ['openai', 'gemini'] },
  multimodal: { primary: 'gemini', fallback: ['openai', 'anthropic'] },
  quickChat: { primary: 'openai', fallback: ['gemini', 'anthropic'] },
  debug: { primary: 'anthropic', fallback: ['openai', 'gemini'] },
  docs: { primary: 'anthropic', fallback: ['openai', 'gemini'] },
};

// ============================================
// Intent Detection
// ============================================

/**
 * Detect the intent/profile from user message
 */
function detectProfile(input: ModelSelectorInput): { profile: ModelProfile; confidence: number; signals: string[] } {
  const { message, hasFileContext, hasRunnerContext, hasImageAttachments, historyLength, messageLength } = input;
  const msgLower = message.toLowerCase();
  const signals: string[] = [];

  // 1. Multimodal (images)
  if (hasImageAttachments) {
    signals.push('has_image_attachments');
    return { profile: 'multimodal', confidence: 0.95, signals };
  }

  // 2. Quick chat (greetings, simple questions)
  const greetings = ['hi', 'hello', 'hey', 'هاي', 'اهلا', 'مرحبا', 'السلام', 'صباح', 'مساء'];
  if (greetings.some(g => msgLower.includes(g)) && messageLength < 50) {
    signals.push('greeting_detected');
    return { profile: 'quickChat', confidence: 0.9, signals };
  }

  // 3. Debug (runner context with errors)
  if (hasRunnerContext) {
    signals.push('has_runner_context');
    const errorKeywords = ['error', 'خطأ', 'مشكلة', 'bug', 'fix', 'صلح', 'crash', 'fail'];
    if (errorKeywords.some(k => msgLower.includes(k))) {
      signals.push('error_keywords_detected');
      return { profile: 'debug', confidence: 0.9, signals };
    }
  }

  // 4. Long context (large file or long history)
  const contextLength = input.fileContextLength || 0;
  if (contextLength > 10000 || historyLength > 10) {
    signals.push(`long_context: file=${contextLength}, history=${historyLength}`);
    return { profile: 'longContext', confidence: 0.85, signals };
  }

  // 5. Code heavy (specific code keywords)
  const codeKeywords = [
    'function', 'component', 'api', 'endpoint', 'hook', 'useState', 'useEffect',
    'typescript', 'react', 'next', 'firebase', 'stripe',
    'اعمل', 'أضف', 'كود', 'دالة', 'كومبوننت', 'هوك'
  ];
  if (codeKeywords.some(k => msgLower.includes(k)) || hasFileContext) {
    signals.push('code_keywords_or_file_context');
    return { profile: 'codeHeavy', confidence: 0.8, signals };
  }

  // 6. Documentation
  const docKeywords = ['explain', 'شرح', 'اشرح', 'what is', 'how does', 'إزاي', 'ليه', 'why', 'document', 'readme'];
  if (docKeywords.some(k => msgLower.includes(k))) {
    signals.push('doc_keywords_detected');
    return { profile: 'docs', confidence: 0.75, signals };
  }

  // 7. Reasoning (architecture, design)
  const reasoningKeywords = ['design', 'architecture', 'plan', 'structure', 'تصميم', 'هيكل', 'خطة', 'بنية'];
  if (reasoningKeywords.some(k => msgLower.includes(k))) {
    signals.push('reasoning_keywords_detected');
    return { profile: 'reasoning', confidence: 0.75, signals };
  }

  // Default: code heavy (most common use case)
  signals.push('default_to_codeHeavy');
  return { profile: 'codeHeavy', confidence: 0.6, signals };
}

// ============================================
// Model Selection
// ============================================

/**
 * Choose the best model for a given input
 */
export function chooseModel(input: ModelSelectorInput): ModelSelectorDecision {
  const { profile, confidence, signals } = detectProfile(input);
  const routing = PROFILE_ROUTING[profile];

  // Build candidates list with scores
  const candidates: ModelCandidate[] = [];

  // Primary choice
  const primaryConfig = MODEL_CONFIG[routing.primary];
  candidates.push({
    provider: routing.primary,
    model: profile === 'quickChat' && routing.primary === 'openai'
      ? MODEL_CONFIG.openai.miniModel  // Use mini for quick chat
      : primaryConfig.model,
    score: confidence,
    reason: `Primary for ${profile} profile`,
  });

  // Fallbacks
  routing.fallback.forEach((fb, idx) => {
    const fbConfig = MODEL_CONFIG[fb];
    candidates.push({
      provider: fb,
      model: fbConfig.model,
      score: confidence * (0.8 - idx * 0.1),
      reason: `Fallback #${idx + 1} for ${profile}`,
    });
  });

  // Build fallback chain
  const fallbackChain = [
    candidates[0].model,
    ...routing.fallback.map(fb => MODEL_CONFIG[fb].model),
  ];

  const decision: ModelSelectorDecision = {
    provider: routing.primary,
    model: candidates[0].model,
    profile,
    candidates,
    reason: `Profile: ${profile} (confidence: ${(confidence * 100).toFixed(0)}%) | Signals: ${signals.join(', ')}`,
    fallbackChain,
  };

  return decision;
}

// ============================================
// Logging Types
// ============================================

export interface LLMRequestLog {
  conversationId?: string;
  messageId?: string;
  provider: LLMProvider;
  model: string;
  profile: ModelProfile;
  inputTokens?: number;
  timestamp: number;
}

export interface LLMResponseLog {
  conversationId?: string;
  messageId?: string;
  provider: LLMProvider;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  success: boolean;
  timestamp: number;
}

export interface LLMErrorLog {
  conversationId?: string;
  messageId?: string;
  provider: LLMProvider;
  model: string;
  errorType: 'rate_limit' | 'timeout' | 'auth' | 'server' | 'unknown';
  statusCode?: number;
  errorMessage: string;
  willRetry: boolean;
  nextProvider?: LLMProvider;
  timestamp: number;
}

/**
 * Classify error type from error object
 */
export function classifyError(error: any): LLMErrorLog['errorType'] {
  const status = error?.status || error?.response?.status;
  const message = (error?.message || '').toLowerCase();

  if (status === 429 || message.includes('rate limit')) {
    return 'rate_limit';
  }
  if (status === 401 || status === 403 || message.includes('api key') || message.includes('auth')) {
    return 'auth';
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  }
  if (status >= 500) {
    return 'server';
  }
  return 'unknown';
}

/**
 * Get next fallback provider from decision
 */
export function getNextFallback(decision: ModelSelectorDecision, failedProvider: LLMProvider): ModelCandidate | null {
  const idx = decision.candidates.findIndex(c => c.provider === failedProvider);
  if (idx === -1 || idx >= decision.candidates.length - 1) {
    return null;
  }
  return decision.candidates[idx + 1];
}

export default {
  chooseModel,
  classifyError,
  getNextFallback,
};
