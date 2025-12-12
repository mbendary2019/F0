// src/hooks/useFileIssues.ts
// =============================================================================
// Phase 152.5 – Map runtime issues to Monaco decorations
// Phase 154.0 – useFileIssuesForFile selector for Monaco integration
// Fetches issues from projectRuntime and maps them to specific files
// =============================================================================
// PHASE 154 – INLINE ISSUES & INLINE ACE (WEB IDE) – LOCKED
// Any major behavioural changes require Phase >= 160.
// =============================================================================

'use client';

import { useMemo } from 'react';
import { useProjectRuntime } from '@/hooks/useProjectRuntime';
import type { FileIssueForEditor } from '@/types/fileIssues';

// =============================================================================
// Types
// =============================================================================
export type FileIssue = {
  id: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  source?: string; // e.g., 'eslint', 'typescript', 'security'
  ruleId?: string;
};

// =============================================================================
// Hook
// =============================================================================
export function useFileIssues(
  projectId: string | null,
  relativePath: string | null
): FileIssue[] {
  const runtime = useProjectRuntime(projectId ?? '');

  return useMemo(() => {
    if (!projectId || !relativePath) return [];

    const issues: FileIssue[] = [];

    // Extract issues from quality snapshot
    // The runtime.latestQuality might contain detailed issues per file
    // For now, this is a placeholder - you can enhance this when the quality
    // data structure includes per-file issues
    const quality = runtime.latestQuality;
    if (quality) {
      // Example: If quality has issues array with file info
      // This would be expanded based on actual data structure
      console.log('[152.5][WEB][ISSUES] Quality snapshot available', {
        projectId,
        relativePath,
        score: quality.score,
        totalIssues: quality.totalIssues,
      });
    }

    // Extract issues from security alerts if they reference files
    const security = runtime.securityStats;
    if (security?.totalAlerts && security.totalAlerts > 0) {
      // Placeholder: Would need actual alert data with file locations
      console.log('[152.5][WEB][ISSUES] Security alerts available', {
        projectId,
        alerts: security.totalAlerts,
      });
    }

    // Extract from tests status
    const tests = runtime.testsStats;
    if (tests?.status === 'failing') {
      // Placeholder: Would need actual test failure locations
      console.log('[152.5][WEB][ISSUES] Test failures available', {
        projectId,
        status: tests.status,
      });
    }

    // For now, return empty array until we have real issue data
    // This hook is ready to be connected to actual issue sources
    return issues;
  }, [projectId, relativePath, runtime.latestQuality, runtime.securityStats, runtime.testsStats]);
}

// =============================================================================
// Helper: Get issues count for a file (for UI badges)
// =============================================================================
export function useFileIssueCount(
  projectId: string | null,
  relativePath: string | null
): { errors: number; warnings: number; infos: number } {
  const issues = useFileIssues(projectId, relativePath);

  return useMemo(() => {
    let errors = 0;
    let warnings = 0;
    let infos = 0;

    for (const issue of issues) {
      if (issue.severity === 'error') errors++;
      else if (issue.severity === 'warning') warnings++;
      else infos++;
    }

    return { errors, warnings, infos };
  }, [issues]);
}

export default useFileIssues;

// =============================================================================
// Phase 154.0 – Demo issues for testing (remove in production)
// =============================================================================
const DEMO_FILE_ISSUES: Record<string, FileIssueForEditor[]> = {
  'src/app/page.tsx': [
    {
      id: 'demo-1',
      filePath: 'src/app/page.tsx',
      line: 5,
      column: 10,
      message: 'Consider using a more descriptive variable name',
      rule: 'naming-convention',
      severity: 'warning',
      source: 'ace',
    },
    {
      id: 'demo-2',
      filePath: 'src/app/page.tsx',
      line: 12,
      column: 1,
      message: 'Missing error boundary for async component',
      rule: 'react/error-boundary',
      severity: 'error',
      source: 'ace',
    },
    {
      id: 'demo-3',
      filePath: 'src/app/page.tsx',
      line: 18,
      column: 5,
      message: 'Accessibility: Button should have aria-label',
      rule: 'jsx-a11y/aria-label',
      severity: 'info',
      source: 'eslint',
    },
  ],
  'src/app/layout.tsx': [
    {
      id: 'demo-5',
      filePath: 'src/app/layout.tsx',
      line: 3,
      column: 1,
      message: 'Consider using next/font for better performance',
      rule: 'next/google-font-display',
      severity: 'info',
      source: 'next',
    },
    {
      id: 'demo-6',
      filePath: 'src/app/layout.tsx',
      line: 8,
      column: 1,
      message: 'Missing viewport meta configuration',
      rule: 'next/viewport',
      severity: 'warning',
      source: 'next',
    },
  ],
  'src/lib/utils.ts': [
    {
      id: 'demo-4',
      filePath: 'src/lib/utils.ts',
      line: 8,
      column: 1,
      message: 'Function formatDate can be optimized',
      rule: 'performance/memoize',
      severity: 'info',
      source: 'ace',
    },
  ],
  'src/components/Button.tsx': [
    {
      id: 'demo-7',
      filePath: 'src/components/Button.tsx',
      line: 2,
      column: 1,
      message: 'Missing forwardRef for component that accepts ref',
      rule: 'react/forward-ref',
      severity: 'warning',
      source: 'ace',
    },
  ],
  'package.json': [
    {
      id: 'demo-8',
      filePath: 'package.json',
      line: 5,
      column: 1,
      message: 'Dependency react has available update',
      rule: 'deps/outdated',
      severity: 'info',
      source: 'npm',
    },
  ],
};

// Fallback demo issues for any file (shows on line 1, 5, 10)
const FALLBACK_DEMO_ISSUES = (filePath: string): FileIssueForEditor[] => [
  {
    id: `fallback-error-${filePath}`,
    filePath,
    line: 1,
    column: 1,
    message: 'Demo Error: This is a sample error issue',
    rule: 'demo/error',
    severity: 'error',
    source: 'ace-demo',
  },
  {
    id: `fallback-warning-${filePath}`,
    filePath,
    line: 5,
    column: 1,
    message: 'Demo Warning: Consider refactoring this code',
    rule: 'demo/warning',
    severity: 'warning',
    source: 'ace-demo',
  },
  {
    id: `fallback-info-${filePath}`,
    filePath,
    line: 10,
    column: 1,
    message: 'Demo Info: This code could be optimized',
    rule: 'demo/info',
    severity: 'info',
    source: 'ace-demo',
  },
];

// =============================================================================
// Phase 154.0 – useFileIssuesForFile selector
// Returns issues for a specific file, ready for Monaco decorations
// =============================================================================
export function useFileIssuesForFile(
  filePath: string | null | undefined
): FileIssueForEditor[] {
  return useMemo(() => {
    if (!filePath) {
      console.log('[154.0][WEB][ISSUES] No filePath provided');
      return [];
    }

    // In demo mode, return demo issues
    const demoIssues = DEMO_FILE_ISSUES[filePath];
    if (demoIssues) {
      console.log('[154.0][WEB][ISSUES] Returning specific demo issues', {
        filePath,
        count: demoIssues.length,
      });
      return demoIssues;
    }

    // Fallback: return demo issues for any file so decorations are visible
    const fallbackIssues = FALLBACK_DEMO_ISSUES(filePath);
    console.log('[154.0][WEB][ISSUES] Returning fallback demo issues', {
      filePath,
      count: fallbackIssues.length,
    });
    return fallbackIssues;
  }, [filePath]);
}

// Re-export types
export type { FileIssueForEditor } from '@/types/fileIssues';
