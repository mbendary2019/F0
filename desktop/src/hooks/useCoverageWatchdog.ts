// desktop/src/hooks/useCoverageWatchdog.ts
// Phase 137.4.1: Coverage Watchdog Hook
// Monitors project index and builds coverage analysis for deployQualityContext

import { useEffect, useRef, useCallback } from 'react';
import { useDeployQuality, type ExternalCoverageStats } from '../state/deployQualityContext';
import { useProjectIndex } from './useProjectIndex';
import { analyzeTestCoverage } from '../lib/tests/coverageEngine';
import { buildFileTestMap } from '../lib/tests/testDiscoveryBrowser';
import type { ProjectIndexEntry, TestMappings } from '../lib/tests/coverageTypes';

/** Default interval for re-analysis (5 minutes) */
const ANALYSIS_INTERVAL_MS = 5 * 60 * 1000;

/** Number of top high-risk files to include in the summary */
const TOP_HINTS_COUNT = 10;

interface UseCoverageWatchdogOptions {
  /** Project root path */
  projectRoot: string | null;
  /** Enable/disable the watchdog */
  enabled?: boolean;
  /** Interval in ms for periodic re-analysis */
  intervalMs?: number;
}

/**
 * Coverage Watchdog Hook
 *
 * Monitors the project index and analyzes test coverage.
 * Updates deployQualityContext with coverage stats.
 */
export function useCoverageWatchdog({
  projectRoot,
  enabled = true,
  intervalMs = ANALYSIS_INTERVAL_MS,
}: UseCoverageWatchdogOptions) {
  const { setExternalCoverageStats } = useDeployQuality();
  const { index, isLoading: indexLoading } = useProjectIndex(projectRoot || undefined);

  // Track last analysis timestamp to avoid duplicate updates
  const lastAnalysisRef = useRef<string | null>(null);

  // Track if analysis is in progress
  const analyzingRef = useRef(false);

  /**
   * Run coverage analysis
   */
  const runAnalysis = useCallback(async () => {
    // Skip if disabled, no project root, or already analyzing
    if (!enabled || !projectRoot || analyzingRef.current) {
      return;
    }

    // Skip if index is loading or not available
    if (indexLoading || !index || !index.files) {
      console.log('[CoverageWatchdog] Skipping - index not ready');
      return;
    }

    analyzingRef.current = true;

    try {
      console.log('[CoverageWatchdog] Starting coverage analysis...');

      // Convert project index files to ProjectIndexEntry format
      const projectEntries: ProjectIndexEntry[] = index.files.map((f) => ({
        path: f.relativePath,
        language: f.ext,
        size: f.sizeBytes,
      }));

      // Build test mappings using existing discovery
      const fileTestMap = await buildFileTestMap(projectRoot);

      // Convert FileTestMapping[] to TestMappings format
      const mappings: TestMappings = {
        sourceToTests: {},
        testsToSource: {},
      };

      for (const mapping of fileTestMap) {
        if (mapping.testFiles.length > 0) {
          mappings.sourceToTests[mapping.sourcePath] = mapping.testFiles;

          // Build reverse mapping
          for (const testFile of mapping.testFiles) {
            if (!mappings.testsToSource[testFile]) {
              mappings.testsToSource[testFile] = [];
            }
            mappings.testsToSource[testFile].push(mapping.sourcePath);
          }
        }
      }

      // Run coverage analysis
      const result = analyzeTestCoverage(projectEntries, mappings);

      // Create snapshot key to detect changes
      const snapshotKey = JSON.stringify({
        total: result.summary.totalSourceFiles,
        tested: result.summary.filesWithAnyTests,
        coverage: result.summary.estimatedCoveragePercent,
        highRisk: result.summary.highRiskUntestedCount,
      });

      // Skip if nothing changed
      if (lastAnalysisRef.current === snapshotKey) {
        console.log('[CoverageWatchdog] No changes detected, skipping update');
        analyzingRef.current = false;
        return;
      }

      lastAnalysisRef.current = snapshotKey;

      // Build external stats - take top N high-risk hints
      const topHints = result.hints
        .filter((h) => h.riskScore >= 3 && h.coverageLevel !== 'HIGH')
        .slice(0, TOP_HINTS_COUNT);

      const externalStats: ExternalCoverageStats = {
        summary: result.summary,
        topHints,
      };

      // Update context
      setExternalCoverageStats(externalStats);

      console.log('[CoverageWatchdog] Updated coverage stats:', {
        totalFiles: result.summary.totalSourceFiles,
        tested: result.summary.filesWithAnyTests,
        coverage: `${result.summary.estimatedCoveragePercent}%`,
        highRiskUntested: result.summary.highRiskUntestedCount,
        topHintsCount: topHints.length,
      });
    } catch (err) {
      console.error('[CoverageWatchdog] Analysis failed:', err);
    } finally {
      analyzingRef.current = false;
    }
  }, [enabled, projectRoot, index, indexLoading, setExternalCoverageStats]);

  // Run analysis when index changes
  useEffect(() => {
    if (!enabled || !projectRoot || indexLoading || !index) {
      return;
    }

    // Debounce to avoid rapid re-analysis
    const timeoutId = setTimeout(() => {
      runAnalysis();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [enabled, projectRoot, index, indexLoading, runAnalysis]);

  // Set up periodic re-analysis
  useEffect(() => {
    if (!enabled || !projectRoot || intervalMs <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      runAnalysis();
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [enabled, projectRoot, intervalMs, runAnalysis]);

  // Return manual trigger function
  return {
    /** Manually trigger coverage analysis */
    analyze: runAnalysis,
    /** Whether analysis is in progress */
    isAnalyzing: analyzingRef.current,
  };
}

export default useCoverageWatchdog;
