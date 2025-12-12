/**
 * Feature Extractor for Advanced ML Models
 *
 * Extracts rich features from validation inputs that can be used by
 * advanced scoring models (linear, XGBoost, neural networks, etc.)
 *
 * Features include:
 * - Citation metrics (count, average score)
 * - Text characteristics (length normalized)
 * - Context alignment (hint matching)
 * - Query relevance (term overlap)
 */

import type { Citation } from "@/lib/types/context";

/**
 * Base feature set for validation scoring
 */
export type BaseFeatures = {
  citation_count: number;        // Number of citations (0-1 normalized)
  citation_avg_score: number;    // Average citation score (0-1)
  text_len: number;              // Text length normalized (0-1)
  hint_hit_rate: number;         // Ratio of matched hints (0-1)
  uniq_terms_overlap: number;    // Query-text term overlap (0-1)
};

/**
 * Extract base features from validation inputs
 *
 * @param opts - Extraction options
 * @returns Normalized feature vector (all values 0-1)
 *
 * @example
 * ```typescript
 * const features = extractBaseFeatures({
 *   text: "Memory timeline uses React hooks for state management",
 *   goal: "How does memory timeline work?",
 *   hints: ["React", "hooks"],
 *   citations: [
 *     { docId: "1", score: 0.9 },
 *     { docId: "2", score: 0.8 }
 *   ]
 * });
 *
 * // Result:
 * {
 *   citation_count: 0.33,      // 2/6 citations
 *   citation_avg_score: 0.85,  // (0.9 + 0.8) / 2
 *   text_len: 0.012,           // ~50 chars / 4000
 *   hint_hit_rate: 1.0,        // 2/2 hints matched
 *   uniq_terms_overlap: 0.67   // 4/6 terms matched
 * }
 * ```
 */
export function extractBaseFeatures(opts: {
  text: string;
  goal: string;
  hints?: string[];
  citations?: (Citation & { source?: string })[];
}): BaseFeatures {
  const text = (opts.text || "").toLowerCase();
  const goal = (opts.goal || "").toLowerCase();
  const hints = opts.hints || [];
  const cites = (opts.citations || []) as any[];

  // Citation count (normalized to 0-1, max at 6 citations)
  const citation_count = Math.min(1, cites.length / 6);

  // Average citation score (already 0-1)
  const citation_avg_score = cites.length
    ? cites.reduce((sum, c) => sum + (c.score || 0), 0) / cites.length
    : 0;

  // Text length (normalized to 0-1, max at 4000 chars)
  const text_len = Math.min(1, text.length / 4000);

  // Hint hit rate (ratio of matched hints)
  const matchedHints = hints.filter((h) =>
    text.includes((h || "").toLowerCase())
  );
  const hint_hit_rate = hints.length
    ? matchedHints.length / hints.length
    : 0.5; // Neutral when no hints

  // Unique terms overlap (query-text similarity)
  const goalTerms = Array.from(
    new Set(goal.split(/\s+/).filter(Boolean))
  );
  const matchedTerms = goalTerms.filter((term) => text.includes(term));
  const uniq_terms_overlap = goalTerms.length
    ? matchedTerms.length / Math.max(3, goalTerms.length)
    : 0;

  return {
    citation_count: Number(citation_count.toFixed(3)),
    citation_avg_score: Number(citation_avg_score.toFixed(3)),
    text_len: Number(text_len.toFixed(3)),
    hint_hit_rate: Number(hint_hit_rate.toFixed(3)),
    uniq_terms_overlap: Number(uniq_terms_overlap.toFixed(3)),
  };
}

/**
 * Extract advanced features (for future ML models)
 */
export type AdvancedFeatures = BaseFeatures & {
  vocabulary_richness: number;   // Unique words / total words
  sentence_count: number;         // Number of sentences (normalized)
  avg_sentence_length: number;    // Average sentence length (normalized)
  citation_variance: number;      // Variance in citation scores
  context_depth: number;          // How deep the context analysis goes
};

/**
 * Extract advanced features for more sophisticated models
 */
export function extractAdvancedFeatures(opts: {
  text: string;
  goal: string;
  hints?: string[];
  citations?: (Citation & { source?: string })[];
}): AdvancedFeatures {
  const base = extractBaseFeatures(opts);
  const text = opts.text || "";

  // Vocabulary richness
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const uniqueWords = new Set(words);
  const vocabulary_richness = words.length
    ? uniqueWords.size / words.length
    : 0;

  // Sentence count (normalized)
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  const sentence_count = Math.min(1, sentences.length / 20);

  // Average sentence length (normalized)
  const avg_sentence_length = sentences.length
    ? Math.min(
        1,
        sentences.reduce((sum, s) => sum + s.length, 0) /
          sentences.length /
          100
      )
    : 0;

  // Citation score variance
  const cites = (opts.citations || []) as any[];
  if (cites.length > 1) {
    const scores = cites.map((c) => c.score || 0);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
      scores.length;
    var citation_variance = Math.min(1, variance * 10); // Normalize
  } else {
    var citation_variance = 0;
  }

  // Context depth (hints + citation count combined)
  const context_depth = Math.min(
    1,
    ((opts.hints?.length || 0) + cites.length) / 10
  );

  return {
    ...base,
    vocabulary_richness: Number(vocabulary_richness.toFixed(3)),
    sentence_count: Number(sentence_count.toFixed(3)),
    avg_sentence_length: Number(avg_sentence_length.toFixed(3)),
    citation_variance: Number(citation_variance.toFixed(3)),
    context_depth: Number(context_depth.toFixed(3)),
  };
}

/**
 * Get feature names for logging/debugging
 */
export function getFeatureNames(advanced = false): string[] {
  const base = [
    "citation_count",
    "citation_avg_score",
    "text_len",
    "hint_hit_rate",
    "uniq_terms_overlap",
  ];

  if (advanced) {
    return [
      ...base,
      "vocabulary_richness",
      "sentence_count",
      "avg_sentence_length",
      "citation_variance",
      "context_depth",
    ];
  }

  return base;
}

// Alias for backward compatibility
export const extractAllFeatures = extractAdvancedFeatures;
