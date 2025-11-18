// src/lib/rag/policy.ts
// Phase 58: Strategy selection for semantic routing

import { RecallOpts, Strategy } from './types';

/**
 * Choose retrieval strategy based on query characteristics
 *
 * Rules (simple heuristics, can be learned later in Phase 59):
 * - Exact/keyword queries → sparse (BM25)
 * - Code queries → hybrid (combine semantic + lexical)
 * - Short queries (≤4 words) → hybrid
 * - Default → dense (semantic search)
 *
 * @param query - User query text
 * @param opts - Recall options
 * @param stats - Optional historical stats for learning
 * @returns Selected strategy
 */
export function chooseStrategy(
  query: string,
  opts: RecallOpts,
  stats?: any
): Strategy {
  const q = query.trim();
  const len = q.split(/\s+/).length;

  // Detect code patterns
  const isCode =
    /\{[}\s]|function\s|class\s|const\s|import\s|export\s/.test(q) ||
    /```/.test(q) ||
    /\bdef\b|\bif\b|\bfor\b|\bwhile\b/.test(q);

  // Detect exact/keyword search patterns
  const isExactish =
    /".+"/.test(q) || // quoted strings
    /site:|file:|path:|#\w+/.test(q) || // filters
    /\b(find|search|locate)\s+(file|function|class)\b/i.test(q);

  // Strategy selection
  if (isExactish) {
    return 'sparse'; // Best for keyword matching
  }

  if (isCode) {
    return 'hybrid'; // Combine to preserve semantics + exact matches
  }

  if (len <= 4) {
    return 'hybrid'; // Short queries benefit from both
  }

  // Default: semantic search for natural language
  return 'dense';
}

/**
 * Get strategy confidence score (0-1)
 * Higher = more confident in the chosen strategy
 */
export function getStrategyConfidence(
  query: string,
  strategy: Strategy
): number {
  const q = query.trim();
  const len = q.split(/\s+/).length;

  // High confidence indicators
  if (strategy === 'sparse' && /".+"/.test(q)) return 0.95;
  if (strategy === 'dense' && len > 10) return 0.90;
  if (strategy === 'hybrid' && len <= 4) return 0.85;

  // Medium confidence (default)
  return 0.70;
}

/**
 * Explain why a strategy was chosen (for debugging)
 */
export function explainStrategy(query: string, strategy: Strategy): string {
  const q = query.trim();
  const len = q.split(/\s+/).length;

  if (strategy === 'sparse') {
    if (/".+"/.test(q)) return 'Quoted string detected → exact match preferred';
    if (/site:|file:|path:/.test(q)) return 'Filter pattern detected → keyword search';
    return 'Keyword-focused query → sparse retrieval';
  }

  if (strategy === 'hybrid') {
    if (/```/.test(q)) return 'Code block detected → hybrid search';
    if (len <= 4) return 'Short query → combining semantic + lexical';
    return 'Ambiguous query → using both methods';
  }

  // dense
  if (len > 10) return 'Long natural language query → semantic search';
  return 'Default: semantic search for best relevance';
}
