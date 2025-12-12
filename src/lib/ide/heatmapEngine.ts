/**
 * Phase 85.4.3: Code Impact Heatmap Engine
 * Analyzes each line of code to estimate impact and risk
 * Based on complexity, fan-in, fan-out, and cycles
 */

import { IdeProjectAnalysisDocument } from '@/types/ideBridge';

export interface LineImpact {
  line: number;
  impact: number; // 0 → 1 normalized
  risk: 'low' | 'medium' | 'high';
  reason?: string;
}

export interface FileHeatmapResult {
  filePath: string;
  lines: LineImpact[];
  averageImpact: number;
  maxImpact: number;
}

/**
 * Estimates the complexity of a single line of code
 * Uses heuristics based on keywords, structure, and length
 */
function estimateLineComplexity(line: string): number {
  let score = 0;

  // Function/class definitions (higher complexity)
  if (/function|=>|class|extends/.test(line)) score += 0.2;

  // Structural elements
  if (/{|}|\(|\)/.test(line)) score += 0.1;

  // Control flow (branches = complexity)
  if (/if|else|switch|case|try|catch/.test(line)) score += 0.3;

  // Loops and functional programming
  if (/for|while|map|filter|reduce/.test(line)) score += 0.3;

  // Length-based complexity (long lines are often complex)
  score += Math.min(line.length / 200, 0.3);

  return Math.min(score, 1); // clamp to [0, 1]
}

/**
 * Generates heatmap data for a single file
 * Combines line complexity with dependency metrics
 */
export function generateHeatmapForFile(
  filePath: string,
  content: string,
  analysis?: IdeProjectAnalysisDocument
): FileHeatmapResult {
  const lines = content.split('\n');

  // Get file-level metrics from analysis
  const fileData = analysis?.files?.find((f) => f.path === filePath);
  const fanIn = fileData?.fanIn ?? 0;
  const fanOut = fileData?.fanOut ?? 0;
  const isGod = fanOut >= 15;
  const isCore = fanIn >= 10;
  const inCycle =
    analysis?.summary?.cycles?.some((c) => c.includes(filePath)) ?? false;

  // Calculate line-by-line impact
  const lineImpacts: LineImpact[] = lines.map((line, index) => {
    const complexity = estimateLineComplexity(line);

    // Combined impact score:
    // - 50% from line complexity
    // - 30% from fan-in (how many depend on this file)
    // - 20% from fan-out (how many this file depends on)
    // - Bonus for cycles
    const combined =
      0.5 * complexity +
      0.3 * Math.min(fanIn / 20, 1) +
      0.2 * Math.min(fanOut / 20, 1) +
      (inCycle ? 0.1 : 0);

    const impact = Math.min(combined, 1);

    // Determine risk level based on impact
    const risk: 'low' | 'medium' | 'high' =
      impact >= 0.7 ? 'high' : impact >= 0.4 ? 'medium' : 'low';

    return {
      line: index + 1,
      impact,
      risk,
      reason: `${risk} impact (complexity: ${complexity.toFixed(
        2
      )}, fanIn: ${fanIn}, fanOut: ${fanOut})`,
    };
  });

  const maxImpact = Math.max(...lineImpacts.map((l) => l.impact), 0);
  const averageImpact =
    lineImpacts.length > 0
      ? lineImpacts.reduce((a, b) => a + b.impact, 0) / lineImpacts.length
      : 0;

  return { filePath, lines: lineImpacts, averageImpact, maxImpact };
}
