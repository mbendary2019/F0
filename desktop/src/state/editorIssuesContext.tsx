// desktop/src/state/editorIssuesContext.tsx
// Phase 124.6: Editor Issues State Management

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { F0Issue } from '../lib/types/issues';

/**
 * Issues indexed by file path
 */
type IssuesByFile = Record<string, F0Issue[]>;

/**
 * Context value interface
 */
interface EditorIssuesContextValue {
  /** All issues indexed by file path */
  issuesByFile: IssuesByFile;
  /** Set issues for a specific file */
  setFileIssues: (filePath: string, issues: F0Issue[]) => void;
  /** Clear issues for a specific file */
  clearFileIssues: (filePath: string) => void;
  /** Get issues for a specific file */
  getIssuesForFile: (filePath: string) => F0Issue[];
  /** Get total issue count */
  getTotalIssueCount: () => number;
  /** Get issues by severity */
  getIssuesBySeverity: (severity: F0Issue['severity']) => F0Issue[];
  /** Clear all issues */
  clearAllIssues: () => void;
}

const EditorIssuesContext = createContext<EditorIssuesContextValue | null>(null);

/**
 * Provider component for editor issues state
 */
export function EditorIssuesProvider({ children }: { children: ReactNode }) {
  const [issuesByFile, setIssuesByFile] = useState<IssuesByFile>({});

  const setFileIssues = useCallback((filePath: string, issues: F0Issue[]) => {
    setIssuesByFile((prev) => ({
      ...prev,
      [filePath]: issues,
    }));
  }, []);

  const clearFileIssues = useCallback((filePath: string) => {
    setIssuesByFile((prev) => {
      const copy = { ...prev };
      delete copy[filePath];
      return copy;
    });
  }, []);

  const getIssuesForFile = useCallback(
    (filePath: string): F0Issue[] => {
      return issuesByFile[filePath] ?? [];
    },
    [issuesByFile]
  );

  const getTotalIssueCount = useCallback((): number => {
    return Object.values(issuesByFile).reduce(
      (total, issues) => total + issues.length,
      0
    );
  }, [issuesByFile]);

  const getIssuesBySeverity = useCallback(
    (severity: F0Issue['severity']): F0Issue[] => {
      return Object.values(issuesByFile)
        .flat()
        .filter((issue) => issue.severity === severity);
    },
    [issuesByFile]
  );

  const clearAllIssues = useCallback(() => {
    setIssuesByFile({});
  }, []);

  const value = useMemo<EditorIssuesContextValue>(
    () => ({
      issuesByFile,
      setFileIssues,
      clearFileIssues,
      getIssuesForFile,
      getTotalIssueCount,
      getIssuesBySeverity,
      clearAllIssues,
    }),
    [
      issuesByFile,
      setFileIssues,
      clearFileIssues,
      getIssuesForFile,
      getTotalIssueCount,
      getIssuesBySeverity,
      clearAllIssues,
    ]
  );

  return (
    <EditorIssuesContext.Provider value={value}>
      {children}
    </EditorIssuesContext.Provider>
  );
}

/**
 * Hook to access editor issues state
 */
export function useEditorIssues(): EditorIssuesContextValue {
  const ctx = useContext(EditorIssuesContext);
  if (!ctx) {
    throw new Error('useEditorIssues must be used within EditorIssuesProvider');
  }
  return ctx;
}

/**
 * Hook to get issues for a specific file
 */
export function useFileIssues(filePath: string): F0Issue[] {
  const { getIssuesForFile } = useEditorIssues();
  return getIssuesForFile(filePath);
}

export default EditorIssuesProvider;
