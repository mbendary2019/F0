/**
 * Knowledge Validation Scoring Engine
 *
 * Scores validation quality across 4 dimensions:
 * 1. Citation coverage - How many citations support the answer
 * 2. Context alignment - How well hints/context are reflected
 * 3. Source reputation - Quality of cited sources
 * 4. Relevance - How well the answer matches the query
 */

import type { Citation } from "@/lib/types/context";
import { sourceReputation } from "./sourceReputation";

export type ValidationInput = {
  text: string;                 // Output text to validate
  query: string;                // Original goal/query
  citations: Citation[];        // Citations used in answer
  contextHints?: string[];      // Contextual hints from session
};

export type ValidationScore = {
  final: number;                // Overall score (0-1)
  subscores: {
    citation: number;           // Citation coverage score (0-1)
    context: number;            // Context alignment score (0-1)
    source: number;             // Source reputation score (0-1)
    relevance: number;          // Query relevance score (0-1)
  };
};

/**
 * Weights for combining subscores into final score
 */
const WEIGHTS = {
  citation: 0.35,   // Most important: evidence backing
  context: 0.25,    // Context alignment
  source: 0.20,     // Source quality
  relevance: 0.20   // Query relevance
};

/**
 * Score citation coverage
 * More citations = better (up to 6, then diminishing returns)
 */
function scoreCitation(citations: Citation[]): number {
  if (citations.length === 0) return 0;
  return Math.min(1, citations.length / 6);
}

/**
 * Score context alignment
 * Measures how many context hints are reflected in the output
 */
function scoreContext(text: string, hints?: string[]): number {
  if (!hints || hints.length === 0) return 0.5; // Neutral when no hints

  const textLower = text.toLowerCase();
  const matchedHints = hints.filter(hint =>
    textLower.includes(hint.toLowerCase())
  );

  return matchedHints.length / hints.length;
}

/**
 * Score source reputation
 * Average reputation of all cited sources
 */
function scoreSource(citations: Citation[]): number {
  if (citations.length === 0) return 0.3; // Low score when no sources

  const reputations = citations.map(c =>
    sourceReputation((c as any).source)
  );

  const average = reputations.reduce((a, b) => a + b, 0) / reputations.length;
  return Math.max(0, Math.min(1, average));
}

/**
 * Score query relevance
 * Measures term overlap between query and output
 */
function scoreRelevance(query: string, text: string): number {
  if (!query || !text) return 0;

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Extract unique terms from query
  const queryTerms = Array.from(
    new Set(queryLower.split(/\s+/).filter(Boolean))
  );

  // Count how many query terms appear in output
  const matchedTerms = queryTerms.filter(term =>
    textLower.includes(term)
  );

  // Require at least 3 terms for fair scoring
  const denominator = Math.max(3, queryTerms.length);
  return matchedTerms.length / denominator;
}

/**
 * Calculate comprehensive validation score
 *
 * @param input - Validation input with text, query, citations, and hints
 * @returns ValidationScore with final score and 4 subscores
 *
 * @example
 * ```typescript
 * const score = scoreValidation({
 *   text: "Memory timeline uses React hooks...",
 *   query: "How does memory timeline work?",
 *   citations: [{ docId: "1", score: 0.9 }],
 *   contextHints: ["React", "hooks"]
 * });
 *
 * console.log(score.final); // 0.78
 * console.log(score.subscores.citation); // 0.16
 * ```
 */
export function scoreValidation(input: ValidationInput): ValidationScore {
  const citation = scoreCitation(input.citations);
  const context = scoreContext(input.text, input.contextHints);
  const source = scoreSource(input.citations);
  const relevance = scoreRelevance(input.query, input.text);

  // Weighted combination
  const final =
    WEIGHTS.citation * citation +
    WEIGHTS.context * context +
    WEIGHTS.source * source +
    WEIGHTS.relevance * relevance;

  return {
    final: Number(final.toFixed(3)),
    subscores: {
      citation: Number(citation.toFixed(3)),
      context: Number(context.toFixed(3)),
      source: Number(source.toFixed(3)),
      relevance: Number(relevance.toFixed(3))
    }
  };
}

/**
 * Check if validation score passes threshold
 * Default threshold: 0.55 (55%)
 */
export function isValidationPassing(
  score: ValidationScore,
  threshold = 0.55
): boolean {
  return score.final >= threshold;
}

/**
 * Get human-readable validation feedback
 */
export function getValidationFeedback(score: ValidationScore): string {
  const issues: string[] = [];

  if (score.subscores.citation < 0.4) {
    issues.push("insufficient citations");
  }
  if (score.subscores.context < 0.4) {
    issues.push("poor context alignment");
  }
  if (score.subscores.source < 0.4) {
    issues.push("low source quality");
  }
  if (score.subscores.relevance < 0.4) {
    issues.push("weak relevance to query");
  }

  if (issues.length === 0) {
    return "Validation passed with good quality";
  }

  return `Validation concerns: ${issues.join(", ")}`;
}
