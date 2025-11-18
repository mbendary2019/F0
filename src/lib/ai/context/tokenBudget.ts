// src/lib/ai/context/tokenBudget.ts
// Lightweight token estimator + budget slicer (model-agnostic heuristic)

export type BudgetPlan = {
  ctxMaxTokens: number; // Budget for context snippets
  modelMaxTokens: number; // Hard cap for the model (context + prompt + output)
  targetOutputTokens: number; // Reserve for completion
};

/**
 * Get default budget from environment or use sensible defaults
 */
export function defaultBudget(): BudgetPlan {
  const ctx = parseInt(process.env.CTX_MAX_TOKENS || "2000", 10);
  const out = parseInt(process.env.PROMPT_MAX_TOKENS || "800", 10);
  return {
    ctxMaxTokens: ctx,
    modelMaxTokens: 128000, // GPT-4o/GPT-5 context window
    targetOutputTokens: out,
  };
}

/**
 * Crude token estimate: ~4 chars per token (safe side).
 * For precise budgeting, integrate tiktoken library.
 *
 * @param s - String to estimate
 * @returns Estimated token count
 */
export function estimateTokens(s: string): number {
  if (!s) return 0;
  // Simple heuristic: 1 token ≈ 4 characters (works for English/Arabic)
  return Math.ceil(s.length / 4);
}

/**
 * Fit snippets to token budget, preserving order.
 * Stops adding when budget would be exceeded.
 *
 * @param snippets - Array of text snippets
 * @param maxTokens - Maximum token budget
 * @returns Included snippets and token count used
 */
export function fitSnippetsToBudget(
  snippets: string[],
  maxTokens: number
): { included: string[]; usedTokens: number } {
  const out: string[] = [];
  let used = 0;

  for (const s of snippets) {
    const t = estimateTokens(s);
    if (used + t <= maxTokens) {
      out.push(s);
      used += t;
    } else {
      break; // Stop when budget exceeded
    }
  }

  return { included: out, usedTokens: used };
}

/**
 * Calculate remaining budget after system + user prompts
 *
 * @param totalBudget - Total model budget
 * @param systemPrompt - System prompt text
 * @param userPrompt - User prompt text
 * @param targetOutput - Target output tokens
 * @returns Remaining tokens for context
 */
export function calculateContextBudget(
  totalBudget: number,
  systemPrompt: string,
  userPrompt: string,
  targetOutput: number
): number {
  const systemTokens = estimateTokens(systemPrompt);
  const userTokens = estimateTokens(userPrompt);
  const overhead = systemTokens + userTokens + targetOutput;

  return Math.max(0, totalBudget - overhead);
}

/**
 * Truncate text to fit token budget
 *
 * @param text - Text to truncate
 * @param maxTokens - Maximum tokens
 * @param suffix - Optional suffix (e.g., "...")
 * @returns Truncated text
 */
export function truncateToTokens(
  text: string,
  maxTokens: number,
  suffix: string = "..."
): string {
  if (estimateTokens(text) <= maxTokens) {
    return text;
  }

  // Binary search for right length
  let low = 0;
  let high = text.length;
  let result = "";

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = text.slice(0, mid) + suffix;
    const tokens = estimateTokens(candidate);

    if (tokens <= maxTokens) {
      result = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result || text.slice(0, Math.floor(maxTokens * 4)) + suffix;
}

/**
 * Estimate tokens for multiple messages (OpenAI format)
 *
 * @param messages - Array of {role, content} messages
 * @returns Total estimated tokens
 */
export function estimateMessageTokens(
  messages: Array<{ role: string; content: string }>
): number {
  // Add overhead for message formatting (~4 tokens per message)
  const overhead = messages.length * 4;
  const contentTokens = messages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );
  return overhead + contentTokens;
}
