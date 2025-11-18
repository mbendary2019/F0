/**
 * Validator Agent (Phase 61 Day 3 - Plugin-Based Scoring with Active Learning)
 *
 * Validates outputs from other agents using pluggable ML-based scoring:
 * - Extracts features using enhanced feature extractor
 * - Uses pluggable scorer models (hot-swappable)
 * - Blends ML model weights with plugin scoring
 * - Tracks confidence and identifies uncertain samples
 * - Falls back to rule-based scoring if model/plugin unavailable
 * - Logs validation events for continuous learning
 *
 * Returns CRITIQUE if validation score is too low,
 * or FINAL if quality is acceptable.
 */

import { BaseAgent } from "../baseAgent";
import type { AgentMessage } from "@/lib/types/agent";
import type { ContextHandle } from "@/lib/types/context";
import { scoreValidation, getValidationFeedback } from "@/orchestrator/rag/scoring";
import { loadLatestModel, scoreWithWeights, getThreshold } from "@/orchestrator/rag/scorerModel";
import { sourceReputation } from "@/orchestrator/rag/sourceReputation";
import { extractAllFeatures } from "@/orchestrator/rag/features/extractor";
import { getScorer } from "@/orchestrator/rag/scorerPlugins/registry";
import { isUncertain } from "@/orchestrator/rag/activeLabeling";
import { logEvent } from "@/lib/telemetry/log";
import type { RagValidate } from "@/lib/types/telemetry";

/**
 * Fallback threshold when model is unavailable
 */
const FALLBACK_THRESHOLD = 0.55;

export class ValidatorAgent extends BaseAgent {
  constructor(id = "validator") {
    super(id, "critic");
  }

  async handle(input: AgentMessage, ctx: ContextHandle): Promise<AgentMessage> {
    const text = input.content || "";
    const citations = (input.evidence || []) as any[];
    const strategy = (ctx as any).strategy || "default";

    // Load dynamic model (with fallback to rule-based)
    let model;
    let usingModel = true;

    try {
      model = await loadLatestModel();
      console.log(`[validator] Using model ${model.version} for strategy '${strategy}'`);
    } catch (err) {
      console.warn("[validator] Failed to load model, using rule-based fallback:", err);
      usingModel = false;
    }

    // Extract all features (base + advanced)
    const allFeatures = extractAllFeatures({
      text,
      goal: ctx.goal,
      hints: ctx.hints || [],
      citations: citations.map((c) => ({
        ...c,
        source: (c as any).source,
      })),
    });

    // Calculate subscores for backward compatibility and telemetry
    const subscores = {
      citation: allFeatures.citation_count,
      context: allFeatures.hint_hit_rate,
      source: (() => {
        // Calculate source reputation from actual evidence
        if (!citations.length) return 0.3;
        const reputations = citations.map((c) =>
          sourceReputation((c as any).source || "fallback")
        );
        return (
          reputations.reduce((a, b) => a + b, 0) / reputations.length
        );
      })(),
      relevance: allFeatures.uniq_terms_overlap,
    };

    // Get current scorer plugin
    const scorer = getScorer();

    // Calculate final score using blended approach
    let finalScore: number;
    let confidence: number = 1.0;
    let threshold: number;
    let modelVersion = "fallback";

    if (usingModel && model) {
      // Blend ML model score with plugin score
      const mlScore = scoreWithWeights(subscores, model.weights);
      const pluginResult = scorer.getConfidence?.(allFeatures) || {
        score: scorer.score(allFeatures),
        confidence: 1.0,
        lower: 0,
        upper: 1,
      };

      // Weighted blend: 60% ML model, 40% plugin
      finalScore = 0.6 * mlScore + 0.4 * pluginResult.score;
      confidence = pluginResult.confidence;
      threshold = getThreshold(model.thresholds, strategy);
      modelVersion = `${model.version}+${scorer.name}`;
    } else {
      // Fallback to plugin-only scoring
      const pluginResult = scorer.getConfidence?.(allFeatures) || {
        score: scorer.score(allFeatures),
        confidence: 1.0,
        lower: 0,
        upper: 1,
      };
      finalScore = pluginResult.score;
      confidence = pluginResult.confidence;
      threshold = FALLBACK_THRESHOLD;
      modelVersion = `fallback+${scorer.name}`;
    }

    // Check if sample is uncertain (for active labeling)
    const uncertain = isUncertain(finalScore, confidence);
    if (uncertain) {
      console.log(
        `[validator] ⚠️  UNCERTAIN sample detected (score=${finalScore.toFixed(2)}, confidence=${confidence.toFixed(2)})`
      );
      // Note: Could automatically save to ops_validate_samples for review
    }

    // Log telemetry event with model version and strategy
    await logEvent({
      type: "rag.validate",
      ts: Date.now(),
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      score: Number(finalScore.toFixed(3)),
      subscores: {
        citation: Number(subscores.citation.toFixed(3)),
        context: Number(subscores.context.toFixed(3)),
        source: Number(subscores.source.toFixed(3)),
        relevance: Number(subscores.relevance.toFixed(3)),
      },
      model_version: modelVersion,
      strategy: strategy,
    } as RagValidate);

    console.log(
      `[validator] Model: ${modelVersion} | Score: ${finalScore.toFixed(2)} | Threshold: ${threshold.toFixed(2)} | Strategy: ${strategy}`
    );
    console.log(`[validator] Subscores:`, subscores);

    // Check if validation passes
    const passed = finalScore >= threshold;

    if (!passed) {
      // Validation failed - send critique
      const feedback = getValidationFeedback({
        final: finalScore,
        subscores,
      });

      const critiqueMsgText = [
        `Validation failed (score=${finalScore.toFixed(2)}, threshold=${threshold.toFixed(2)}, model=${modelVersion})`,
        feedback,
        "Please strengthen citations and improve alignment with the goal.",
      ].join(". ");

      console.log(`[validator] CRITIQUE: ${critiqueMsgText}`);

      return {
        type: "CRITIQUE",
        content: critiqueMsgText,
        from: this.id,
        to: ["researcher"],
      };
    }

    // Validation passed
    console.log(
      `[validator] APPROVED: Validation passed with score ${finalScore.toFixed(2)} (model=${modelVersion})`
    );

    return {
      type: "FINAL",
      content: input.content,
      evidence: input.evidence,
      from: this.id,
    };
  }
}
