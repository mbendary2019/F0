// desktop/src/hooks/useCodeReview.ts
// Phase 124.6: Code Review Hook

import { useState, useCallback } from 'react';
import { useEditorIssues } from '../state/editorIssuesContext';
import type { F0Issue, CodeReviewResponse } from '../lib/types/issues';

interface UseCodeReviewOptions {
  /** File path to review */
  filePath: string;
  /** Project root path */
  projectRoot?: string;
  /** Auto-clear previous issues before new review */
  autoClear?: boolean;
}

interface UseCodeReviewReturn {
  /** Whether a review is in progress */
  loading: boolean;
  /** Last review error */
  error: string | null;
  /** Last review issues */
  lastIssues: F0Issue[] | null;
  /** Last review summary */
  lastSummary: string | null;
  /** Run code review on the file */
  runCodeReview: (params: { before?: string | null; after: string }) => Promise<F0Issue[]>;
  /** Clear issues for this file */
  clearIssues: () => void;
}

/**
 * Hook for running AI-powered code reviews
 */
export function useCodeReview({
  filePath,
  projectRoot,
  autoClear = true,
}: UseCodeReviewOptions): UseCodeReviewReturn {
  const { setFileIssues, clearFileIssues } = useEditorIssues();
  const [loading, setLoading] = useState(false);
  const [lastIssues, setLastIssues] = useState<F0Issue[] | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCodeReview = useCallback(
    async (params: { before?: string | null; after: string }): Promise<F0Issue[]> => {
      setLoading(true);
      setError(null);

      if (autoClear) {
        clearFileIssues(filePath);
      }

      try {
        // Check if the bridge is available
        const api = window.f0Desktop as Record<string, unknown> | undefined;
        if (!api?.codeReview || typeof api.codeReview !== 'function') {
          throw new Error('Code review bridge not available');
        }

        const codeReviewFn = api.codeReview as (input: {
          filePath: string;
          before?: string | null;
          after: string;
          projectRoot?: string;
        }) => Promise<CodeReviewResponse>;

        const response: CodeReviewResponse = await codeReviewFn({
          filePath,
          before: params.before ?? null,
          after: params.after,
          projectRoot,
        });

        if (!response.success) {
          throw new Error(response.error || 'Code review failed');
        }

        const issues: F0Issue[] = response.issues ?? [];
        setLastIssues(issues);
        setLastSummary(response.summary ?? null);
        setFileIssues(filePath, issues);

        console.log(`[useCodeReview] Found ${issues.length} issues in ${filePath}`);

        return issues;
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unexpected error in code review';
        console.error('[useCodeReview] Error:', errorMessage);
        setError(errorMessage);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [filePath, projectRoot, autoClear, setFileIssues, clearFileIssues]
  );

  const clearIssues = useCallback(() => {
    clearFileIssues(filePath);
    setLastIssues(null);
    setLastSummary(null);
    setError(null);
  }, [filePath, clearFileIssues]);

  return {
    loading,
    error,
    lastIssues,
    lastSummary,
    runCodeReview,
    clearIssues,
  };
}

export default useCodeReview;
