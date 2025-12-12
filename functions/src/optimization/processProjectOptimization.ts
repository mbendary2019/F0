// functions/src/optimization/processProjectOptimization.ts
// Phase 138.1: Firestore trigger to process optimization runs
// Triggers on document creation in projects/{projectId}/optimizationRuns/{runId}

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { OptimizationRun, OptimizationMetrics, OptimizationSignals, OptimizationScores, AceTriggerMeta, AceTriggerLevel } from './types';

const db = getFirestore();

/**
 * Firestore trigger that processes new optimization runs
 * Triggers when a new document is created in projects/{projectId}/optimizationRuns/{runId}
 */
export const processProjectOptimizationRun = onDocumentCreated(
  'projects/{projectId}/optimizationRuns/{runId}',
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.error('[Optimization] No snapshot data');
      return;
    }

    const run = snap.data() as OptimizationRun;
    const { projectId, runId } = event.params;
    const runRef = snap.ref;

    logger.info('[Optimization] Processing run', { projectId, runId, status: run.status });

    try {
      // 1) Set status = running
      await runRef.update({
        status: 'running',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 2) Get project data (graceful fallback if project doc doesn't exist)
      const projectRef = db.collection('projects').doc(projectId);
      const projectSnap = await projectRef.get();

      let projectName = 'Project';
      if (projectSnap.exists) {
        const projectData = projectSnap.data();
        projectName = projectData?.name || projectData?.slug || projectId;
      } else {
        // Project doc doesn't exist - this can happen in dev/emulator mode
        // Continue with default project name instead of failing
        logger.warn('[Optimization] Project document not found, using fallback name', { projectId });
        projectName = projectId;
      }

      // 3) Update status to collecting_signals
      await runRef.update({
        status: 'collecting_signals',
        updatedAt: new Date().toISOString(),
      });

      // 4) Collect metrics
      const metrics = await collectMetrics(projectId);

      logger.info('[Optimization] Collected metrics', { projectId, metrics });

      // 5) Phase 138.3: Collect detailed signals
      const signals = await collectOptimizationSignals(projectId);

      logger.info('[Optimization] Collected signals', { projectId, signals });

      // 6) Phase 138.3.2: Compute scores from signals
      const scores = computeOptimizationScores(signals);

      logger.info('[Optimization] Computed scores', { projectId, scores });

      // 7) Phase 138.5.0: Compute ACE trigger metadata
      const ace = computeAceTriggerMeta(scores, signals);

      logger.info('[Optimization] Computed ACE trigger', { projectId, ace });

      // 8) Generate summary and recommendations
      const { summary, recommendations } = generateRecommendations(projectName, metrics);

      // 9) Update run with completed status + results
      await runRef.update({
        status: 'completed',
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metrics,
        signals,
        scores,
        ace,
        summary,
        recommendations,
      });

      logger.info('[Optimization] Run completed', { projectId, runId, summary });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[Optimization] Run failed', { projectId, runId, error: errorMessage });

      await runRef.update({
        status: 'failed',
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        errorMessage,
      });
    }
  }
);

/**
 * Collect metrics for a project
 */
async function collectMetrics(projectId: string): Promise<OptimizationMetrics> {
  const metrics: OptimizationMetrics = {};

  try {
    // Count deployments
    const deploymentsSnap = await db
      .collection('projects')
      .doc(projectId)
      .collection('deployments')
      .count()
      .get();
    metrics.deploymentsCount = deploymentsSnap.data().count;
  } catch (e) {
    logger.warn('[Optimization] Failed to count deployments', { projectId, error: e });
    metrics.deploymentsCount = 0;
  }

  try {
    // Count live sessions
    const sessionsSnap = await db
      .collection('projects')
      .doc(projectId)
      .collection('liveSessions')
      .count()
      .get();
    metrics.liveSessionsCount = sessionsSnap.data().count;
  } catch (e) {
    logger.warn('[Optimization] Failed to count live sessions', { projectId, error: e });
    metrics.liveSessionsCount = 0;
  }

  try {
    // Count agent tasks
    const tasksSnap = await db
      .collection('projects')
      .doc(projectId)
      .collection('agentTasks')
      .count()
      .get();
    metrics.agentTasksCount = tasksSnap.data().count;
  } catch (e) {
    logger.warn('[Optimization] Failed to count agent tasks', { projectId, error: e });
    metrics.agentTasksCount = 0;
  }

  try {
    // Count open issues (if exists)
    const issuesSnap = await db
      .collection('projects')
      .doc(projectId)
      .collection('issues')
      .where('status', '==', 'open')
      .count()
      .get();
    metrics.openIssuesCount = issuesSnap.data().count;
  } catch (e) {
    // Issues collection might not exist
    metrics.openIssuesCount = 0;
  }

  try {
    // Count files in VFS
    const filesSnap = await db
      .collection('projects')
      .doc(projectId)
      .collection('vfs')
      .count()
      .get();
    metrics.filesCount = filesSnap.data().count;
  } catch (e) {
    metrics.filesCount = 0;
  }

  return metrics;
}

/**
 * Generate summary and recommendations based on metrics
 * Phase 138.1 v1: Simple rule-based recommendations
 */
function generateRecommendations(
  projectName: string,
  metrics: OptimizationMetrics
): { summary: string; recommendations: string[] } {
  const recommendations: string[] = [];

  // Analyze deployments
  if (metrics.deploymentsCount === 0) {
    recommendations.push('🚀 لم يتم إجراء أي deployments بعد - ابدأ بنشر مشروعك');
  } else if (metrics.deploymentsCount && metrics.deploymentsCount > 10) {
    recommendations.push('✅ لديك تاريخ جيد من الـ deployments');
  }

  // Analyze live sessions
  if (metrics.liveSessionsCount === 0) {
    recommendations.push('💡 جرب استخدام Live Sessions للتطوير التفاعلي');
  } else if (metrics.liveSessionsCount && metrics.liveSessionsCount > 5) {
    recommendations.push('✅ استخدام جيد لـ Live Sessions');
  }

  // Analyze agent tasks
  if (metrics.agentTasksCount === 0) {
    recommendations.push('🤖 استفد من Agent Tasks لأتمتة المهام');
  }

  // Analyze issues
  if (metrics.openIssuesCount && metrics.openIssuesCount > 5) {
    recommendations.push(`⚠️ لديك ${metrics.openIssuesCount} مشاكل مفتوحة - راجعها`);
  } else if (metrics.openIssuesCount === 0) {
    recommendations.push('✅ لا توجد مشاكل مفتوحة');
  }

  // Analyze files
  if (metrics.filesCount === 0) {
    recommendations.push('📁 ابدأ بإضافة ملفات لمشروعك');
  } else if (metrics.filesCount && metrics.filesCount > 100) {
    recommendations.push(`📊 مشروع كبير (${metrics.filesCount} ملف) - راجع البنية`);
  }

  // If no specific recommendations, add a default one
  if (recommendations.length === 0) {
    recommendations.push('✅ مشروعك في حالة جيدة!');
  }

  // Generate summary
  const totalActivity =
    (metrics.deploymentsCount || 0) +
    (metrics.liveSessionsCount || 0) +
    (metrics.agentTasksCount || 0);

  let healthStatus = 'جيدة';
  if (totalActivity === 0) {
    healthStatus = 'تحتاج نشاط';
  } else if (totalActivity > 20) {
    healthStatus = 'ممتازة';
  }

  const summary = `مشروع "${projectName}": الحالة ${healthStatus} | ${metrics.filesCount || 0} ملفات | ${metrics.deploymentsCount || 0} deployments`;

  return { summary, recommendations };
}

/**
 * Phase 138.3: Collect detailed signals from project subcollections
 * Fetches data from testRuns, coverageReports, securityStats, and codeHealthSnapshots
 */
async function collectOptimizationSignals(projectId: string): Promise<OptimizationSignals> {
  const projectRef = db.collection('projects').doc(projectId);

  // 1) Tests - get latest test run
  let tests: OptimizationSignals['tests'] = {
    total: 0,
    passed: 0,
    failed: 0,
    flaky: 0,
    lastRunAt: null,
  };

  try {
    const testsSnap = await projectRef
      .collection('testRuns')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!testsSnap.empty) {
      const testDoc = testsSnap.docs[0];
      tests = {
        total: testDoc.get('stats.total') ?? testDoc.get('total') ?? 0,
        passed: testDoc.get('stats.passed') ?? testDoc.get('passed') ?? 0,
        failed: testDoc.get('stats.failed') ?? testDoc.get('failed') ?? 0,
        flaky: testDoc.get('stats.flaky') ?? testDoc.get('flaky') ?? 0,
        lastRunAt: testDoc.get('createdAt') ?? null,
      };
    }
  } catch (e) {
    logger.warn('[Optimization] Failed to fetch test runs', { projectId, error: e });
  }

  // 2) Coverage - get latest coverage report
  let coverage: OptimizationSignals['coverage'] = {
    line: 0,
    branch: 0,
    filesMeasured: 0,
    lastReportAt: null,
  };

  try {
    const covSnap = await projectRef
      .collection('coverageReports')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!covSnap.empty) {
      const covDoc = covSnap.docs[0];
      coverage = {
        line: covDoc.get('line') ?? covDoc.get('lineCoverage') ?? 0,
        branch: covDoc.get('branch') ?? covDoc.get('branchCoverage') ?? 0,
        filesMeasured: covDoc.get('filesMeasured') ?? covDoc.get('filesCount') ?? 0,
        lastReportAt: covDoc.get('createdAt') ?? null,
      };
    }
  } catch (e) {
    logger.warn('[Optimization] Failed to fetch coverage reports', { projectId, error: e });
  }

  // 3) Security - get latest security stats
  let security: OptimizationSignals['security'] = {
    totalAlerts: 0,
    blockingAlerts: 0,
    highSeverity: 0,
    lastScanAt: null,
  };

  try {
    const secSnap = await projectRef
      .collection('securityStats')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!secSnap.empty) {
      const secDoc = secSnap.docs[0];
      security = {
        totalAlerts: secDoc.get('totalAlerts') ?? secDoc.get('total') ?? 0,
        blockingAlerts: secDoc.get('blocking') ?? secDoc.get('blockingAlerts') ?? 0,
        highSeverity: secDoc.get('highSeverity') ?? secDoc.get('high') ?? 0,
        lastScanAt: secDoc.get('createdAt') ?? null,
      };
    }
  } catch (e) {
    logger.warn('[Optimization] Failed to fetch security stats', { projectId, error: e });
  }

  // 4) Issues / Code Health - get latest snapshot
  let issues: OptimizationSignals['issues'] = {
    totalIssues: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  try {
    const healthSnap = await projectRef
      .collection('codeHealthSnapshots')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!healthSnap.empty) {
      const healthDoc = healthSnap.docs[0];
      issues = {
        totalIssues: healthDoc.get('issues.total') ?? healthDoc.get('totalIssues') ?? 0,
        critical: healthDoc.get('issues.critical') ?? healthDoc.get('critical') ?? 0,
        high: healthDoc.get('issues.high') ?? healthDoc.get('high') ?? 0,
        medium: healthDoc.get('issues.medium') ?? healthDoc.get('medium') ?? 0,
        low: healthDoc.get('issues.low') ?? healthDoc.get('low') ?? 0,
      };
    }
  } catch (e) {
    logger.warn('[Optimization] Failed to fetch code health snapshots', { projectId, error: e });
  }

  return { tests, coverage, security, issues };
}

/**
 * Helper function to clamp a score to 0-100 range
 */
const clampScore = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value)));

/**
 * Phase 138.3.2: Compute optimization scores from signals
 * Calculates reliability, security, coverage, maintainability, and overall scores
 * Also determines risk level based on overall score
 */
function computeOptimizationScores(signals: OptimizationSignals | null | undefined): OptimizationScores {
  // Default scores if no signals available
  if (!signals) {
    return {
      reliabilityScore: 50,
      securityScore: 50,
      coverageScore: 0,
      maintainabilityScore: 50,
      overallScore: 37,
      riskLevel: 'medium',
    };
  }

  // 1) Reliability Score - based on test pass rate and flaky tests
  let reliabilityScore = 50; // Default if no tests
  if (signals.tests.total > 0) {
    const passRate = (signals.tests.passed / signals.tests.total) * 100;
    const flakyPenalty = Math.min(signals.tests.flaky * 5, 20); // Max 20% penalty for flaky tests
    reliabilityScore = clampScore(passRate - flakyPenalty);
  }

  // 2) Security Score - based on alerts and severity
  let securityScore = 100; // Start at 100, deduct for issues
  if (signals.security.totalAlerts > 0) {
    // Deduct 30 per blocking, 15 per high, 5 per other
    const blockingPenalty = signals.security.blockingAlerts * 30;
    const highPenalty = signals.security.highSeverity * 15;
    const otherAlerts = signals.security.totalAlerts - signals.security.blockingAlerts - signals.security.highSeverity;
    const otherPenalty = otherAlerts * 5;
    securityScore = clampScore(100 - blockingPenalty - highPenalty - otherPenalty);
  }

  // 3) Coverage Score - direct from line coverage (0-100)
  const coverageScore = clampScore(signals.coverage.line);

  // 4) Maintainability Score - based on code health issues
  let maintainabilityScore = 100; // Start at 100, deduct for issues
  if (signals.issues.totalIssues > 0) {
    // Deduct 25 per critical, 15 per high, 5 per medium, 1 per low
    const criticalPenalty = signals.issues.critical * 25;
    const highPenalty = signals.issues.high * 15;
    const mediumPenalty = signals.issues.medium * 5;
    const lowPenalty = signals.issues.low * 1;
    maintainabilityScore = clampScore(100 - criticalPenalty - highPenalty - mediumPenalty - lowPenalty);
  }

  // 5) Overall Score - weighted average
  // Weights: Security 35%, Reliability 30%, Coverage 20%, Maintainability 15%
  const overallScore = clampScore(
    securityScore * 0.35 +
    reliabilityScore * 0.30 +
    coverageScore * 0.20 +
    maintainabilityScore * 0.15
  );

  // 6) Risk Level - based on overall score
  let riskLevel: OptimizationScores['riskLevel'] = 'low';
  if (overallScore < 40) {
    riskLevel = 'critical';
  } else if (overallScore < 60) {
    riskLevel = 'high';
  } else if (overallScore < 80) {
    riskLevel = 'medium';
  }

  return {
    reliabilityScore,
    securityScore,
    coverageScore,
    maintainabilityScore,
    overallScore,
    riskLevel,
  };
}

/**
 * Phase 138.5.0: Compute ACE (Autonomous Code Evolution) trigger metadata
 * Determines how strongly ACE should be suggested based on scores and signals
 *
 * Level determination:
 * - 'high': Critical issues present (security alerts, failed tests, critical code health)
 * - 'medium': Moderate issues (low coverage, medium risk level)
 * - 'low': Minor improvements possible
 * - 'none': Project is in good health, no ACE needed
 */
function computeAceTriggerMeta(
  scores: OptimizationScores | null | undefined,
  signals: OptimizationSignals | null | undefined
): AceTriggerMeta {
  const reasons: string[] = [];
  let level: AceTriggerLevel = 'none';

  // Default if no data
  if (!scores || !signals) {
    return { level: 'low', reasons: ['Insufficient data to analyze project health'] };
  }

  // Check for high-priority triggers (critical issues)

  // 1) Security blocking alerts → high
  if (signals.security.blockingAlerts > 0) {
    reasons.push(`${signals.security.blockingAlerts} blocking security alert(s) detected`);
    level = 'high';
  }

  // 2) Failed tests → high
  if (signals.tests.failed > 0) {
    reasons.push(`${signals.tests.failed} test(s) failing`);
    level = 'high';
  }

  // 3) Critical code health issues → high
  if (signals.issues.critical > 0) {
    reasons.push(`${signals.issues.critical} critical code health issue(s)`);
    level = 'high';
  }

  // 4) Overall risk level critical/high → at least medium
  if (scores.riskLevel === 'critical' && level !== 'high') {
    reasons.push('Overall project risk is critical');
    level = 'high';
  } else if (scores.riskLevel === 'high' && level === 'none') {
    reasons.push('Overall project risk is high');
    level = 'medium';
  }

  // Check for medium-priority triggers

  // 5) High security issues (non-blocking)
  if (signals.security.highSeverity > 0 && level !== 'high') {
    reasons.push(`${signals.security.highSeverity} high-severity security issue(s)`);
    if (level === 'none') level = 'medium';
  }

  // 6) High code health issues
  if (signals.issues.high > 0 && level !== 'high') {
    reasons.push(`${signals.issues.high} high-priority code issue(s)`);
    if (level === 'none') level = 'medium';
  }

  // 7) Low test coverage
  if (signals.coverage.line < 50 && level !== 'high') {
    reasons.push(`Test coverage is low (${signals.coverage.line}%)`);
    if (level === 'none') level = 'medium';
  }

  // 8) Flaky tests
  if (signals.tests.flaky > 0 && level !== 'high') {
    reasons.push(`${signals.tests.flaky} flaky test(s) detected`);
    if (level === 'none') level = 'low';
  }

  // Check for low-priority triggers

  // 9) Medium code health issues
  if (signals.issues.medium > 3 && level === 'none') {
    reasons.push(`${signals.issues.medium} medium-priority code issue(s)`);
    level = 'low';
  }

  // 10) Moderate coverage (50-70%)
  if (signals.coverage.line >= 50 && signals.coverage.line < 70 && level === 'none') {
    reasons.push(`Test coverage could be improved (${signals.coverage.line}%)`);
    level = 'low';
  }

  // 11) Security alerts present (any severity)
  if (signals.security.totalAlerts > 0 && level === 'none') {
    reasons.push(`${signals.security.totalAlerts} security alert(s) to review`);
    level = 'low';
  }

  // If no issues found, keep level as 'none'
  if (reasons.length === 0) {
    reasons.push('Project health is good - no immediate improvements needed');
  }

  return { level, reasons };
}
