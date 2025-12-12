// desktop/src/lib/atp/testCycleOrchestrator.ts
// Phase 140.1: Autonomous Test Pipeline - Core Orchestrator
// Phase 140.2: Updated with real Coverage Delta detection
// Phase 140.3: Added AMTG (Autonomous Missing Test Generator) step
// Phase 140.4: Added Failing Test Fixer integration
// Phase 140.6: Added Deploy Gate integration with TestCycleSummary
// Manages test cycles with start/cancel/timeout and pipeline execution

import {
  StartTestCycleOptions,
  TestCycleLogEntry,
  TestCycleLogLevel,
  TestCyclePhase,
  TestCycleSnapshot,
  TestCycleTrigger,
  TestCycleState,
  ATPConfig,
  DEFAULT_ATP_CONFIG,
  PipelineStepResult,
  TestCycleSummary,
  TestCycleOrigin,
} from './testCycleTypes';

// Phase 140.2: Import coverage delta engine and snapshot bridge
import {
  computeCoverageDelta,
  formatCoverageDelta,
  getRegressionSeverity,
} from './coverageDeltaEngine';
import {
  setBaselineSnapshot,
  getBaselineSnapshot,
  clearBaselineSnapshot,
  getBaselineCoverageSnapshotForCycle,
  getPostRunCoverageSnapshotForCycle,
} from './coverageSnapshotBridge';

// Phase 140.3: Import AMTG engine
import { DEFAULT_AMTG_POLICY } from './amtgTypes';
import { generateMissingTests, getAMTGSummary } from './amtgEngine';

// Phase 140.4: Import Failing Test Fixer
import { runTestsForCycle, type TestRunResult } from './testRunnerBridge';
import {
  analyzeFailingTests,
  getFailingTestsSummaryText,
} from './failingTestAnalyzer';
import { enrichSuggestedFixesWithLLM, isLLMAvailable } from './failingTestLLMBridge';

type Subscriber = (snapshot: TestCycleSnapshot) => void;

let nextId = 1;
const genId = () => `tc-${Date.now()}-${nextId++}`;

// Helper
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * TestCycleOrchestrator
 * Singleton that manages autonomous test pipeline cycles
 */
export class TestCycleOrchestrator {
  private activeCycle: TestCycleState | null = null;
  private lastCompletedCycle: TestCycleState | null = null;
  private cycleHistory: TestCycleState[] = [];
  private subscribers = new Set<Subscriber>();
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private isRunningPipeline = false;
  private config: ATPConfig = { ...DEFAULT_ATP_CONFIG };

  // Phase 140.6: Last cycle summary for Deploy Gate integration
  private lastCycleSummary: TestCycleSummary | null = null;

  // === Public API ===

  /**
   * Get current snapshot of cycle state
   */
  getSnapshot(): TestCycleSnapshot {
    return {
      activeCycle: this.activeCycle,
      lastCompletedCycle: this.lastCompletedCycle,
      cycleHistory: [...this.cycleHistory],
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ATPConfig {
    return { ...this.config };
  }

  /**
   * Phase 140.6: Get last test cycle summary for Deploy Gate
   */
  getLastCycleSummary(): TestCycleSummary | null {
    return this.lastCycleSummary;
  }

  /**
   * Update configuration
   */
  updateConfig(partial: Partial<ATPConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /**
   * Subscribe to snapshot changes
   */
  subscribe(sub: Subscriber): () => void {
    this.subscribers.add(sub);
    // Send initial snapshot
    sub(this.getSnapshot());
    return () => {
      this.subscribers.delete(sub);
    };
  }

  /**
   * Start a new test cycle
   */
  startCycle(options: StartTestCycleOptions): string | null {
    // Check if ATP is enabled
    if (!this.config.enabled) {
      console.log('[ATP] Test cycle ignored: ATP is disabled');
      return null;
    }

    // Check trigger-specific settings
    if (options.trigger === 'save' && !this.config.triggerOnSave) {
      console.log('[ATP] Save trigger ignored: triggerOnSave is disabled');
      return null;
    }
    if (options.trigger === 'commit' && !this.config.triggerOnCommit) {
      console.log('[ATP] Commit trigger ignored: triggerOnCommit is disabled');
      return null;
    }
    if (options.trigger === 'run' && !this.config.triggerOnRun) {
      console.log('[ATP] Run trigger ignored: triggerOnRun is disabled');
      return null;
    }

    // If a cycle is already running, skip
    if (this.isRunningPipeline || this.activeCycle) {
      this.appendLog(
        'warn',
        `Test cycle ignored: another cycle is already running`,
        { trigger: options.trigger },
      );
      return null;
    }

    const id = genId();
    const now = Date.now();

    this.activeCycle = {
      id,
      trigger: options.trigger,
      phase: 'queued',
      startedAt: now,
      logs: [],
      metrics: {},
      context: options.context,
    };

    this.broadcast();

    // Phase 140.2: Capture baseline coverage snapshot at cycle start
    this.captureBaselineCoverage().catch((err) => {
      console.warn('[ATP] Failed to capture baseline coverage:', err);
    });

    this.appendLog('info', `Test cycle queued (trigger = ${options.trigger})`, {
      trigger: options.trigger,
      context: options.context,
    });

    const timeoutMs = options.timeoutMs ?? this.config.defaultTimeoutMs;

    // Set timeout
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }
    this.timeoutHandle = setTimeout(() => {
      if (!this.activeCycle || this.activeCycle.id !== id) return;
      this.failWithError('Test cycle timeout exceeded', { timeoutMs });
    }, timeoutMs);

    // Run pipeline async
    this.runPipeline(id, options).catch((err) => {
      this.failWithError('Unexpected pipeline error', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return id;
  }

  /**
   * Start cycle only if no cycle is currently active
   */
  startIfIdle(options: StartTestCycleOptions): string | null {
    if (this.activeCycle || this.isRunningPipeline) {
      return null;
    }
    return this.startCycle(options);
  }

  /**
   * Cancel the currently active cycle
   */
  cancelActiveCycle(reason = 'Canceled by user'): void {
    if (!this.activeCycle) return;

    this.appendLog('warn', reason);
    this.activeCycle.phase = 'canceled';
    this.activeCycle.canceledAt = Date.now();
    this.finishCycle();
  }

  /**
   * Check if a cycle is currently active
   */
  isActive(): boolean {
    return this.activeCycle !== null || this.isRunningPipeline;
  }

  /**
   * Clear cycle history
   */
  clearHistory(): void {
    this.cycleHistory = [];
    this.broadcast();
  }

  // === Internal helpers ===

  private broadcast() {
    const snapshot = this.getSnapshot();
    this.subscribers.forEach((sub) => {
      try {
        sub(snapshot);
      } catch (err) {
        console.error('[ATP] Subscriber error:', err);
      }
    });
  }

  private appendLog(
    level: TestCycleLogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ) {
    if (!this.activeCycle) {
      console.log(`[ATP:${level}] ${message}`, meta);
      return;
    }
    const entry: TestCycleLogEntry = {
      id: `${this.activeCycle.id}-log-${this.activeCycle.logs.length + 1}`,
      ts: Date.now(),
      level,
      message,
      meta,
    };
    this.activeCycle.logs = [...this.activeCycle.logs, entry];
    this.broadcast();
  }

  private setPhase(phase: TestCyclePhase) {
    if (!this.activeCycle) return;
    this.activeCycle.phase = phase;
    this.broadcast();
  }

  private finishCycle() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    if (!this.activeCycle) return;

    this.activeCycle.finishedAt = this.activeCycle.finishedAt ?? Date.now();

    // Calculate duration
    if (this.activeCycle.metrics) {
      this.activeCycle.metrics.durationMs =
        this.activeCycle.finishedAt - this.activeCycle.startedAt;
    }

    // Phase 140.6: Build and store TestCycleSummary for Deploy Gate
    const metrics = this.activeCycle.metrics;
    const summary: TestCycleSummary = {
      id: this.activeCycle.id,
      startedAt: new Date(this.activeCycle.startedAt).toISOString(),
      finishedAt: new Date(this.activeCycle.finishedAt).toISOString(),
      origin: (this.activeCycle.context?.origin as TestCycleOrigin) ?? 'manual',
      coverageDelta: metrics.coverageDeltaPct ?? 0,
      totalTests: metrics.testsRun ?? 0,
      failingTests: metrics.testsFailed ?? 0,
      autoTestsGenerated: metrics.autoTestsGeneratedCount ?? 0,
      suggestedFixes: metrics.suggestedFixes?.length ?? 0,
    };
    this.lastCycleSummary = summary;
    // Also store in metrics for full state access
    this.activeCycle.metrics.summary = summary;

    // Add to history
    this.cycleHistory = [
      this.activeCycle,
      ...this.cycleHistory.slice(0, this.config.maxHistorySize - 1),
    ];

    this.lastCompletedCycle = this.activeCycle;
    this.activeCycle = null;
    this.isRunningPipeline = false;

    // Phase 140.2: Cleanup coverage baseline
    this.cleanupCoverageBaseline();

    this.broadcast();
  }

  private failWithError(message: string, meta?: Record<string, unknown>) {
    if (!this.activeCycle) return;
    this.appendLog('error', message, meta);
    this.activeCycle.errorMessage = message;
    this.setPhase('error');
    this.finishCycle();
  }

  // === Phase 140.2: Coverage baseline helpers ===

  /**
   * Capture baseline coverage at the start of a cycle
   */
  private async captureBaselineCoverage(): Promise<void> {
    try {
      const baseline = await getBaselineCoverageSnapshotForCycle();
      setBaselineSnapshot(baseline);

      if (baseline && this.activeCycle) {
        this.activeCycle.metrics.coverageBefore = baseline.totalPct ?? undefined;
        this.appendLog('debug', 'Baseline coverage captured', {
          totalPct: baseline.totalPct,
          fileCount: baseline.files.length,
        });
      }
    } catch (err) {
      console.warn('[ATP] Error capturing baseline coverage:', err);
    }
  }

  /**
   * Cleanup coverage baseline at end of cycle
   */
  private cleanupCoverageBaseline(): void {
    clearBaselineSnapshot();
  }

  // === Pipeline execution ===

  private async runPipeline(
    id: string,
    options: StartTestCycleOptions,
  ): Promise<void> {
    if (!this.activeCycle || this.activeCycle.id !== id) {
      return;
    }

    this.isRunningPipeline = true;
    const skipSteps = options.skipSteps ?? [];

    this.setPhase('running');
    this.appendLog('info', 'Starting Autonomous Test Pipeline', {
      trigger: options.trigger,
    });

    try {
      // 1) Smart test discovery
      if (!skipSteps.includes('discovery')) {
        const discoveryResult = await this.stepSmartDiscovery(options.trigger);
        if (!discoveryResult.success) {
          throw new Error(discoveryResult.error || 'Discovery failed');
        }
      }

      // 2) Run tests
      if (!skipSteps.includes('tests')) {
        const testsResult = await this.stepRunTests();
        if (!testsResult.success) {
          throw new Error(testsResult.error || 'Tests failed');
        }
      }

      // 3) Coverage / analysis
      if (!skipSteps.includes('analysis')) {
        const analysisResult = await this.stepAnalyzeResults();
        if (!analysisResult.success) {
          throw new Error(analysisResult.error || 'Analysis failed');
        }
      }

      // 3.5) Phase 140.3: Auto-generate missing tests for high-risk untested files
      {
        const amtgResult = await this.stepAutoMissingTests();
        if (!amtgResult.success) {
          // AMTG failures are non-fatal, just log
          this.appendLog('warn', 'AMTG step failed (non-fatal)', {
            error: amtgResult.error,
          });
        }
      }

      // 4) LLM suggestions
      if (!skipSteps.includes('llm')) {
        const llmResult = await this.stepLLMInsights();
        if (!llmResult.success) {
          // LLM failures are non-fatal, just log
          this.appendLog('warn', 'LLM insights step failed (non-fatal)', {
            error: llmResult.error,
          });
        }
      }

      // Mark finished
      if (this.activeCycle && this.activeCycle.id === id) {
        this.setPhase('finished');
        this.appendLog('info', 'Test pipeline completed successfully', {
          metrics: this.activeCycle.metrics,
        });
        this.finishCycle();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.failWithError(`Pipeline error: ${errorMessage}`, { error: errorMessage });
    }
  }

  // === Pipeline steps (stubs - will be connected to ITG / Coverage / ACE) ===

  private async stepSmartDiscovery(trigger: TestCycleTrigger): Promise<PipelineStepResult> {
    const startTime = Date.now();
    this.appendLog('info', 'Running smart test discovery...', { trigger });

    try {
      // TODO Phase 140.2: Connect to ITG for intelligent file discovery
      // - Use project index to find changed files
      // - Score files by risk
      // - Identify affected test files
      await sleep(200);

      if (this.activeCycle) {
        this.activeCycle.metrics.filesAnalyzed = 15; // Stub value
      }

      this.appendLog('debug', 'Discovery completed', { filesFound: 15 });

      return {
        success: true,
        durationMs: Date.now() - startTime,
        data: { filesFound: 15 },
      };
    } catch (err) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async stepRunTests(): Promise<PipelineStepResult> {
    const startTime = Date.now();
    this.appendLog('info', 'Running tests...');

    try {
      // Phase 140.4: Use test runner bridge
      const testRunResult = await runTestsForCycle();

      if (this.activeCycle) {
        this.activeCycle.metrics.testsRun = testRunResult.totalTestsRun;
        this.activeCycle.metrics.testsPassed = testRunResult.totalTestsPassed;
        this.activeCycle.metrics.testsFailed = testRunResult.totalTestsFailed;
        this.activeCycle.metrics.testsSkipped = testRunResult.totalTestsSkipped;

        // Phase 140.4: Store raw failures for later analysis
        this.activeCycle.metrics.rawFailures = testRunResult.allFailures;
      }

      this.broadcast();

      // Log test results
      this.appendLog('info', 'Tests completed', {
        total: testRunResult.totalTestsRun,
        passed: testRunResult.totalTestsPassed,
        failed: testRunResult.totalTestsFailed,
        skipped: testRunResult.totalTestsSkipped,
        success: testRunResult.success,
      });

      // Log individual failures if any
      if (testRunResult.allFailures.length > 0) {
        for (const failure of testRunResult.allFailures) {
          this.appendLog('warn', `Test failed: ${failure.testName}`, {
            suite: failure.suiteName,
            error: failure.errorMessage.substring(0, 100),
          });
        }
      }

      return {
        success: true, // We consider the step successful even if tests fail
        durationMs: Date.now() - startTime,
        data: {
          testsRun: testRunResult.totalTestsRun,
          passed: testRunResult.totalTestsPassed,
          failed: testRunResult.totalTestsFailed,
          failuresCount: testRunResult.allFailures.length,
        },
      };
    } catch (err) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async stepAnalyzeResults(): Promise<PipelineStepResult> {
    const startTime = Date.now();
    this.setPhase('analyzing');
    this.appendLog('info', 'Analyzing test results and coverage...');

    try {
      // Phase 140.2: Real coverage delta analysis

      // 1. Get baseline snapshot (captured at cycle start)
      const baseline = getBaselineSnapshot();

      // 2. Get post-run snapshot
      const afterSnapshot = await getPostRunCoverageSnapshotForCycle();

      // 3. Compute delta
      const deltaSummary = computeCoverageDelta(baseline, afterSnapshot);

      // 4. Update metrics
      if (this.activeCycle) {
        this.activeCycle.metrics.coverageBefore = deltaSummary.totalBefore ?? undefined;
        this.activeCycle.metrics.coverageAfter = deltaSummary.totalAfter ?? undefined;
        this.activeCycle.metrics.coverageDeltaPct = deltaSummary.totalDelta ?? undefined;
        this.activeCycle.metrics.coverageDeltaSummary = deltaSummary;
        this.activeCycle.metrics.coverageRegressionCount = deltaSummary.regressions.length;
        this.activeCycle.metrics.coverageImprovementCount = deltaSummary.improvements.length;
        this.activeCycle.metrics.highRiskUntestedCount = deltaSummary.untestedHighRiskFiles.length;
      }

      this.broadcast();

      // 5. Log summary
      const deltaStr = formatCoverageDelta(deltaSummary.totalDelta);
      this.appendLog('info', `Coverage analysis: ${deltaStr}`, {
        before: deltaSummary.totalBefore,
        after: deltaSummary.totalAfter,
        delta: deltaSummary.totalDelta,
        regressions: deltaSummary.regressions.length,
        improvements: deltaSummary.improvements.length,
        highRiskUntested: deltaSummary.untestedHighRiskFiles.length,
      });

      // 6. Log warnings for regressions
      for (const reg of deltaSummary.regressions) {
        const severity = getRegressionSeverity(reg.delta, reg.riskScore);
        const regDeltaStr = formatCoverageDelta(reg.delta);
        this.appendLog(
          severity === 'critical' ? 'error' : 'warn',
          `Coverage regression detected ↓ ${regDeltaStr} in ${reg.filePath}`,
          {
            before: reg.before,
            after: reg.after,
            delta: reg.delta,
            riskScore: reg.riskScore,
            severity,
          },
        );
      }

      // 7. Log warnings for high-risk untested files
      for (const untested of deltaSummary.untestedHighRiskFiles) {
        this.appendLog('warn', `High-risk file remains untested: ${untested.filePath}`, {
          riskScore: untested.riskScore,
          coverage: untested.after,
        });
      }

      // 8. Log improvements (debug level)
      if (deltaSummary.improvements.length > 0) {
        this.appendLog('debug', `Coverage improved in ${deltaSummary.improvements.length} file(s)`, {
          files: deltaSummary.improvements.map((f) => ({
            path: f.filePath,
            delta: f.delta,
          })),
        });
      }

      return {
        success: true,
        durationMs: Date.now() - startTime,
        data: {
          coverageBefore: deltaSummary.totalBefore,
          coverageAfter: deltaSummary.totalAfter,
          coverageDelta: deltaSummary.totalDelta,
          regressions: deltaSummary.regressions.length,
          improvements: deltaSummary.improvements.length,
          highRiskUntested: deltaSummary.untestedHighRiskFiles.length,
        },
      };
    } catch (err) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Phase 140.3: Auto-generate missing tests for high-risk untested files
   */
  private async stepAutoMissingTests(): Promise<PipelineStepResult> {
    const startTime = Date.now();
    this.appendLog('info', 'Checking for high-risk untested files...');

    try {
      // Get coverage delta summary from current cycle metrics
      const deltaSummary = this.activeCycle?.metrics.coverageDeltaSummary;

      // Run AMTG with default policy
      const amtgResult = await generateMissingTests(deltaSummary, DEFAULT_AMTG_POLICY);

      // Update metrics with AMTG results
      if (this.activeCycle) {
        this.activeCycle.metrics.autoTestsGeneratedCount = amtgResult.suggestions.length;
        this.activeCycle.metrics.autoTestsGenerated = amtgResult.suggestions;
      }

      this.broadcast();

      // Log summary
      const summary = getAMTGSummary(amtgResult);
      this.appendLog(
        amtgResult.suggestions.length > 0 ? 'info' : 'debug',
        `AMTG: ${summary}`,
        {
          generated: amtgResult.suggestions.length,
          skipped: amtgResult.skipped.length,
          candidates: amtgResult.candidatesCount,
        },
      );

      // Log individual suggestions
      for (const suggestion of amtgResult.suggestions) {
        this.appendLog('info', `Generated test suggestion: ${suggestion.title}`, {
          testFile: suggestion.testFilePath,
          sourceFile: suggestion.filePath,
          riskScore: suggestion.riskScore,
        });
      }

      return {
        success: true,
        durationMs: Date.now() - startTime,
        data: {
          generated: amtgResult.suggestions.length,
          skipped: amtgResult.skipped.length,
          candidates: amtgResult.candidatesCount,
        },
      };
    } catch (err) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async stepLLMInsights(): Promise<PipelineStepResult> {
    const startTime = Date.now();
    this.appendLog('info', 'Analyzing failing tests and generating fix suggestions...');

    try {
      // Phase 140.4: Analyze failing tests
      const rawFailures = this.activeCycle?.metrics.rawFailures || [];

      if (rawFailures.length === 0) {
        this.appendLog('debug', 'No failing tests to analyze');
        return {
          success: true,
          durationMs: Date.now() - startTime,
          data: { failuresAnalyzed: 0, suggestionsGenerated: 0 },
        };
      }

      // Analyze failures and create suggested fixes
      const analysisResult = analyzeFailingTests(rawFailures);

      // Log analysis summary
      const summaryText = getFailingTestsSummaryText(analysisResult.summary);
      this.appendLog('info', `Failure analysis: ${summaryText}`, {
        totalFailures: analysisResult.summary.totalFailures,
        suitesWithFailures: analysisResult.summary.suitesWithFailures,
      });

      // Phase 140.4: Try to enrich with LLM (stub for now)
      let enrichedFixes = analysisResult.suggestedFixes;
      if (isLLMAvailable()) {
        this.appendLog('info', 'Enriching suggested fixes with LLM...');
        const llmResult = await enrichSuggestedFixesWithLLM(analysisResult.suggestedFixes);
        enrichedFixes = llmResult.enrichedFixes;

        this.appendLog('debug', 'LLM enrichment result', {
          enrichedCount: llmResult.enrichedCount,
          failedCount: llmResult.failedCount,
          llmCalled: llmResult.llmCalled,
        });
      } else {
        this.appendLog('debug', 'LLM not available, using basic suggested fixes');
      }

      // Store results in metrics
      if (this.activeCycle) {
        this.activeCycle.metrics.suggestedFixes = enrichedFixes;
        this.activeCycle.metrics.failingTestsSummary = analysisResult.summary;
        this.activeCycle.metrics.suggestionsGenerated = enrichedFixes.length;
      }

      this.broadcast();

      // Log individual suggested fixes
      for (const fix of enrichedFixes) {
        this.appendLog('info', `Suggested fix for: ${fix.testName}`, {
          suite: fix.suiteName,
          shortReason: fix.shortReason,
          testLocation: fix.testLocation?.filePath,
          sourceLocation: fix.sourceLocation?.filePath,
        });
      }

      return {
        success: true,
        durationMs: Date.now() - startTime,
        data: {
          failuresAnalyzed: rawFailures.length,
          suggestionsGenerated: enrichedFixes.length,
        },
      };
    } catch (err) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

// Singleton instance
export const testCycleOrchestrator = new TestCycleOrchestrator();
