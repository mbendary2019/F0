// desktop/src/lib/testing/itg/riskScorer.ts
// Phase 139.1: Risk Scoring Engine v1
// Phase 139.7: Bootstrap Mode - works even without coverage/health snapshots
// Scores files by risk factors to prioritize test generation

import {
  ITGFileRisk,
  ITGRiskLevel,
} from './itgTypes';

import {
  ITG_RISK_WEIGHTS,
  ITG_DEFAULT_MAX_FILES,
  // Phase 139.7.1: Removed ITG_ANALYZABLE_PATTERNS and ITG_EXCLUDE_PATTERNS
  // Now using simplified local constants for direct path matching
} from './itgConstants';

/**
 * Phase 139.7: Bootstrap Mode options & result
 */
export interface RiskScorerOptions {
  maxFiles?: number;
  /** Enable bootstrap mode to work without coverage/health snapshots */
  bootstrapMode?: boolean;
}

export interface RiskScorerResult {
  risks: ITGFileRisk[];
  notes: string[];
}

/**
 * NOTE:
 * ProjectIndexSnapshot / CodeHealthSnapshot / ProjectCoverageSnapshot
 * have types elsewhere in the project.
 * Using `any` here to avoid breaking build if names differ.
 */
type AnyProjectIndexSnapshot = any;
type AnyCodeHealthSnapshot = any;
type AnyCoverageSnapshot = any;

type IssueStat = {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

type ScoreContext = {
  coverageByPath: Map<string, number>;
  issuesByPath: Map<string, IssueStat>;
  now: number;
};

const RECENT_DAYS = 30;
const LARGE_FILE_SIZE_BYTES = 40_000; // ~1000–1500 lines depending on encoding

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// Phase 139.7.1: Simplified file filtering - direct and reliable
const ITG_ANALYZABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const ITG_EXCLUDED_SEGMENTS = [
  'node_modules/',
  'node_modules\\',
  '.next/',
  '.next\\',
  'dist/',
  'dist\\',
  'build/',
  'build\\',
  'coverage/',
  'coverage\\',
  '.git/',
  '.git\\',
];

function isTestLikePath(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.includes('.test.') ||
    lower.includes('.spec.') ||
    lower.includes('__tests__/') ||
    lower.includes('__tests__\\') ||
    lower.includes('/__mocks__/') ||
    lower.includes('\\__mocks__\\')
  );
}

// Phase 139.7.1: Exported for use in testGeneratorEngine.ts
export function isAnalyzableFilePath(path: string): boolean {
  if (!path) return false;

  const lower = path.toLowerCase();

  // 1. Check excluded directories
  if (ITG_EXCLUDED_SEGMENTS.some((seg) => lower.includes(seg))) {
    return false;
  }

  // 2. Skip test files
  if (isTestLikePath(lower)) {
    return false;
  }

  // 3. Check valid extensions
  return ITG_ANALYZABLE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function buildCoverageIndex(snapshot: AnyCoverageSnapshot | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  if (!snapshot) return map;

  const files =
    (Array.isArray(snapshot.files) && snapshot.files) ||
    (Array.isArray(snapshot.fileCoverages) && snapshot.fileCoverages) ||
    [];

  for (const f of files) {
    if (!f) continue;
    const path = f.path || f.filePath;
    if (!path || typeof path !== 'string') continue;

    const percent =
      typeof f.percent === 'number'
        ? f.percent
        : typeof f.coverage === 'number'
          ? f.coverage
          : 0;

    // Normalize to 0-100
    const normalized = Math.max(0, Math.min(100, percent));
    map.set(path, normalized);
  }

  return map;
}

function buildIssuesIndex(health: AnyCodeHealthSnapshot | null | undefined): Map<string, IssueStat> {
  const map = new Map<string, IssueStat>();
  if (!health) return map;

  const issues = Array.isArray(health.issues) ? health.issues : [];

  for (const issue of issues) {
    if (!issue) continue;
    const path = issue.filePath || issue.path;
    if (!path || typeof path !== 'string') continue;

    const sev: string = issue.severity || 'medium';

    const current =
      map.get(path) || {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      };

    current.total += 1;

    switch (sev) {
      case 'critical':
      case 'blocker':
        current.critical += 1;
        break;
      case 'high':
      case 'major':
        current.high += 1;
        break;
      case 'low':
      case 'minor':
        current.low += 1;
        break;
      default:
        current.medium += 1;
    }

    map.set(path, current);
  }

  return map;
}

function computeCoverageScore(path: string, ctx: ScoreContext): { score: number; reason?: string } {
  const coverage = ctx.coverageByPath.get(path);
  if (coverage == null) {
    // Higher risk because file has no coverage data at all
    return {
      score: 1,
      reason: 'No test coverage data',
    };
  }

  const missing = 100 - coverage; // Higher missing = higher risk
  const score = clamp01(missing / 100);

  let reason: string | undefined;
  if (coverage < 60) {
    reason = `Low coverage (${coverage.toFixed(1)}%)`;
  } else if (coverage < 80) {
    reason = `Medium coverage (${coverage.toFixed(1)}%)`;
  }

  return { score, reason };
}

function computeIssueScore(path: string, ctx: ScoreContext): { score: number; reason?: string } {
  const stat = ctx.issuesByPath.get(path);
  if (!stat) {
    return { score: 0 };
  }

  const weighted =
    stat.critical * 3 +
    stat.high * 2 +
    stat.medium * 1 +
    stat.low * 0.5;

  // 10 = roughly 3 critical + some medium → 100%
  const score = clamp01(weighted / 10);

  const reason = `Issues: C:${stat.critical}, H:${stat.high}, M:${stat.medium}, L:${stat.low}`;

  return { score, reason };
}

function computeRecencyScore(file: any, ctx: ScoreContext): { score: number; reason?: string } {
  const ts: number | undefined =
    file.lastModifiedMs ??
    file.mtimeMs ??
    (file.lastModified ? Date.parse(file.lastModified) : undefined);

  if (!ts || !Number.isFinite(ts)) {
    return { score: 0 };
  }

  const ageMs = ctx.now - ts;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  const score = clamp01((RECENT_DAYS - ageDays) / RECENT_DAYS);

  if (score <= 0) return { score: 0 };

  const reason =
    ageDays < 1
      ? 'Recently changed (< 1 day)'
      : `Recently changed (~${ageDays.toFixed(1)} days ago)`;

  return { score, reason };
}

function computeSizeScore(file: any): { score: number; reason?: string } {
  const size: number | undefined = file.sizeBytes ?? file.size ?? file.byteLength;

  if (!size || !Number.isFinite(size)) {
    return { score: 0 };
  }

  const score = clamp01(size / LARGE_FILE_SIZE_BYTES);

  if (score <= 0.3) return { score, reason: undefined };

  const kb = size / 1024;
  const reason = `Large/complex file (~${kb.toFixed(1)} KB)`;

  return { score, reason };
}

function riskScoreToLevel(score: number): ITGRiskLevel {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Phase 139.7: Path-based heuristic scoring
 * Used in Bootstrap Mode when coverage/health snapshots are missing
 */
function computePathHeuristicScore(path: string): { score: number; reason?: string } {
  const lowerPath = path.toLowerCase();
  let score = 0.3; // Base score for any analyzable file
  const reasons: string[] = [];

  // API routes are high priority - they need integration tests
  if (lowerPath.includes('/api/') || lowerPath.includes('/routes/') || lowerPath.endsWith('route.ts') || lowerPath.endsWith('route.tsx')) {
    score += 0.4;
    reasons.push('API route (needs integration tests)');
  }

  // Components are important
  if (lowerPath.includes('/components/') && !lowerPath.includes('.test.') && !lowerPath.includes('.spec.')) {
    score += 0.2;
    reasons.push('UI Component');
  }

  // Lib/utils are often shared - high impact
  if (lowerPath.includes('/lib/') || lowerPath.includes('/utils/') || lowerPath.includes('/helpers/')) {
    score += 0.25;
    reasons.push('Shared utility/lib');
  }

  // Services have business logic
  if (lowerPath.includes('/services/') || lowerPath.includes('/service/')) {
    score += 0.3;
    reasons.push('Service layer');
  }

  // Hooks often contain important logic
  if (lowerPath.includes('/hooks/') || lowerPath.startsWith('use') || lowerPath.includes('/use')) {
    score += 0.2;
    reasons.push('React Hook');
  }

  // State management is critical
  if (lowerPath.includes('/state/') || lowerPath.includes('/store/') || lowerPath.includes('/context/') || lowerPath.includes('Context.')) {
    score += 0.35;
    reasons.push('State management');
  }

  // Auth/Security files are critical
  if (lowerPath.includes('auth') || lowerPath.includes('security') || lowerPath.includes('permission')) {
    score += 0.4;
    reasons.push('Auth/Security critical');
  }

  // Payment/Billing files are critical
  if (lowerPath.includes('payment') || lowerPath.includes('billing') || lowerPath.includes('stripe') || lowerPath.includes('checkout')) {
    score += 0.45;
    reasons.push('Payment/Billing critical');
  }

  return {
    score: clamp01(score),
    reason: reasons.length > 0 ? reasons.join(', ') : undefined,
  };
}

/**
 * Phase 139.7: Bootstrap Mode weights
 * When coverage/health are missing, we adjust weights to rely more on
 * file size, path heuristics, and recency
 */
const BOOTSTRAP_WEIGHTS = {
  pathHeuristic: 0.45,
  fileSize: 0.25,
  recentChanges: 0.3,
};

/**
 * Core function:
 * Combines Project Index + Code Health + Coverage
 * and returns ITGFileRisk[] sorted from highest to lowest risk.
 *
 * Phase 139.7: Bootstrap Mode - when coverage/health snapshots are missing,
 * the engine now uses path-based heuristics instead of returning 0 risks.
 */
export function scoreFileRisks(
  index: AnyProjectIndexSnapshot | null | undefined,
  health: AnyCodeHealthSnapshot | null | undefined,
  coverage: AnyCoverageSnapshot | null | undefined,
  options?: RiskScorerOptions
): ITGFileRisk[] {
  const result = scoreFileRisksWithNotes(index, health, coverage, options);
  return result.risks;
}

/**
 * Phase 139.7: Extended version that returns both risks and debug notes
 */
export function scoreFileRisksWithNotes(
  index: AnyProjectIndexSnapshot | null | undefined,
  health: AnyCodeHealthSnapshot | null | undefined,
  coverage: AnyCoverageSnapshot | null | undefined,
  options?: RiskScorerOptions
): RiskScorerResult {
  const notes: string[] = [];

  if (!index) {
    return { risks: [], notes: ['No project index provided'] };
  }

  const maxFiles = options?.maxFiles ?? ITG_DEFAULT_MAX_FILES;

  // index.files or index.indexedFiles or direct array
  const files: any[] =
    (Array.isArray((index as any).files) && (index as any).files) ||
    (Array.isArray((index as any).indexedFiles) && (index as any).indexedFiles) ||
    (Array.isArray(index) && (index as any)) ||
    [];

  const ctx: ScoreContext = {
    coverageByPath: buildCoverageIndex(coverage),
    issuesByPath: buildIssuesIndex(health),
    now: Date.now(),
  };

  // Phase 139.7: Detect Bootstrap Mode
  const hasCoverage = ctx.coverageByPath.size > 0;
  const hasHealth = ctx.issuesByPath.size > 0;
  const isBootstrapMode = !hasCoverage && !hasHealth;

  if (!hasCoverage) {
    notes.push('No coverage snapshot, using path heuristics');
  }
  if (!hasHealth) {
    notes.push('No code health snapshot, using basic risk scoring');
  }
  if (isBootstrapMode) {
    notes.push('Bootstrap Mode: scoring based on file size, path patterns, and recency');
  }

  const results: (ITGFileRisk & { _score: number })[] = [];

  for (const file of files) {
    if (!file) continue;
    // Phase 139.7.1: Also accept relativePath from IndexedFile (desktop indexer format)
    const path: string = file.path || file.filePath || file.relativePath;
    if (!path || typeof path !== 'string') continue;

    if (!isAnalyzableFilePath(path)) continue;

    let totalScore01 = 0;
    const reasons: string[] = [];

    if (isBootstrapMode) {
      // Phase 139.7: Bootstrap Mode - use path heuristics + size + recency
      const pathResult = computePathHeuristicScore(path);
      const sizeResult = computeSizeScore(file);
      const recencyResult = computeRecencyScore(file, ctx);

      totalScore01 =
        pathResult.score * BOOTSTRAP_WEIGHTS.pathHeuristic +
        sizeResult.score * BOOTSTRAP_WEIGHTS.fileSize +
        recencyResult.score * BOOTSTRAP_WEIGHTS.recentChanges;

      if (pathResult.reason) reasons.push(pathResult.reason);
      if (sizeResult.reason) reasons.push(sizeResult.reason);
      if (recencyResult.reason) reasons.push(recencyResult.reason);
    } else {
      // Normal mode - use all factors with original weights
      const coverageResult = computeCoverageScore(path, ctx);
      const issueResult = computeIssueScore(path, ctx);
      const recencyResult = computeRecencyScore(file, ctx);
      const sizeResult = computeSizeScore(file);

      // Calculate coverage weight - if no coverage data, use path heuristic instead
      let coverageContrib = 0;
      if (hasCoverage) {
        coverageContrib = coverageResult.score * ITG_RISK_WEIGHTS.lowCoverage;
        if (coverageResult.reason) reasons.push(coverageResult.reason);
      } else {
        const pathResult = computePathHeuristicScore(path);
        coverageContrib = pathResult.score * ITG_RISK_WEIGHTS.lowCoverage * 0.6;
        if (pathResult.reason) reasons.push(pathResult.reason);
      }

      // Calculate issue weight - if no health data, add modest heuristic boost
      let issueContrib = 0;
      if (hasHealth) {
        issueContrib = issueResult.score * ITG_RISK_WEIGHTS.highIssueCount;
        if (issueResult.reason) reasons.push(issueResult.reason);
      }

      totalScore01 =
        coverageContrib +
        issueContrib +
        recencyResult.score * ITG_RISK_WEIGHTS.recentChanges +
        sizeResult.score * ITG_RISK_WEIGHTS.fileSize;

      if (recencyResult.reason) reasons.push(recencyResult.reason);
      if (sizeResult.reason) reasons.push(sizeResult.reason);
    }

    const totalScore = clamp01(totalScore01) * 100;
    const riskLevel = riskScoreToLevel(totalScore);

    results.push({
      path,
      riskLevel,
      estimatedImpactScore: Math.round(totalScore),
      reasons,
      _score: totalScore,
    });
  }

  // Sort by score desc and take top N
  results.sort((a, b) => b._score - a._score);

  const risks = results.slice(0, maxFiles).map(({ _score, ...rest }) => rest);

  if (results.length > 0) {
    notes.push(`Scored ${results.length} analyzable files, returning top ${risks.length}`);
  }

  return { risks, notes };
}

/**
 * Simple helper to get only high risk files.
 */
export function getHighRiskFilesOnly(
  risks: ITGFileRisk[],
  minScore: number = 60
): ITGFileRisk[] {
  return risks.filter((r) => {
    if (r.riskLevel === 'high') return true;
    return (r.estimatedImpactScore ?? 0) >= minScore;
  });
}
