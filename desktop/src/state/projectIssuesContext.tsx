// desktop/src/state/projectIssuesContext.tsx
// =============================================================================
// Phase 149 – Desktop Quality & Deploy Gate v1 (LOCKED)
// =============================================================================
// NOTE: This file is part of the locked Quality pipeline.
// Any major behavioral changes should be done in a new Phase (>= 150).
// =============================================================================
// Phase 124.8: Project-Wide Issues State Management
// Phase 124.8.x: Added Fix Profile support
// Phase 125.2: Added Code Health snapshot recording
// Phase 127.1: Added Background Watcher for auto-scanning
// Phase 127.3: Added Auto-Fix after background scan
// Phase 141.0: Added Auto-Fix Orchestrator integration
// Phase 145.4: Issue Engine Stabilization - debug logs for ACE issue tracking
// Phase 147.2: Added targetedIssues and totalSkipped to ACE telemetry
// Phase 147.3: Added issuesBefore to ACE telemetry for debt delta calculation
// Phase 149.7: Enhanced logging with [149.7][ISSUES/ACE/ACE-Guided/PROJECT-FIX] tags

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

// Phase 127.1: Background watcher config
import {
  BACKGROUND_WATCHER_ENABLED,
  BACKGROUND_SCAN_INTERVAL_MS,
  BACKGROUND_CHECK_INTERVAL_MS,
  BACKGROUND_SCAN_IDLE_ONLY,
  BACKGROUND_IDLE_THRESHOLD_MS,
  BACKGROUND_SCAN_MAX_FILES,
} from './backgroundWatcherConfig';

// Phase 127.3: Auto-fix config
import {
  AUTO_FIX_AFTER_BG_SCAN_ENABLED,
  AUTO_FIX_SAFE_MIX_THRESHOLD_SCORE,
  AUTO_FIX_SAFE_MIX_MAX_FILES,
  AUTO_FIX_BG_SCAN_PROFILE,
} from './autoFixConfig';

// Phase 124.8.x: Import fix profiles
import {
  type FixProfileId,
  filterIssuesByProfile,
} from '../lib/analysis/fixProfiles';

// Phase 125.2: Import types for snapshot data
import type {
  IssueSeverityCounts,
  IssueCategoryCounts,
} from '../lib/analysis/codeHealthTypes';

// Phase 141.0: Auto-Fix Orchestrator imports
// Phase 142.3: Added PatchEngine imports
// Phase 145.3: Added ACE-Guided imports
// Phase 145.5: Added ACE Telemetry types
import type { AutoFixRequest, AutoFixResult, IDEIssue } from '../autoFix/autoFixTypes';
import type { AceGuidedAutoFixPlan, AceGuidedProjectAutoFixResult, IssueData } from '../autoFix/aceAutoFixTypes';
import type { AceRun, AceRunSource } from '../contexts/aceTelemetryContext';
import {
  buildAutoFixPlan,
  executeAutoFixPlan,
  buildAceGuidedAutoFixPlan,
  runAceGuidedAutoFixForProject,
  type IssueWithMeta,
} from '../autoFix/autoFixOrchestrator';
import { applyFilePatches, type PatchEngineDeps } from '../autoFix/autoFixPatchEngine';

// ============================================
// Phase 145.5.3: Direct localStorage ACE Telemetry Helper
// This bypasses the React context chain for guaranteed persistence
// ============================================

const ACE_TELEMETRY_KEY = 'f0_ace_telemetry';
const MAX_ACE_RUNS_DIRECT = 10;

/**
 * Directly write ACE run to localStorage (bypasses context chain)
 * This ensures telemetry is always recorded even if context wiring has issues
 */
function recordAceRunDirect(run: AceRun): void {
  if (typeof window === 'undefined') return;

  try {
    const existingRaw = window.localStorage.getItem(ACE_TELEMETRY_KEY);
    const existing: AceRun[] = existingRaw ? JSON.parse(existingRaw) : [];

    // Filter out duplicates and invalid entries
    const filtered = Array.isArray(existing)
      ? existing.filter((r) => r && r.id && r.id !== run.id)
      : [];

    // Add new run at the beginning, keep max 10
    const next = [run, ...filtered].slice(0, MAX_ACE_RUNS_DIRECT);

    window.localStorage.setItem(ACE_TELEMETRY_KEY, JSON.stringify(next));
    console.log('[ACE Telemetry Direct] Saved run to localStorage. ID:', run.id, '| Total runs:', next.length);
  } catch (err) {
    console.warn('[ACE Telemetry Direct] Failed to save run:', err);
  }
}

/**
 * Summary of issues for a single file
 */
export type FileIssuesSummary = {
  filePath: string;
  relativePath: string;
  issueCount: number;
  errors: number;
  warnings: number;
  infos: number;
  categories: Record<string, number>;
  issues: Array<{
    id: string;
    severity: 'info' | 'warning' | 'error';
    category: 'logic' | 'security' | 'performance' | 'style' | 'best-practice';
    message: string;
    lineStart: number;
    lineEnd: number;
  }>;
};

/**
 * Result of a project-wide scan
 */
export type ProjectScanResult = {
  scannedFiles: number;
  totalIssues: number;
  totalErrors: number;
  totalWarnings: number;
  totalInfos: number;
  summaries: FileIssuesSummary[];
  skippedFiles: number;
  scanDurationMs: number;
};

/**
 * State for project issues
 */
export type ProjectIssuesState = {
  summaries: FileIssuesSummary[];
  scannedFiles: number;
  totalIssues: number;
  totalErrors: number;
  totalWarnings: number;
  totalInfos: number;
  isScanning: boolean;
  lastScanTime: number | null;
  scanDurationMs: number | null;
  error: string | null;
  // Phase 124.8.x: Active fix profile
  activeProfileId: FixProfileId;
  // Phase 124.9: Project-wide fix state
  isFixingProject: boolean;
  fixedFilesCount: number;
  totalFilesToFix: number;
  fixCancelled: boolean;
  // Phase 124.9.1: Retry tracking
  retriedFilesCount: number;
  // Phase 124.9.2: Parallel fix tracking
  currentlyFixingFiles: string[];
};

/**
 * Phase 124.9.3: Patterns for backup/snapshot folders to skip
 * Phase 148.3 B2: Added dist-electron, .next for build outputs
 */
export const BACKUP_FOLDER_PATTERNS = [
  /\/backup\//i,
  /\/backups\//i,
  /\/snapshot\//i,
  /\/snapshots\//i,
  /\/archive\//i,
  /\/archives\//i,
  /\/_backup\//i,
  /\/_old\//i,
  /\/\.backup\//i,
  /\/node_modules\//i,
  /\/dist\//i,
  /\/dist-electron\//i,  // Phase 148.3 B2: Electron build output
  /\/build\//i,
  /\/\.next\//i,         // Phase 148.3 B2: Next.js build output
  /\/\.git\//i,
  /\/\.vercel\//i,       // Phase 148.3 B2: Vercel output
  /\/\.turbo\//i,        // Phase 148.3 B2: Turbo cache
];

/**
 * Phase 124.9: Fix result callback type
 */
export type FixFileCallback = (summary: FileIssuesSummary) => Promise<{
  success: boolean;
  fixedCount?: number;
  error?: string;
}>;

/**
 * Phase 125.2: Snapshot data for Code Health recording
 */
export type SnapshotData = {
  filesScanned: number;
  totalIssues: number;
  severity: IssueSeverityCounts;
  categories: IssueCategoryCounts;
};

/**
 * Phase 125.2: Callback for recording snapshots
 */
export type OnSnapshotRecordedCallback = (
  source: 'scan' | 'auto_fix_after_scan',
  data: SnapshotData
) => void;

/**
 * Context value interface
 */
interface ProjectIssuesContextValue extends ProjectIssuesState {
  /** Start a project-wide scan */
  // Phase 185.1: Return scan result for delta tracking
  scanProject: (maxFiles?: number, source?: 'scan' | 'auto_fix_after_scan') => Promise<{ totalIssues: number; scannedFiles: number } | null>;
  /** Clear all project issues */
  clearProjectIssues: () => void;
  /** Get issues for a specific file */
  getFileIssues: (filePath: string) => FileIssuesSummary | null;
  /** Remove a file from the summaries (after fixing) */
  removeFileSummary: (filePath: string) => void;
  /** Update a file summary (after partial fix) */
  updateFileSummary: (filePath: string, summary: FileIssuesSummary) => void;
  // Phase 124.8.x: Profile management
  /** Set the active fix profile */
  setActiveProfile: (profileId: FixProfileId) => void;
  /** Get filtered issues for a file based on active profile */
  getFilteredIssues: (summary: FileIssuesSummary) => FileIssuesSummary['issues'];
  // Phase 124.9: Project-wide fix orchestrator
  /** Fix all files with issues using active profile */
  fixProject: (fixFileFn: FixFileCallback, maxFiles?: number) => Promise<void>;
  /** Cancel ongoing project fix */
  cancelProjectFix: () => void;
  // Phase 124.9.3: Check if a path is in backup/excluded folder
  isBackupFolder: (filePath: string) => boolean;
  // Phase 141.0: Auto-Fix Orchestrator
  /** Run auto-fix using the new orchestrator (Phase 141) */
  runAutoFix: (opts?: { issues?: IDEIssue[]; mode?: 'all' | 'selected'; dryRun?: boolean }) => Promise<AutoFixResult>;
  // Phase 145.3: ACE-Guided Auto-Fix
  // Phase 146.7: Added diagnosticsWorstFiles parameter for Diagnostics-based prioritization
  /** Build ACE-Guided plan from current scan (prioritizes worst files) */
  buildAceGuidedPlanForCurrentScan: (aceWorstFiles?: string[], maxFiles?: number, diagnosticsWorstFiles?: string[]) => AceGuidedAutoFixPlan;
  /** Run ACE-Guided auto-fix on prioritized files */
  runAceGuidedAutoFix: (worstFiles?: string[], maxFiles?: number, source?: 'diagnostics' | 'ace') => Promise<AceGuidedProjectAutoFixResult>;
  // Phase 145.5.2: Expose projectRoot for telemetry
  /** Current project root path */
  projectRoot: string | null;
}

const ProjectIssuesContext = createContext<ProjectIssuesContextValue | null>(null);

/**
 * Phase 125.2: Provider props
 * Phase 127.1: Added projectPath for background watcher
 * Phase 127.3: Added fixFileFn for auto-fix after background scan
 */
/**
 * Phase 145.5: ACE Telemetry callback type
 */
export type OnAceRunRecordedCallback = (run: AceRun) => void;

interface ProjectIssuesProviderProps {
  children: ReactNode;
  /** Callback when a snapshot is recorded (after scan or auto-fix) */
  onSnapshotRecorded?: OnSnapshotRecordedCallback;
  /** Phase 127.1: Current project path (for background watcher to know if project is open) */
  projectPath?: string | null;
  /** Phase 127.3: Fix file callback for auto-fix after background scan */
  fixFileFn?: FixFileCallback;
  /** Phase 145.5: Callback to record ACE telemetry runs */
  onAceRunRecorded?: OnAceRunRecordedCallback;
}

/**
 * Phase 127.3: Calculate health score from summaries
 */
function calculateHealthScore(summaries: FileIssuesSummary[]): number {
  const totalIssues = summaries.reduce((sum, s) => sum + s.issueCount, 0);
  const totalErrors = summaries.reduce((sum, s) => sum + s.errors, 0);
  const totalWarnings = summaries.reduce((sum, s) => sum + s.warnings, 0);

  // Simple scoring: start at 100, subtract for issues
  // Errors are heavily penalized, warnings less so
  const errorPenalty = totalErrors * 5;
  const warningPenalty = totalWarnings * 1;
  const score = Math.max(0, 100 - errorPenalty - warningPenalty);

  return Math.round(score);
}

/**
 * Provider component for project-wide issues state
 */
export function ProjectIssuesProvider({ children, onSnapshotRecorded, projectPath, fixFileFn, onAceRunRecorded }: ProjectIssuesProviderProps) {
  const [state, setState] = useState<ProjectIssuesState>({
    summaries: [],
    scannedFiles: 0,
    totalIssues: 0,
    totalErrors: 0,
    totalWarnings: 0,
    totalInfos: 0,
    isScanning: false,
    lastScanTime: null,
    scanDurationMs: null,
    error: null,
    // Phase 124.8.x: Default to safe_mix profile
    activeProfileId: 'safe_mix',
    // Phase 124.9: Project-wide fix state
    isFixingProject: false,
    fixedFilesCount: 0,
    totalFilesToFix: 0,
    fixCancelled: false,
    // Phase 124.9.1: Retry tracking
    retriedFilesCount: 0,
    // Phase 124.9.2: Parallel fix tracking
    currentlyFixingFiles: [],
  });

  // Phase 127.1: Refs for background watcher
  const lastActivityRef = useRef<number>(Date.now());
  const backgroundScanInProgressRef = useRef<boolean>(false);

  // Phase 127.1: Track user activity (mouse, keyboard)
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
    };
  }, []);

  /**
   * Phase 125.2: Build snapshot data from summaries
   */
  const buildSnapshotDataFromSummaries = useCallback(
    (summaries: FileIssuesSummary[], filesScanned: number): SnapshotData => {
      const severity: IssueSeverityCounts = { errors: 0, warnings: 0, infos: 0 };
      const categories: IssueCategoryCounts = {
        logging: 0,
        types: 0,
        style: 0,
        deadCode: 0,
        security: 0,
        performance: 0,
        other: 0,
      };

      for (const summary of summaries) {
        for (const issue of summary.issues) {
          // Count by severity
          if (issue.severity === 'error') severity.errors++;
          else if (issue.severity === 'warning') severity.warnings++;
          else severity.infos++;

          // Count by category
          const cat = issue.category?.toLowerCase() || 'other';
          if (cat.includes('log') || cat.includes('console')) categories.logging++;
          else if (cat.includes('type') || cat.includes('typescript')) categories.types++;
          else if (cat.includes('style') || cat.includes('format')) categories.style++;
          else if (cat.includes('dead') || cat.includes('unused')) categories.deadCode++;
          else if (cat.includes('security') || cat.includes('vuln')) categories.security++;
          else if (cat.includes('perf') || cat.includes('optim')) categories.performance++;
          else categories.other++;
        }
      }

      const totalIssues = summaries.reduce((sum, s) => sum + s.issueCount, 0);
      return { filesScanned, totalIssues, severity, categories };
    },
    []
  );

  // Phase 185.1: Return scan result for delta tracking
  const scanProject = useCallback(async (maxFiles: number = 200, source: 'scan' | 'auto_fix_after_scan' = 'scan'): Promise<{ totalIssues: number; scannedFiles: number } | null> => {
    setState((prev) => ({
      ...prev,
      isScanning: true,
      error: null,
    }));

    try {
      // Check if the bridge is available
      const api = window.f0Desktop as Record<string, unknown> | undefined;
      if (!api?.scanProjectIssues || typeof api.scanProjectIssues !== 'function') {
        throw new Error('Project scan bridge not available');
      }

      const scanFn = api.scanProjectIssues as (input?: {
        maxFiles?: number;
      }) => Promise<{
        success: boolean;
        error?: string;
        result?: ProjectScanResult;
      }>;

      console.log('[ProjectIssuesContext] Starting project scan...');
      const response = await scanFn({ maxFiles });

      if (!response.success) {
        throw new Error(response.error || 'Project scan failed');
      }

      const result = response.result;
      if (!result) {
        throw new Error('No scan result returned');
      }

      // Phase 145.4.3: Enhanced logging for debugging issue count changes
      console.log(
        `[ProjectIssuesContext] Scan complete (source: ${source}): ${result.scannedFiles} files, ${result.totalIssues} issues`
      );
      if (source === 'auto_fix_after_scan') {
        console.log(`[ProjectIssuesContext] Issues AFTER ACE fix: ${result.totalIssues}`);
      }

      setState((prev) => {
        const issuesBefore = prev.totalIssues;
        const issuesAfter = result.totalIssues;
        const delta = issuesAfter - issuesBefore;

        // Phase 149.7: Enhanced logging for scan completion
        console.log('[149.7][ISSUES] Scan completed', {
          source,
          filesScanned: result.scannedFiles,
          issuesBefore,
          issuesAfter,
          delta,
        });

        return {
          ...prev,
          summaries: result.summaries,
          scannedFiles: result.scannedFiles,
          totalIssues: result.totalIssues,
          totalErrors: result.totalErrors,
          totalWarnings: result.totalWarnings,
          totalInfos: result.totalInfos,
          isScanning: false,
          lastScanTime: Date.now(),
          scanDurationMs: result.scanDurationMs,
          error: null,
        };
      });

      // Phase 125.2: Record snapshot for Code Health tracking
      // Phase 148.3 B3: Ensure snapshot is recorded for both 'scan' and 'auto_fix_after_scan'
      if (onSnapshotRecorded) {
        const snapshotData = buildSnapshotDataFromSummaries(result.summaries, result.scannedFiles);
        console.log(`[ProjectIssuesContext] Recording snapshot (source: ${source}): ${snapshotData.totalIssues} issues`);
        onSnapshotRecorded(source, snapshotData);
      }

      // Phase 185.1: Return scan result for delta tracking
      return { totalIssues: result.totalIssues, scannedFiles: result.scannedFiles };
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unexpected error during scan';
      console.error('[ProjectIssuesContext] Scan error:', errorMessage);
      setState((prev) => ({
        ...prev,
        isScanning: false,
        error: errorMessage,
      }));
      return null;
    }
  }, [onSnapshotRecorded, buildSnapshotDataFromSummaries]);

  const clearProjectIssues = useCallback(() => {
    setState((prev) => ({
      summaries: [],
      scannedFiles: 0,
      totalIssues: 0,
      totalErrors: 0,
      totalWarnings: 0,
      totalInfos: 0,
      isScanning: false,
      lastScanTime: null,
      scanDurationMs: null,
      error: null,
      // Preserve the active profile
      activeProfileId: prev.activeProfileId,
      // Phase 124.9: Reset fix state
      isFixingProject: false,
      fixedFilesCount: 0,
      totalFilesToFix: 0,
      fixCancelled: false,
      // Phase 124.9.1: Reset retry tracking
      retriedFilesCount: 0,
      // Phase 124.9.2: Reset parallel fix tracking
      currentlyFixingFiles: [],
    }));
  }, []);

  // Phase 124.8.x: Set active fix profile
  const setActiveProfile = useCallback((profileId: FixProfileId) => {
    setState((prev) => ({ ...prev, activeProfileId: profileId }));
  }, []);

  // Phase 124.8.x: Get filtered issues based on active profile
  const getFilteredIssues = useCallback(
    (summary: FileIssuesSummary): FileIssuesSummary['issues'] => {
      return filterIssuesByProfile(summary.issues, state.activeProfileId);
    },
    [state.activeProfileId]
  );

  // Phase 124.9: Cancel project fix
  const cancelProjectFix = useCallback(() => {
    console.log('[ProjectIssuesContext] Cancel project fix requested');
    setState((prev) => ({
      ...prev,
      fixCancelled: true,
    }));
  }, []);

  /**
   * Phase 141.0: Run Auto-Fix using the new Orchestrator
   * Phase 142.3: Now applies patches via PatchEngine
   * Converts FileIssuesSummary issues to IDEIssue format and runs the plan
   */
  const runAutoFix = useCallback(
    async (opts?: { issues?: IDEIssue[]; mode?: 'all' | 'selected'; dryRun?: boolean }): Promise<AutoFixResult> => {
      // Phase 149.7: Log runAutoFix start
      console.log('[149.7][ACE] runAutoFix started', {
        mode: opts?.mode ?? 'all',
        dryRun: opts?.dryRun ?? false,
        providedIssues: opts?.issues?.length ?? 0,
        summariesCount: state.summaries.length,
        totalIssues: state.totalIssues,
      });

      // Convert current summaries to IDEIssue format if no issues provided
      const targetIssues: IDEIssue[] = opts?.issues ?? state.summaries.flatMap((summary) =>
        summary.issues.map((issue) => ({
          id: issue.id,
          filePath: summary.filePath,
          message: issue.message,
          line: issue.lineStart,
          severity: issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info',
          kind: issue.category === 'security' ? 'security' :
                issue.category === 'performance' ? 'performance' :
                issue.category === 'style' ? 'style' : 'unknown',
          source: 'projectIssues',
          fixable: issue.category !== 'security', // Security issues need manual review
        } as IDEIssue))
      );

      const mode = opts?.mode ?? 'all';
      const dryRun = opts?.dryRun ?? false;

      const req: AutoFixRequest = {
        issues: targetIssues,
        mode,
        dryRun,
      };

      console.log('[AutoFix] Building plan for', targetIssues.length, 'issues...');
      const plan = buildAutoFixPlan(req);
      console.log('[AutoFix] Plan built:', plan);

      // 1) Execute plan with registered engines
      const engineResult: AutoFixResult = await executeAutoFixPlan(req, plan);
      console.log('[AutoFix] Engine result:', engineResult);

      // 2) If dry run or no patches, return result as-is
      if (dryRun || engineResult.patches.length === 0) {
        console.log('[AutoFix] Dry run or no patches, skipping apply step');
        return engineResult;
      }

      // 3) Prepare PatchEngine dependencies
      const patchDeps: PatchEngineDeps = {
        getFileContent: async (filePath) => {
          // Try f0Desktop bridge first
          const api = window.f0Desktop as Record<string, unknown> | undefined;
          if (api?.readFileText && typeof api.readFileText === 'function') {
            try {
              const result = await (api.readFileText as (path: string) => Promise<{ success: boolean; content?: string }>)(filePath);
              if (result.success && result.content !== undefined) {
                return result.content;
              }
            } catch (e) {
              console.warn('[AutoFix] Failed to read file via bridge:', filePath, e);
            }
          }
          return null;
        },
        updateFileContent: async (filePath, newContent) => {
          // Use f0Desktop bridge to write file
          const api = window.f0Desktop as Record<string, unknown> | undefined;
          if (api?.writeFileText && typeof api.writeFileText === 'function') {
            const result = await (api.writeFileText as (path: string, content: string) => Promise<{ success: boolean; error?: string }>)(filePath, newContent);
            if (!result.success) {
              throw new Error(result.error || 'Failed to write file');
            }
          } else {
            throw new Error('File write bridge not available');
          }
        },
      };

      // 4) Apply patches
      console.log('[AutoFix] Applying', engineResult.patches.length, 'patches...');
      const applyResult = await applyFilePatches(
        engineResult.patches,
        patchDeps,
        { strictBeforeCheck: true }
      );

      console.log('[AutoFix] Patches applied:', applyResult.applied.length, 'files,', applyResult.skipped.length, 'skipped');

      // 5) Re-scan project after fixes to update issue list
      if (applyResult.applied.length > 0) {
        console.log('[AutoFix] Re-scanning project after fixes...');
        // Small delay to let file system settle
        await new Promise((resolve) => setTimeout(resolve, 500));
        await scanProject(200, 'auto_fix_after_scan');
      }

      return engineResult;
    },
    [state.summaries, scanProject]
  );

  /**
   * Phase 124.9.3: Check if a file path is in a backup/excluded folder
   */
  const isBackupFolder = useCallback((filePath: string): boolean => {
    return BACKUP_FOLDER_PATTERNS.some((pattern) => pattern.test(filePath));
  }, []);

  /**
   * Phase 145.3: Build ACE-Guided Auto-Fix plan from current scan
   * Phase 146.7: Added diagnosticsWorstFiles parameter for Diagnostics-based prioritization
   * Phase 183.1: Fixed - include relativePath in IssueWithMeta for proper path matching
   * Phase 184: Fixed - add desktop/ prefix to relativePath for matching with Diagnostics paths
   * Converts FileIssuesSummary to IssueWithMeta and prioritizes files
   */
  const buildAceGuidedPlanForCurrentScan = useCallback(
    (aceWorstFiles?: string[], maxFiles: number = 10, diagnosticsWorstFiles?: string[]): AceGuidedAutoFixPlan => {
      // Convert summaries to IssueWithMeta format
      // Phase 183.1: Include relativePath for proper matching with Diagnostics paths
      // Phase 184: Add desktop/ prefix to relativePath since Diagnostics uses "desktop/src/..." format
      // Phase 184.2: Use relativePath instead of filePath for backup folder check
      // This prevents false positives when the project root is in a folder named "backup"
      const allIssues: IssueWithMeta[] = state.summaries
        .filter((summary) => !isBackupFolder(summary.relativePath))
        .flatMap((summary) => {
          // Phase 184: Scanner relativePath is "src/..." but Diagnostics uses "desktop/src/..."
          // Add the desktop/ prefix for proper matching
          const diagnosticsCompatiblePath = summary.relativePath.startsWith('src/')
            ? `desktop/${summary.relativePath}`
            : summary.relativePath;

          return summary.issues.map((issue) => ({
            id: issue.id,
            filePath: summary.filePath,              // Absolute path from Scanner
            relativePath: diagnosticsCompatiblePath, // Phase 184: Diagnostics-compatible path
            message: issue.message,
            line: issue.lineStart,
            severity: issue.severity,
            category: issue.category,
            ruleId: undefined, // Not available in FileIssuesSummary
          }));
        });

      console.log(`[ACE-Guided] Building plan from ${allIssues.length} issues across ${state.summaries.length} files`);

      // Phase 184.1: Debug - check if summaries have issues
      if (allIssues.length === 0 && state.summaries.length > 0) {
        const sampleSummary = state.summaries[0];
        console.warn('[ACE-Guided Debug] WARNING: 0 issues but summaries exist!');
        console.warn('[ACE-Guided Debug] Sample summary:', {
          filePath: sampleSummary.filePath,
          relativePath: sampleSummary.relativePath,
          issueCount: sampleSummary.issueCount,
          issuesArrayLength: sampleSummary.issues?.length,
          hasIssuesArray: Array.isArray(sampleSummary.issues),
        });
        // Check total issue count from summaries
        const totalFromSummaries = state.summaries.reduce((sum, s) => sum + (s.issues?.length || 0), 0);
        console.warn('[ACE-Guided Debug] Total issues from summaries.issues arrays:', totalFromSummaries);
        const totalFromIssueCount = state.summaries.reduce((sum, s) => sum + s.issueCount, 0);
        console.warn('[ACE-Guided Debug] Total from summaries.issueCount:', totalFromIssueCount);
      }

      // Phase 184: Debug log to verify issue paths format
      if (allIssues.length > 0) {
        console.log('[ACE-Guided Debug] Sample issue paths from Scanner (with desktop/ prefix):', allIssues.slice(0, 3).map(i => ({
          filePath: i.filePath,
          relativePath: (i as { relativePath?: string }).relativePath,
        })));
      }
      if (diagnosticsWorstFiles && diagnosticsWorstFiles.length > 0) {
        console.log('[ACE-Guided Debug] Diagnostics worst files:', diagnosticsWorstFiles.slice(0, 3));
      }
      // Phase 146.7: Pass diagnosticsWorstFiles to orchestrator for prioritization
      const plan = buildAceGuidedAutoFixPlan(allIssues, aceWorstFiles, maxFiles, diagnosticsWorstFiles);
      console.log(`[ACE-Guided] Plan built: ${plan.targetFiles.length} files, source: ${plan.source}`);
      // Phase 184: Verify issuesByFile is populated
      console.log('[ACE-Guided Debug] Plan issuesByFile keys:', Object.keys(plan.issuesByFile).slice(0, 5));
      console.log('[ACE-Guided Debug] Plan totalIssues:', plan.totalIssues);
      return plan;
    },
    [state.summaries, isBackupFolder]
  );

  /**
   * Phase 145.3: Run ACE-Guided Auto-Fix on prioritized files
   * Uses ACE Code Evolution to fix worst files first
   * Phase 145.5: Records ACE run telemetry
   * Phase 146.7: Added diagnosticsWorstFiles for Diagnostics-based prioritization
   */
  const runAceGuidedAutoFix = useCallback(
    async (
      worstFiles?: string[],
      maxFiles: number = 10,
      source: 'diagnostics' | 'ace' = 'ace'
    ): Promise<AceGuidedProjectAutoFixResult> => {
      // Phase 149.7: Log ACE-Guided start
      console.log('[149.7][ACE-Guided] runAceGuidedAutoFix started', {
        source,
        maxFiles,
        worstFilesProvided: worstFiles?.length ?? 0,
        summariesCount: state.summaries.length,
        totalIssues: state.totalIssues,
      });

      // Phase 145.5: Record start time for telemetry
      const startedAt = new Date().toISOString();

      // Phase 146.7: Pass worstFiles to appropriate parameter based on source
      const aceWorstFiles = source === 'ace' ? worstFiles : undefined;
      const diagnosticsWorstFiles = source === 'diagnostics' ? worstFiles : undefined;

      // 1) Build the plan
      const plan = buildAceGuidedPlanForCurrentScan(aceWorstFiles, maxFiles, diagnosticsWorstFiles);

      if (plan.targetFiles.length === 0) {
        console.log('[ACE-Guided] No files to fix');
        return {
          fileResults: {},
          totalApplied: 0,
          totalSkipped: 0,
          totalErrors: 0,
          filesProcessed: 0,
          durationMs: 0,
          notes: ['No files to fix'],
        };
      }

      // 2) Phase 145.3.1: Use projectPath from provider instead of extracting from file path
      const actualProjectRoot = projectPath || '/';

      // 2b) Phase 145.3.2: Build issuesData map from summaries
      const issuesData = new Map<string, IssueData>();
      for (const summary of state.summaries) {
        for (const issue of summary.issues) {
          issuesData.set(issue.id, {
            id: issue.id,
            message: issue.message,
            line: issue.lineStart,
            column: 1,
            severity: issue.severity,
            category: issue.category,
          });
        }
      }

      console.log(`[ACE-Guided] Running auto-fix on ${plan.targetFiles.length} files, projectRoot: ${actualProjectRoot}, issuesData: ${issuesData.size}`);

      // 3) Run the orchestrator
      const result = await runAceGuidedAutoFixForProject({
        projectRoot: actualProjectRoot,
        plan,
        quiet: false,
        createBackup: true,
        issuesData,
      });

      console.log(`[ACE-Guided] Complete: ${result.totalApplied} applied, ${result.totalSkipped} skipped, ${result.totalErrors} errors`);

      // Phase 145.5.3: ALWAYS record ACE run directly to localStorage (guaranteed persistence)
      // Phase 147.2: Include targetedIssues and totalSkipped
      // Phase 147.3: Include issuesBefore (issuesAfter comes from re-scan snapshot)
      const finishedAt = new Date().toISOString();
      const aceRunId = `ace-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Phase 147.3: Calculate issuesBefore from current summaries
      const issuesBeforeRun = state.summaries.reduce((sum, s) => sum + s.issueCount, 0);

      const aceRun: AceRun = {
        id: aceRunId,
        startedAt,
        finishedAt,
        filesProcessed: result.filesProcessed,
        totalApplied: result.totalApplied,
        totalErrors: result.totalErrors,
        projectRoot: actualProjectRoot,
        source: 'guided' as AceRunSource,
        // Phase 147.2: Per-run target issues tracking
        targetedIssues: result.targetedIssues ?? plan.totalIssues,
        totalSkipped: result.totalSkipped ?? 0,
        // Phase 147.3: Issues before run (for debt delta calculation)
        issuesBefore: issuesBeforeRun,
      };

      // Direct localStorage write (bypasses context chain issues)
      recordAceRunDirect(aceRun);

      // Phase 145.5: Also try context callback (for live UI updates if wiring works)
      if (onAceRunRecorded) {
        console.log('[ACE-Guided] Also calling onAceRunRecorded callback:', aceRunId);
        try {
          onAceRunRecorded(aceRun);
        } catch (err) {
          console.warn('[ACE-Guided] onAceRunRecorded callback failed:', err);
        }
      }

      // Phase 147.3: Log issues before (already calculated above)
      console.log(`[ACE-Guided Debug] Issues BEFORE re-scan: ${issuesBeforeRun}`);

      // 4) Re-scan project after fixes to update issue list
      // Phase 149.7: Always trigger re-scan for wiring validation (even if totalApplied = 0)
      console.log('[149.7][ACE-Guided] Triggering re-scan after guided run...', {
        totalApplied: result.totalApplied,
        totalSkipped: result.totalSkipped,
        totalErrors: result.totalErrors,
      });

      // Phase 148.3 B1: Clear state before re-scan to ensure fresh results
      setState((prev) => ({
        ...prev,
        isScanning: true,
      }));

      await new Promise((resolve) => setTimeout(resolve, 800));

      console.log('[ACE-Guided Debug] Calling scanProject for fresh scan (auto_fix_after_scan)...');
      const scanResult = await scanProject(200, 'auto_fix_after_scan');

      // Phase 185.1: Get issuesAfter from scan result (not from state which may be stale)
      const issuesAfterRun = scanResult?.totalIssues ?? state.summaries.reduce((sum, s) => sum + s.issueCount, 0);
      const delta = issuesBeforeRun - issuesAfterRun;

      // Phase 185: Log the before/after delta for tracking
      console.log('[ACE-Guided][Delta] Before/After tracking:', {
        issuesBefore: issuesBeforeRun,
        issuesAfter: issuesAfterRun,
        delta,
        improved: delta > 0,
        patchesApplied: result.totalApplied,
        patchesSkipped: result.totalSkipped,
      });

      // Phase 185: Emit delta event for Quality History / DeployGate / Telemetry
      if (typeof window !== 'undefined') {
        const deltaEvent = new CustomEvent('ace-guided-delta', {
          detail: {
            issuesBefore: issuesBeforeRun,
            issuesAfter: issuesAfterRun,
            delta,
            patchesApplied: result.totalApplied,
            patchesSkipped: result.totalSkipped,
            source: 'ace_auto_fix',
            timestamp: new Date().toISOString(),
          },
        });
        window.dispatchEvent(deltaEvent);
        console.log('[ACE-Guided][Delta] Emitted ace-guided-delta event');
      }

      console.log('[ACE-Guided Debug] Re-scan completed - UI should update with new issue count');

      // Phase 185: Return result with delta info
      return {
        ...result,
        issuesBefore: issuesBeforeRun,
        issuesAfter: issuesAfterRun,
        delta,
      };
    },
    [buildAceGuidedPlanForCurrentScan, projectPath, scanProject, state.summaries, onAceRunRecorded]
  );

  /**
   * Phase 124.9.1: Try to fix a file with retry logic
   */
  const tryFixFileWithRetry = useCallback(
    async (
      fixFileFn: FixFileCallback,
      summary: FileIssuesSummary,
      filteredIssues: FileIssuesSummary['issues'],
      maxAttempts: number = 2
    ): Promise<{ success: boolean; fixedCount?: number; error?: string; retried: boolean }> => {
      const filteredSummary: FileIssuesSummary = {
        ...summary,
        issues: filteredIssues,
        issueCount: filteredIssues.length,
        errors: filteredIssues.filter((i) => i.severity === 'error').length,
        warnings: filteredIssues.filter((i) => i.severity === 'warning').length,
        infos: filteredIssues.filter((i) => i.severity === 'info').length,
      };

      let lastError: string | undefined;
      let retried = false;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await fixFileFn(filteredSummary);
          if (result.success) {
            if (attempt > 1) {
              console.log(`[ProjectFix] Success on retry attempt ${attempt}: ${summary.relativePath}`);
            }
            return { success: true, fixedCount: result.fixedCount, retried };
          }
          lastError = result.error;
          console.warn(`[ProjectFix] Attempt ${attempt} failed for ${summary.relativePath}: ${result.error}`);
        } catch (e: unknown) {
          lastError = e instanceof Error ? e.message : 'Unknown error';
          console.warn(`[ProjectFix] Attempt ${attempt} threw error for ${summary.relativePath}:`, lastError);
        }

        if (attempt < maxAttempts) {
          console.log(`[ProjectFix] Retrying ${summary.relativePath}... (attempt ${attempt + 1}/${maxAttempts})`);
          retried = true;
          // Small delay before retry
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      return { success: false, error: lastError, retried };
    },
    []
  );

  // Phase 124.9: Fix all files with issues using active profile
  // Phase 124.9.1: Smart Retry System
  // Phase 124.9.2: Parallel Fix Engine
  // Phase 124.9.3: Skip Backup Folders
  // Phase 124.9.4: Auto Scan After Fix
  const fixProject = useCallback(
    async (fixFileFn: FixFileCallback, maxFiles: number = 50) => {
      // Phase 149.7: Log fixProject start
      console.log('[149.7][PROJECT-FIX] fixProject started', {
        maxFiles,
        activeProfileId: state.activeProfileId,
        summariesCount: state.summaries.length,
        totalIssues: state.totalIssues,
      });

      // Get files with issues that have filtered issues based on active profile
      // Phase 124.9.3: Filter out backup/excluded folders
      // Phase 184.2: Use relativePath instead of filePath to avoid false positives
      const filesToFix = state.summaries
        .filter((summary) => !isBackupFolder(summary.relativePath))
        .map((summary) => {
          const filteredIssues = filterIssuesByProfile(summary.issues, state.activeProfileId);
          // Only include files that have fixable issues (not security, not syntax errors)
          const autoFixableIssues = filteredIssues.filter(
            (i) =>
              i.category !== 'security' &&
              !i.message.includes('JSON Syntax Error') &&
              !i.message.includes('Duplicate key')
          );
          return { summary, filteredIssues, autoFixableCount: autoFixableIssues.length };
        })
        .filter((f) => f.autoFixableCount > 0)
        .slice(0, maxFiles);

      if (filesToFix.length === 0) {
        console.log('[ProjectIssuesContext] No files to fix');
        return;
      }

      console.log(`[ProjectIssuesContext] Starting project fix: ${filesToFix.length} files`);

      // Set initial state
      setState((prev) => ({
        ...prev,
        isFixingProject: true,
        fixedFilesCount: 0,
        totalFilesToFix: filesToFix.length,
        fixCancelled: false,
        error: null,
        retriedFilesCount: 0,
        currentlyFixingFiles: [],
      }));

      let fixedCount = 0;
      let retriedCount = 0;

      // Phase 124.9.2: Parallel Fix Engine - process files in batches of 3
      const CONCURRENCY = 3;

      for (let i = 0; i < filesToFix.length; i += CONCURRENCY) {
        // Check if cancelled
        let shouldCancel = false;
        setState((prev) => {
          shouldCancel = prev.fixCancelled;
          return prev;
        });

        if (shouldCancel) {
          console.log('[ProjectIssuesContext] Fix cancelled by user');
          break;
        }

        // Get the current batch of files
        const batch = filesToFix.slice(i, i + CONCURRENCY);
        const batchPaths = batch.map((f) => f.summary.relativePath);

        console.log(`[ProjectIssuesContext] Processing batch ${Math.floor(i / CONCURRENCY) + 1}: ${batchPaths.join(', ')}`);

        // Update currently fixing files
        setState((prev) => ({
          ...prev,
          currentlyFixingFiles: batchPaths,
        }));

        // Phase 124.9.2: Run fixes in parallel
        const results = await Promise.allSettled(
          batch.map(async ({ summary, filteredIssues }) => {
            // Phase 124.9.1: Use retry logic
            const result = await tryFixFileWithRetry(fixFileFn, summary, filteredIssues, 2);
            return { summary, result };
          })
        );

        // Process results
        for (const settledResult of results) {
          if (settledResult.status === 'fulfilled') {
            const { summary, result } = settledResult.value;
            if (result.success) {
              fixedCount++;
              console.log(`[ProjectIssuesContext] Fixed ${summary.relativePath}: ${result.fixedCount ?? 0} issues`);
            } else {
              console.warn(`[ProjectIssuesContext] Failed to fix ${summary.relativePath}: ${result.error}`);
            }
            if (result.retried) {
              retriedCount++;
            }
          } else {
            console.error('[ProjectIssuesContext] Unexpected error in batch:', settledResult.reason);
          }
        }

        // Update progress
        setState((prev) => ({
          ...prev,
          fixedFilesCount: fixedCount,
          retriedFilesCount: retriedCount,
        }));
      }

      // Complete
      console.log(`[ProjectIssuesContext] Project fix complete: ${fixedCount}/${filesToFix.length} files fixed (${retriedCount} retried)`);

      // Phase 149.7: Log fixProject end
      console.log('[149.7][PROJECT-FIX] fixProject completed', {
        fixedCount,
        totalFilesToFix: filesToFix.length,
        retriedCount,
      });

      setState((prev) => ({
        ...prev,
        isFixingProject: false,
        fixedFilesCount: fixedCount,
        retriedFilesCount: retriedCount,
        currentlyFixingFiles: [],
      }));

      // Phase 124.9.4: Auto Scan After Fix
      // Phase 125.2: Pass 'auto_fix_after_scan' as source for Code Health tracking
      if (fixedCount > 0) {
        console.log('[ProjectIssuesContext] Auto-scanning project after fixes...');
        // Small delay to let file system settle
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await scanProject(200, 'auto_fix_after_scan');
      }
    },
    [state.summaries, state.activeProfileId, isBackupFolder, tryFixFileWithRetry, scanProject]
  );

  const getFileIssues = useCallback(
    (filePath: string): FileIssuesSummary | null => {
      return state.summaries.find((s) => s.filePath === filePath) ?? null;
    },
    [state.summaries]
  );

  const removeFileSummary = useCallback((filePath: string) => {
    setState((prev) => {
      const removed = prev.summaries.find((s) => s.filePath === filePath);
      if (!removed) return prev;

      return {
        ...prev,
        summaries: prev.summaries.filter((s) => s.filePath !== filePath),
        totalIssues: prev.totalIssues - removed.issueCount,
        totalErrors: prev.totalErrors - removed.errors,
        totalWarnings: prev.totalWarnings - removed.warnings,
        totalInfos: prev.totalInfos - removed.infos,
      };
    });
  }, []);

  const updateFileSummary = useCallback(
    (filePath: string, summary: FileIssuesSummary) => {
      setState((prev) => {
        const oldSummary = prev.summaries.find((s) => s.filePath === filePath);
        const newSummaries = prev.summaries.map((s) =>
          s.filePath === filePath ? summary : s
        );

        // Recalculate totals
        const oldIssueCount = oldSummary?.issueCount ?? 0;
        const oldErrors = oldSummary?.errors ?? 0;
        const oldWarnings = oldSummary?.warnings ?? 0;
        const oldInfos = oldSummary?.infos ?? 0;

        return {
          ...prev,
          summaries: newSummaries,
          totalIssues: prev.totalIssues - oldIssueCount + summary.issueCount,
          totalErrors: prev.totalErrors - oldErrors + summary.errors,
          totalWarnings: prev.totalWarnings - oldWarnings + summary.warnings,
          totalInfos: prev.totalInfos - oldInfos + summary.infos,
        };
      });
    },
    []
  );

  // Phase 127.1: Background Watcher + Phase 127.3: Auto-Fix after Background Scan
  useEffect(() => {
    // Skip if background watcher is disabled
    if (!BACKGROUND_WATCHER_ENABLED) return;

    // Skip if no project is open
    if (!projectPath) return;

    console.log('[BackgroundWatcher] Initializing background watcher...');

    const checkAndScan = async () => {
      // Skip if already scanning or fixing
      if (state.isScanning || state.isFixingProject || backgroundScanInProgressRef.current) {
        console.log('[BackgroundWatcher] Skip: operation already in progress');
        return;
      }

      // Check if project is open
      if (!projectPath) {
        console.log('[BackgroundWatcher] Skip: no project open');
        return;
      }

      // Check time since last scan
      const now = Date.now();
      const timeSinceLastScan = state.lastScanTime ? now - state.lastScanTime : Infinity;

      if (timeSinceLastScan < BACKGROUND_SCAN_INTERVAL_MS) {
        console.log(`[BackgroundWatcher] Skip: scanned ${Math.round(timeSinceLastScan / 1000)}s ago`);
        return;
      }

      // Check if user is idle (if required)
      if (BACKGROUND_SCAN_IDLE_ONLY) {
        const timeSinceActivity = now - lastActivityRef.current;
        if (timeSinceActivity < BACKGROUND_IDLE_THRESHOLD_MS) {
          console.log(`[BackgroundWatcher] Skip: user active ${Math.round(timeSinceActivity / 1000)}s ago`);
          return;
        }
      }

      // Run background scan
      console.log('[BackgroundWatcher] Starting background scan...');
      backgroundScanInProgressRef.current = true;

      try {
        await scanProject(BACKGROUND_SCAN_MAX_FILES);

        // Phase 127.3: After scan, check health score and trigger auto-fix if needed
        if (AUTO_FIX_AFTER_BG_SCAN_ENABLED && fixFileFn) {
          // Get current summaries from state after scan
          setState((prev) => {
            const healthScore = calculateHealthScore(prev.summaries);
            console.log(`[BackgroundWatcher] Health score: ${healthScore}`);

            if (healthScore < AUTO_FIX_SAFE_MIX_THRESHOLD_SCORE) {
              console.log(`[BackgroundWatcher] Health score ${healthScore} below threshold ${AUTO_FIX_SAFE_MIX_THRESHOLD_SCORE}, triggering auto-fix...`);

              // Trigger auto-fix asynchronously
              setTimeout(() => {
                // Temporarily set profile to the configured auto-fix profile
                const currentProfile = prev.activeProfileId;
                if (AUTO_FIX_BG_SCAN_PROFILE !== currentProfile) {
                  setState((s) => ({ ...s, activeProfileId: AUTO_FIX_BG_SCAN_PROFILE as FixProfileId }));
                }

                fixProject(fixFileFn, AUTO_FIX_SAFE_MIX_MAX_FILES).then(() => {
                  // Restore profile if changed
                  if (AUTO_FIX_BG_SCAN_PROFILE !== currentProfile) {
                    setState((s) => ({ ...s, activeProfileId: currentProfile }));
                  }
                });
              }, 1000);
            }

            return prev;
          });
        }
      } catch (e) {
        console.error('[BackgroundWatcher] Scan error:', e);
      } finally {
        backgroundScanInProgressRef.current = false;
      }
    };

    // Set up the interval
    const intervalId = setInterval(checkAndScan, BACKGROUND_CHECK_INTERVAL_MS);

    // Run initial check after a delay
    const initialTimeoutId = setTimeout(checkAndScan, 10000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(initialTimeoutId);
    };
  }, [projectPath, state.isScanning, state.isFixingProject, state.lastScanTime, scanProject, fixProject, fixFileFn]);

  const value = useMemo<ProjectIssuesContextValue>(
    () => ({
      ...state,
      scanProject,
      clearProjectIssues,
      getFileIssues,
      removeFileSummary,
      updateFileSummary,
      // Phase 124.8.x: Profile functions
      setActiveProfile,
      getFilteredIssues,
      // Phase 124.9: Project fix functions
      fixProject,
      cancelProjectFix,
      // Phase 124.9.3: Backup folder check
      isBackupFolder,
      // Phase 141.0: Auto-Fix Orchestrator
      runAutoFix,
      // Phase 145.3: ACE-Guided Auto-Fix
      buildAceGuidedPlanForCurrentScan,
      runAceGuidedAutoFix,
      // Phase 145.5.2: Expose projectRoot for telemetry
      projectRoot: projectPath ?? null,
    }),
    [state, scanProject, clearProjectIssues, getFileIssues, removeFileSummary, updateFileSummary, setActiveProfile, getFilteredIssues, fixProject, cancelProjectFix, isBackupFolder, runAutoFix, buildAceGuidedPlanForCurrentScan, runAceGuidedAutoFix, projectPath]
  );

  return (
    <ProjectIssuesContext.Provider value={value}>
      {children}
    </ProjectIssuesContext.Provider>
  );
}

/**
 * Hook to access project-wide issues state
 */
export function useProjectIssues(): ProjectIssuesContextValue {
  const ctx = useContext(ProjectIssuesContext);
  if (!ctx) {
    throw new Error('useProjectIssues must be used within ProjectIssuesProvider');
  }
  return ctx;
}

/**
 * Hook to get files with issues sorted by severity
 */
export function useFilesWithIssues(): FileIssuesSummary[] {
  const { summaries } = useProjectIssues();
  return useMemo(() => {
    // Sort by errors first, then warnings, then total issues
    return [...summaries].sort((a, b) => {
      if (a.errors !== b.errors) return b.errors - a.errors;
      if (a.warnings !== b.warnings) return b.warnings - a.warnings;
      return b.issueCount - a.issueCount;
    });
  }, [summaries]);
}

export default ProjectIssuesProvider;
