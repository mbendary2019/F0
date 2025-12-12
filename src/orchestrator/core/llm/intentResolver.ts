// orchestrator/core/llm/intentResolver.ts
// Phase 170.2: Intent Resolver - Converts user input to Agent Role

import type { AgentRole } from './agentRoles';

/**
 * Input context for intent resolution
 */
export interface IntentInput {
  /** The user's message */
  message: string;
  /** Length of the message */
  messageLength?: number;
  /** Whether the message contains code blocks */
  hasCodeBlock?: boolean;
  /** Whether this is a file analysis request */
  isFileAnalysis?: boolean;
  /** File path if analyzing a file */
  filePath?: string;
  /** Previous role in conversation (for continuity) */
  previousRole?: AgentRole;
  /** Language detected in code */
  codeLanguage?: string;
  /** Number of files involved */
  fileCount?: number;
  /** User tier (affects routing) */
  userTier?: 'free' | 'pro' | 'ultimate';
}

/**
 * Intent resolution result
 */
export interface IntentResult {
  role: AgentRole;
  confidence: number; // 0-1
  reason: string;
  suggestedTemperature?: number;
}

/**
 * Pattern matchers for different intents
 */
const INTENT_PATTERNS = {
  // Planning patterns (Arabic + English)
  planning: [
    /خطة|خطط|تخطيط|GTM|إطلاق|منتج|SaaS|استراتيج|roadmap/i,
    /plan|planning|strategy|roadmap|launch|product|business|startup/i,
    /كيف (أبدأ|نبدأ|أعمل|نعمل)|how (to|do|can|should)/i,
    /مشروع جديد|new project|build.*app|create.*platform/i,
  ],

  // UX/UI patterns
  ux_ideation: [
    /UX|UI|تجربة|محرر|واجهة|تصميم|design/i,
    /user experience|interface|layout|wireframe|prototype/i,
    /شكل.*الصفحة|page.*design|component.*design/i,
    /flow|journey|onboarding|navigation/i,
  ],

  // Code generation patterns
  code_generation: [
    /اكتب.*كود|write.*code|create.*function|implement/i,
    /كود|code|function|class|component|api|endpoint/i,
    /أضف.*feature|add.*feature|build.*system/i,
    /typescript|javascript|python|react|next\.?js/i,
  ],

  // Code review patterns
  code_review: [
    /راجع|review|check|refactor|optimize|improve/i,
    /bug|error|issue|problem|fix|debug/i,
    /ما.*خطأ|what.*wrong|why.*not.*work/i,
    /clean.*up|simplify|restructure/i,
  ],

  // Complex analysis patterns
  complex_analysis: [
    /حلل|تحليل|analyze|analysis|compare|evaluate/i,
    /architecture|system.*design|trade.*off|decision/i,
    /معقد|complex|detailed|comprehensive|deep.*dive/i,
    /multiple.*options|pros.*cons|best.*approach/i,
  ],

  // Light chat patterns
  chat_light: [
    /^(hi|hello|hey|مرحبا|أهلا|السلام|صباح|مساء)/i,
    /^(شكرا|thanks|thank you|thx)/i,
    /^(ok|okay|تمام|حسنًا|good|great)/i,
    /^.{0,30}$/,  // Very short messages
  ],
};

/**
 * Resolve intent from user input
 */
export function resolveAgentRole(input: IntentInput): IntentResult {
  const message = input.message || '';
  const messageLength = input.messageLength || message.length;

  // Priority 1: File analysis → code_review
  if (input.isFileAnalysis || input.filePath) {
    return {
      role: 'code_review',
      confidence: 0.95,
      reason: 'File analysis detected',
    };
  }

  // Priority 2: Code blocks → code_generation or code_review
  if (input.hasCodeBlock) {
    // Check if it's a review request
    const isReview = INTENT_PATTERNS.code_review.some(p => p.test(message));
    return {
      role: isReview ? 'code_review' : 'code_generation',
      confidence: 0.9,
      reason: isReview ? 'Code block with review intent' : 'Code block detected',
    };
  }

  // Priority 3: Very long messages → complex_analysis
  if (messageLength > 3000) {
    return {
      role: 'complex_analysis',
      confidence: 0.85,
      reason: 'Long message requiring deep analysis',
    };
  }

  // Priority 4: Pattern matching
  // Check complex analysis first (often has specific keywords)
  if (INTENT_PATTERNS.complex_analysis.some(p => p.test(message))) {
    return {
      role: 'complex_analysis',
      confidence: 0.8,
      reason: 'Complex analysis keywords detected',
    };
  }

  // Check code review
  if (INTENT_PATTERNS.code_review.some(p => p.test(message))) {
    return {
      role: 'code_review',
      confidence: 0.8,
      reason: 'Code review keywords detected',
    };
  }

  // Check code generation
  if (INTENT_PATTERNS.code_generation.some(p => p.test(message))) {
    return {
      role: 'code_generation',
      confidence: 0.75,
      reason: 'Code generation keywords detected',
    };
  }

  // Check planning
  if (INTENT_PATTERNS.planning.some(p => p.test(message))) {
    return {
      role: 'planning',
      confidence: 0.8,
      reason: 'Planning keywords detected',
    };
  }

  // Check UX ideation
  if (INTENT_PATTERNS.ux_ideation.some(p => p.test(message))) {
    return {
      role: 'ux_ideation',
      confidence: 0.75,
      reason: 'UX/UI keywords detected',
    };
  }

  // Check light chat
  if (INTENT_PATTERNS.chat_light.some(p => p.test(message))) {
    return {
      role: 'chat_light',
      confidence: 0.9,
      reason: 'Light chat pattern detected',
    };
  }

  // Priority 5: Continuity - stick with previous role if uncertain
  if (input.previousRole && input.previousRole !== 'fallback_safe') {
    return {
      role: input.previousRole,
      confidence: 0.5,
      reason: 'Continuing with previous role',
    };
  }

  // Default: chat_light for general messages
  return {
    role: 'chat_light',
    confidence: 0.6,
    reason: 'Default to light chat',
  };
}

/**
 * Quick helper to detect code blocks in message
 */
export function hasCodeBlock(message: string): boolean {
  return /```[\s\S]*?```/.test(message) || /`[^`]+`/.test(message);
}

/**
 * Quick helper to detect file analysis intent
 * More specific - requires file path pattern, not just keywords
 */
export function isFileAnalysisIntent(message: string): boolean {
  // Look for actual file paths with extensions
  return /\.(ts|tsx|js|jsx|py|go|rs|java|cpp|c|h|css|scss|html|json|yaml|yml|md|txt)($|\s|:)/i.test(message)
    && /(file|ملف|analyze|حلل|look at|check|review)\s+/i.test(message);
}

/**
 * Extract code language from message
 */
export function detectCodeLanguage(message: string): string | undefined {
  const langPatterns: Record<string, RegExp> = {
    typescript: /typescript|\.tsx?|ts:|tsx:/i,
    javascript: /javascript|\.jsx?|js:|jsx:/i,
    python: /python|\.py|py:/i,
    go: /golang|\.go|go:/i,
    rust: /rust|\.rs|rs:/i,
    java: /java|\.java/i,
    cpp: /c\+\+|cpp|\.cpp|\.cc/i,
    css: /css|\.css|scss|\.scss/i,
    html: /html|\.html/i,
  };

  for (const [lang, pattern] of Object.entries(langPatterns)) {
    if (pattern.test(message)) return lang;
  }

  // Check for code blocks with language
  const codeBlockMatch = message.match(/```(\w+)/);
  if (codeBlockMatch) return codeBlockMatch[1].toLowerCase();

  return undefined;
}

/**
 * Resolve with full context
 */
export function resolveWithContext(
  message: string,
  context?: Partial<IntentInput>
): IntentResult {
  return resolveAgentRole({
    message,
    messageLength: message.length,
    hasCodeBlock: hasCodeBlock(message),
    isFileAnalysis: isFileAnalysisIntent(message),
    codeLanguage: detectCodeLanguage(message),
    ...context,
  });
}
