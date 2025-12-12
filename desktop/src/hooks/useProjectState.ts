// desktop/src/hooks/useProjectState.ts
import { useState } from 'react';
import type { EditorSelection } from '../types/editor';

export type F0FileNode = {
  type: 'dir' | 'file';
  name: string;
  path: string;
  children?: F0FileNode[];
};

/**
 * Phase 109.4.4: Undo Entry
 * Stores snapshot of file before AI changes for undo functionality
 */
export type UndoEntry = {
  path: string;
  previousContent: string;
  appliedAt: number; // Date.now()
  source: 'agent' | 'manual';
};

export type ProjectState = {
  rootPath: string | null;
  tree: F0FileNode[] | null;
  currentFilePath: string | null;
  currentContent: string;
  isDirty: boolean;
  isLoadingFile: boolean;
  undoStack: UndoEntry[];
  selection: EditorSelection | null;
  openFolder: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  updateContent: (next: string) => void;
  updateSelection: (start: number, end: number) => void;
  clearSelection: () => void;
  saveCurrentFile: () => Promise<void>;
  applyExternalFileChange: (path: string, content: string) => Promise<void>;
  pushUndoEntry: (entry: UndoEntry) => void;
  undoLastAgentChange: () => Promise<void>;
};

export function useProjectState(): ProjectState {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [tree, setTree] = useState<F0FileNode[] | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [selection, setSelection] = useState<EditorSelection | null>(null);

  const getApi = () => {
    if (typeof window === 'undefined') return null;
    return window.f0Desktop ?? null;
  };

  const openFolder = async () => {
    const api = getApi();
    if (!api) {
      console.warn('[F0 Desktop] f0Desktop API not available (run inside Electron).');
      return;
    }

    const result = await api.openFolder();
    if (!result) return;

    setRootPath(result.root);
    setTree(result.tree as F0FileNode[]);
    // reset current file
    setCurrentFilePath(null);
    setCurrentContent('');
    setIsDirty(false);

    // Phase 123: Set project root for indexer and auto-scan
    try {
      console.log('[F0 Desktop] Setting project root for indexer:', result.root);
      await api.setProjectRoot(result.root);

      // Check if index already exists
      const existingIndex = await api.getProjectIndex(result.root);
      if (!existingIndex) {
        console.log('[F0 Desktop] No existing index, auto-scanning project...');
        await api.scanProject(result.root);
        console.log('[F0 Desktop] ✅ Project indexed successfully');
      } else {
        console.log('[F0 Desktop] ✅ Existing index found with', existingIndex.totalFiles, 'files');
      }
    } catch (err) {
      console.error('[F0 Desktop] Failed to set project root or scan:', err);
    }
  };

  const openFile = async (path: string) => {
    const api = getApi();
    if (!api) {
      console.warn('[F0 Desktop] Cannot open file, f0Desktop API missing.');
      return;
    }
    setIsLoadingFile(true);
    try {
      const content = await api.readFile(path);
      setCurrentFilePath(path);
      setCurrentContent(content);
      setIsDirty(false);
    } catch (err) {
      console.error('[F0 Desktop] Failed to read file', err);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const updateContent = (next: string) => {
    setCurrentContent(next);
    setIsDirty(true);
  };

  const saveCurrentFile = async () => {
    if (!currentFilePath) return;
    const api = getApi();
    if (!api) {
      console.warn('[F0 Desktop] Cannot write file, f0Desktop API missing.');
      return;
    }

    try {
      await api.writeFile(currentFilePath, currentContent);
      setIsDirty(false);
    } catch (err) {
      console.error('[F0 Desktop] Failed to write file', err);
    }
  };

  /**
   * Phase 109.4.3: Apply external file changes (from Agent)
   * Writes to any file path and updates editor if it's the current file
   */
  const applyExternalFileChange = async (path: string, content: string) => {
    const api = getApi();
    if (!api) {
      console.warn('[F0 Desktop] Cannot write file (external change), f0Desktop API missing.');
      return;
    }

    try {
      await api.writeFile(path, content);
      console.log('[F0 Desktop] Applied external file change:', path);
      console.log('[F0 Desktop] Current file path:', currentFilePath);
      console.log('[F0 Desktop] Paths match?', path === currentFilePath);

      // If this is the currently open file, update the editor
      if (path === currentFilePath) {
        console.log('[F0 Desktop] ✅ Updating editor content, new length:', content.length);
        setCurrentContent(content);
        setIsDirty(false);
      } else {
        console.log('[F0 Desktop] ⚠️ Paths do NOT match - editor not updated');
        console.log('[F0 Desktop]   Expected:', currentFilePath);
        console.log('[F0 Desktop]   Got:', path);
      }
    } catch (err) {
      console.error('[F0 Desktop] Failed to apply external file change', err);
      throw err;
    }
  };

  /**
   * Phase 109.4.4: Push undo entry
   * Stores a snapshot before applying AI changes
   */
  const pushUndoEntry = (entry: UndoEntry) => {
    console.log('[F0 Desktop] Pushing undo entry:', entry.path);
    setUndoStack(prev => [...prev, entry]);
  };

  /**
   * Phase 109.5: Update selection from editor
   * Stores the user's current text selection for context-aware refactoring
   */
  const updateSelection = (start: number, end: number) => {
    if (!currentFilePath || !currentContent) {
      setSelection(null);
      return;
    }

    // Sanity checks for offsets
    const safeStart = Math.max(0, Math.min(start, currentContent.length));
    const safeEnd = Math.max(safeStart, Math.min(end, currentContent.length));

    // Only set selection if there's actually text selected
    if (safeEnd > safeStart) {
      const selectedText = currentContent.slice(safeStart, safeEnd);
      console.log('[F0 Desktop] Selection updated:', {
        filePath: currentFilePath,
        startOffset: safeStart,
        endOffset: safeEnd,
        length: selectedText.length,
        preview: selectedText.slice(0, 50) + (selectedText.length > 50 ? '...' : ''),
      });

      setSelection({
        filePath: currentFilePath,
        startOffset: safeStart,
        endOffset: safeEnd,
        selectedText,
      });
    } else {
      setSelection(null);
    }
  };

  /**
   * Phase 109.5: Clear selection
   */
  const clearSelection = () => {
    setSelection(null);
  };

  /**
   * Phase 109.4.4: Undo last AI change
   * Reverts the last AI-applied change
   */
  const undoLastAgentChange = async () => {
    if (undoStack.length === 0) {
      console.warn('[F0 Desktop] No changes to undo');
      return;
    }

    const last = undoStack[undoStack.length - 1];
    console.log('[F0 Desktop] Undoing change for:', last.path);

    const api = getApi();
    if (!api) {
      console.warn('[F0 Desktop] Cannot undo, f0Desktop API missing.');
      return;
    }

    try {
      await api.writeFile(last.path, last.previousContent);
      console.log('[F0 Desktop] ✅ Undo applied for', last.path);

      // If the file is currently open, update the editor
      if (currentFilePath === last.path) {
        setCurrentContent(last.previousContent);
        setIsDirty(false);
      }

      // Remove from undo stack
      setUndoStack(prev => prev.slice(0, -1));
    } catch (err) {
      console.error('[F0 Desktop] Failed to undo change', err);
      throw err;
    }
  };

  return {
    rootPath,
    tree,
    currentFilePath,
    currentContent,
    isDirty,
    isLoadingFile,
    undoStack,
    selection,
    openFolder,
    openFile,
    updateContent,
    updateSelection,
    clearSelection,
    saveCurrentFile,
    applyExternalFileChange,
    pushUndoEntry,
    undoLastAgentChange,
  };
}
