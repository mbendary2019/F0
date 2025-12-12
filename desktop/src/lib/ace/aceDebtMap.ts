// desktop/src/lib/ace/aceDebtMap.ts
// Phase 128.1: Technical Debt Map (Per-File Score)

import type { AceFileScore } from './aceTypes';
import type { FileIssuesSummary } from '../../state/projectIssuesContext';

/**
 * Input for building the debt map
 */
export type BuildDebtMapInput = {
  /** Issue summaries from ProjectIssuesContext */
  issueSummaries: FileIssuesSummary[];
  /** Project root path for calculating relative paths */
  projectRoot?: string;
};

/**
 * Build file-level technical debt scores from issue summaries
 * Returns scores sorted by worst (lowest health) first
 */
export function buildAceFileScores(input: BuildDebtMapInput): AceFileScore[] {
  const { issueSummaries, projectRoot = '' } = input;
  const scores: AceFileScore[] = [];

  for (const summary of issueSummaries) {
    // Skip files with no issues
    if (summary.issueCount === 0) continue;

    const totalIssues = summary.issueCount;
    const errors = summary.errors;
    const warnings = summary.warnings;

    // Extract category weights from issues
    const categoryWeights = {
      logging: 0,
      types: 0,
      style: 0,
      deadCode: 0,
      security: 0,
      performance: 0,
      other: 0,
    };

    // Count issues by category
    for (const issue of summary.issues) {
      const cat = (issue.category || 'other').toLowerCase();
      if (cat.includes('log') || cat.includes('console')) {
        categoryWeights.logging++;
      } else if (cat.includes('type') || cat.includes('typescript') || cat === 'best-practice') {
        categoryWeights.types++;
      } else if (cat.includes('style') || cat.includes('format')) {
        categoryWeights.style++;
      } else if (cat.includes('dead') || cat.includes('unused')) {
        categoryWeights.deadCode++;
      } else if (cat.includes('security') || cat.includes('vuln')) {
        categoryWeights.security++;
      } else if (cat.includes('perf') || cat.includes('optim')) {
        categoryWeights.performance++;
      } else {
        categoryWeights.other++;
      }
    }

    // Estimate file size (using issue count as proxy if actual size unknown)
    // In a real scenario, we'd get this from the index
    const sizeLines = summary.issueCount * 50; // rough estimate

    // Calculate raw debt score
    // Higher values = more debt
    const rawDebt =
      totalIssues * 1.0 +
      errors * 3.0 +
      categoryWeights.security * 5.0 +
      categoryWeights.performance * 2.0 +
      categoryWeights.types * 1.5 +
      sizeLines * 0.005;

    // Convert to health score (0-100, higher is better)
    const healthScore = Math.max(0, Math.min(100, Math.round(100 - rawDebt / 3)));

    // Determine risk level
    let riskLevel: AceFileScore['riskLevel'] = 'low';
    if (healthScore < 40) riskLevel = 'high';
    else if (healthScore < 70) riskLevel = 'medium';

    // Calculate complexity (simple heuristic)
    const complexity = totalIssues + errors * 2 + warnings * 0.5 + sizeLines * 0.01;

    // Calculate relative path
    const relativePath = projectRoot && summary.filePath.startsWith(projectRoot)
      ? summary.filePath.slice(projectRoot.length + 1)
      : summary.relativePath || summary.filePath;

    scores.push({
      filePath: summary.filePath,
      relativePath,
      healthIssues: totalIssues,
      healthScore,
      sizeLines,
      complexity: Math.round(complexity * 10) / 10,
      categoryWeights,
      riskLevel,
    });
  }

  // Sort by health score (lowest/worst first)
  return scores.sort((a, b) => a.healthScore - b.healthScore);
}

/**
 * Calculate overall project debt score from file scores
 */
export function calculateOverallDebtScore(fileScores: AceFileScore[]): number {
  if (fileScores.length === 0) return 100;

  // Weighted average: high-risk files count more
  let totalWeight = 0;
  let weightedSum = 0;

  for (const score of fileScores) {
    const weight = score.riskLevel === 'high' ? 3 : score.riskLevel === 'medium' ? 2 : 1;
    totalWeight += weight;
    weightedSum += score.healthScore * weight;
  }

  return Math.round(weightedSum / totalWeight);
}

/**
 * Get top N worst files
 */
export function getWorstFiles(fileScores: AceFileScore[], n: number = 10): AceFileScore[] {
  return fileScores.slice(0, n);
}

/**
 * Get files by risk level
 */
export function getFilesByRisk(
  fileScores: AceFileScore[],
  riskLevel: 'low' | 'medium' | 'high'
): AceFileScore[] {
  return fileScores.filter((f) => f.riskLevel === riskLevel);
}

/**
 * Get files with security issues
 */
export function getFilesWithSecurityIssues(fileScores: AceFileScore[]): AceFileScore[] {
  return fileScores.filter((f) => f.categoryWeights.security > 0);
}

export default {
  buildAceFileScores,
  calculateOverallDebtScore,
  getWorstFiles,
  getFilesByRisk,
  getFilesWithSecurityIssues,
};
