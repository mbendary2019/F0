// desktop/src/components/ace/AcePanelWrapper.tsx
// Phase 129.5: ACE Panel Wrapper with Full Executor Integration
// Phase 133.3: Added auto-run tests after ACE fixes
// Phase 148.0: Added ACE Last Run Summary Card
// Connects AcePanel with executor, snapshots, and recompute

import React, { useCallback, useState } from 'react';
import { AcePanel } from './AcePanel';
import type { AceSuggestion, AcePlanPhase } from '../../lib/ace/aceTypes';
import type { AcePlannedAction, AceActionType } from '../../lib/ace/aceActions';
import { executePhase, type ActionExecutorFn, type AceActionResult } from '../../lib/ace/aceExecutor';
import { createSnapshot } from '../../lib/ace/aceSnapshots';
import { useAce } from '../../state/aceContext';
import { useProjectIssues } from '../../state/projectIssuesContext';
import type { FixProfileId } from '../../lib/analysis/fixProfiles';
// Phase 133.3: Test auto-run integration
import { useTestLab } from '../../state/testLabContext';
import { useTestSettingsValue } from '../../state/testSettingsContext';
// Phase 148.0: ACE Last Run Summary Card
import { AceLastRunSummaryCard } from './AceLastRunSummaryCard';

/**
 * Props for AcePanelWrapper
 * Phase 129.9: Updated return types for more informative results
 * Phase 133.2: Added initialPrompt for test generation
 */
interface Props {
  locale?: 'ar' | 'en';
  projectRoot: string;
  /** Called when files need to be fixed via fix profile */
  onFixFiles?: (filePaths: string[], profileId: string) => Promise<{
    success: boolean;
    fixedCount: number;
    noChanges?: boolean; // Phase 129.9: True if no auto-fixable issues found
  }>;
  /** Called when files need to be opened in editor */
  onOpenFiles?: (filePaths: string[]) => void;
  /** Called when files need to be deleted (Phase 129.9: Now marks for review instead) */
  onDeleteFiles?: (filePaths: string[]) => Promise<{
    success: boolean;
    deletedCount?: number;
    markedForReview?: number; // Phase 129.9: Files opened for manual review
    message?: string;
  }>;
  /** Called when project scan is requested */
  onScanProject?: () => Promise<void>;
  /** Phase 133.2: Initial prompt for test generation */
  initialPrompt?: string | null;
  /** Phase 133.2: Called to clear the initial prompt */
  onClearPrompt?: () => void;
}

/**
 * AcePanelWrapper - Full integration of ACE execution
 */
export const AcePanelWrapper: React.FC<Props> = ({
  locale = 'en',
  projectRoot,
  onFixFiles,
  onOpenFiles,
  onDeleteFiles,
  onScanProject,
  initialPrompt,
  onClearPrompt,
}) => {
  const { suggestions, recompute, completePhase, startPhase } = useAce();
  const { scanProject } = useProjectIssues();
  // Phase 133.3: Test auto-run hooks
  const { runTestsForFiles } = useTestLab();
  const testSettings = useTestSettingsValue();

  const [isExecuting, setIsExecuting] = useState(false);

  /**
   * Create action executor function
   */
  const createActionExecutor = useCallback((): ActionExecutorFn => {
    return async (action: AcePlannedAction): Promise<AceActionResult> => {
      const startTime = Date.now();

      try {
        switch (action.type) {
          case 'run_fix_profile': {
            if (!onFixFiles || !action.files || !action.profileId) {
              return {
                actionId: action.id,
                success: false,
                error: 'Fix files handler not configured',
              };
            }

            const result = await onFixFiles(action.files, action.profileId);
            // Phase 129.9: Provide informative message when no auto-fixes available
            return {
              actionId: action.id,
              success: result.success,
              filesFixed: result.fixedCount,
              noChanges: result.noChanges,
              message: result.noChanges
                ? 'No automatic fixes available. Review issues manually in Project Issues panel.'
                : `Applied ${result.fixedCount} fixes`,
              durationMs: Date.now() - startTime,
            };
          }

          case 'open_files_in_editor': {
            if (!onOpenFiles || !action.files) {
              return {
                actionId: action.id,
                success: false,
                error: 'Open files handler not configured',
              };
            }

            onOpenFiles(action.files);
            return {
              actionId: action.id,
              success: true,
              filesOpened: action.files.length,
              durationMs: Date.now() - startTime,
            };
          }

          case 'delete_files': {
            if (!onDeleteFiles || !action.files) {
              return {
                actionId: action.id,
                success: false,
                error: 'Delete files handler not configured',
              };
            }

            // Phase 129.9: Now marks files for review instead of deleting
            const result = await onDeleteFiles(action.files);
            return {
              actionId: action.id,
              success: result.success,
              filesMarkedForReview: result.markedForReview || result.deletedCount || 0,
              message: result.message || 'Files marked for manual review',
              durationMs: Date.now() - startTime,
            };
          }

          case 'run_project_scan': {
            if (onScanProject) {
              await onScanProject();
            } else if (scanProject) {
              await scanProject();
            }
            return {
              actionId: action.id,
              success: true,
              durationMs: Date.now() - startTime,
            };
          }

          case 'noop':
          default: {
            // No operation - manual action
            return {
              actionId: action.id,
              success: true,
              durationMs: Date.now() - startTime,
            };
          }
        }
      } catch (err) {
        return {
          actionId: action.id,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          durationMs: Date.now() - startTime,
        };
      }
    };
  }, [onFixFiles, onOpenFiles, onDeleteFiles, onScanProject, scanProject]);

  /**
   * Create snapshot creator function
   */
  const createSnapshotCreator = useCallback(
    (phase: AcePlanPhase) => {
      return async (reason: string): Promise<string> => {
        // Get all target files from phase suggestions
        const phaseSuggestions = suggestions.filter(s =>
          phase.suggestionIds.includes(s.id)
        );
        const targetFiles = [...new Set(phaseSuggestions.flatMap(s => s.targetFiles))];

        const snapshot = await createSnapshot(
          projectRoot,
          targetFiles,
          reason,
          {
            phaseId: phase.id,
            actionCount: targetFiles.length,
          }
        );

        return snapshot.id;
      };
    },
    [projectRoot, suggestions]
  );

  /**
   * Handle running a phase
   */
  const handleRunPhase = useCallback(
    async (phase: AcePlanPhase, actions: AcePlannedAction[]) => {
      if (isExecuting) {
        console.warn('[ACE Wrapper] Already executing a phase');
        return;
      }

      setIsExecuting(true);
      console.log('[ACE Wrapper] Starting phase execution:', phase.id);

      try {
        // Mark phase as in progress
        startPhase(phase.id);

        // Create executor and snapshot creator
        const executor = createActionExecutor();
        const snapshotCreator = createSnapshotCreator(phase);

        // Execute the phase
        const result = await executePhase(
          phase,
          suggestions,
          executor,
          snapshotCreator,
          {
            createSnapshot: true,
            continueOnError: true,
            onProgress: (state) => {
              console.log('[ACE Wrapper] Progress:', state.progress, '%');
            },
            onActionComplete: (actionResult, state) => {
              console.log('[ACE Wrapper] Action complete:', actionResult.actionId, actionResult.success);
            },
          }
        );

        // Mark phase as completed
        completePhase(phase.id);

        // Phase 133.3: Extract changed files from successful actions
        const changedFiles: string[] = [];
        const newTestFiles: string[] = [];
        for (const actionResult of result.results) {
          if (actionResult.success && actionResult.metadata?.filePath) {
            const filePath = actionResult.metadata.filePath as string;
            changedFiles.push(filePath);
            // Check if this is a new test file
            if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath)) {
              newTestFiles.push(filePath);
            }
          }
        }

        // Phase 133.3: Auto-run newly generated tests if enabled
        if (testSettings.autoRunAfterGenerate && newTestFiles.length > 0) {
          console.log('[ACE Wrapper] Auto-running newly generated tests:', newTestFiles);
          setTimeout(() => {
            runTestsForFiles(newTestFiles, 'generate_tests').then((testResult) => {
              console.log('[ACE Wrapper] Generated test result:', testResult);
            }).catch((err) => {
              console.error('[ACE Wrapper] Generated test error:', err);
            });
          }, 300);
        }
        // Phase 133.3: Auto-run tests for changed source files if enabled (only if no new tests)
        else if (testSettings.autoRunAfterAce && changedFiles.length > 0 && newTestFiles.length === 0) {
          console.log('[ACE Wrapper] Auto-running tests for changed files:', changedFiles);
          // Run tests after a short delay to let files settle
          setTimeout(() => {
            runTestsForFiles(changedFiles, 'ace_auto').then((testResult) => {
              console.log('[ACE Wrapper] Auto-test result:', testResult);
            }).catch((err) => {
              console.error('[ACE Wrapper] Auto-test error:', err);
            });
          }, 300);
        }

        // Trigger recompute with 'phase_complete' trigger
        console.log('[ACE Wrapper] Phase completed, triggering recompute...');

        // Small delay to let file changes settle
        setTimeout(() => {
          // First, rescan the project to get updated issues
          if (scanProject) {
            scanProject().then(() => {
              // After rescan, recompute ACE
              recompute('phase_complete');
            });
          } else {
            // Just recompute ACE
            recompute('phase_complete');
          }
        }, 500);

        console.log('[ACE Wrapper] Phase execution result:', {
          phaseId: phase.id,
          status: result.status,
          successActions: result.results.filter(r => r.success).length,
          failedActions: result.results.filter(r => !r.success).length,
          snapshotId: result.snapshotId,
          changedFiles: changedFiles.length,
        });

      } catch (err) {
        console.error('[ACE Wrapper] Phase execution error:', err);
      } finally {
        setIsExecuting(false);
      }
    },
    [
      isExecuting,
      suggestions,
      startPhase,
      completePhase,
      recompute,
      scanProject,
      createActionExecutor,
      createSnapshotCreator,
      testSettings.autoRunAfterAce,
      testSettings.autoRunAfterGenerate,
      runTestsForFiles,
    ]
  );

  /**
   * Handle applying a suggestion
   */
  const handleApplySuggestion = useCallback(
    (suggestion: AceSuggestion) => {
      console.log('[ACE Wrapper] Apply suggestion:', suggestion.id);
      // For now, just open files for manual review
      if (onOpenFiles && suggestion.targetFiles.length > 0) {
        onOpenFiles(suggestion.targetFiles);
      }
    },
    [onOpenFiles]
  );

  const isRTL = locale === 'ar';

  // Phase 133.2: Handle copy prompt to clipboard
  const handleCopyPrompt = useCallback(() => {
    if (initialPrompt) {
      navigator.clipboard.writeText(initialPrompt).then(() => {
        console.log('[AcePanelWrapper] Prompt copied to clipboard');
      });
    }
  }, [initialPrompt]);

  return (
    <div className="flex flex-col h-full">
      {/* Phase 133.2: Test Generation Prompt Banner */}
      {initialPrompt && (
        <div className="bg-teal-900/30 border-b border-teal-500/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧪</span>
              <span className="text-sm font-medium text-teal-300">
                {isRTL ? 'توليد اختبارات' : 'Generate Tests'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyPrompt}
                className="rounded-full bg-teal-800/50 border border-teal-500/40 px-2.5 py-1 text-[10px] font-medium text-teal-200 hover:bg-teal-700/50 transition-colors"
              >
                {isRTL ? '📋 نسخ' : '📋 Copy'}
              </button>
              {onClearPrompt && (
                <button
                  onClick={onClearPrompt}
                  className="rounded-full bg-white/10 border border-white/20 px-2 py-1 text-[10px] text-white/70 hover:bg-white/20 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-teal-200/70 mb-2">
            {isRTL
              ? 'انسخ هذا الـ Prompt وألصقه في الـ Agent لتوليد اختبارات للملف.'
              : 'Copy this prompt and paste it to the Agent to generate tests for the file.'}
          </p>
          <div className="bg-black/30 rounded-lg p-2 max-h-32 overflow-y-auto">
            <pre className="text-[10px] text-teal-100/80 whitespace-pre-wrap font-mono">
              {initialPrompt.slice(0, 500)}
              {initialPrompt.length > 500 ? '...' : ''}
            </pre>
          </div>
        </div>
      )}

      {/* Phase 148.0: ACE Last Run Summary Card */}
      <div className="p-2 border-b border-slate-800/40">
        <AceLastRunSummaryCard locale={locale} projectRoot={projectRoot} />
      </div>

      {/* ACE Panel */}
      <div className="flex-1 overflow-hidden">
        <AcePanel
          locale={locale}
          onApplySuggestion={handleApplySuggestion}
          onRunPhase={handleRunPhase}
        />
      </div>
    </div>
  );
};

export default AcePanelWrapper;
