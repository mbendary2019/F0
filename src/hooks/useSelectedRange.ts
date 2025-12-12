// src/hooks/useSelectedRange.ts
// =============================================================================
// Phase 153.0 – Selection Engine
// Tracks cursor position and text selection in Monaco editor
// =============================================================================
// NOTE: NOT LOCKED YET - Phase 153 is in progress
// =============================================================================

'use client';

import { useCallback, useState } from 'react';
import type { editor } from 'monaco-editor';

// =============================================================================
// Types
// =============================================================================
export type SelectedRangeInfo = {
  cursorLine: number | null;
  cursorColumn: number | null;
  selectionStartLine: number | null;
  selectionStartColumn: number | null;
  selectionEndLine: number | null;
  selectionEndColumn: number | null;
  selectedText: string | null;
};

// =============================================================================
// Hook
// =============================================================================
export function useSelectedRange() {
  const [selectedRange, setSelectedRange] = useState<SelectedRangeInfo | null>(null);

  const updateFromEditor = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor) => {
      const model = editorInstance.getModel();
      const selection = editorInstance.getSelection();

      if (!model || !selection) {
        setSelectedRange(null);
        return;
      }

      const {
        startLineNumber,
        startColumn,
        endLineNumber,
        endColumn,
      } = selection;

      const selectedText = model.getValueInRange(selection);

      const cursorPosition = editorInstance.getPosition();
      const cursorLine = cursorPosition?.lineNumber ?? null;
      const cursorColumn = cursorPosition?.column ?? null;

      const info: SelectedRangeInfo = {
        cursorLine,
        cursorColumn,
        selectionStartLine: startLineNumber,
        selectionStartColumn: startColumn,
        selectionEndLine: endLineNumber,
        selectionEndColumn: endColumn,
        selectedText: selectedText || null,
      };

      console.log(
        '[153.0][WEB][SELECT] range updated',
        `cursor=(${cursorLine}:${cursorColumn})`,
        `selection=(${startLineNumber}:${startColumn})→(${endLineNumber}:${endColumn})`,
        `len=${selectedText.length}`
      );

      setSelectedRange(info);
    },
    []
  );

  /**
   * Bind the hook to the editor and subscribe to selection changes.
   * Returns a disposable for cleanup.
   */
  const bindToEditor = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor) => {
      // Initial update from current state
      updateFromEditor(editorInstance);

      const disposable = editorInstance.onDidChangeCursorSelection(() => {
        updateFromEditor(editorInstance);
      });

      return disposable;
    },
    [updateFromEditor]
  );

  /**
   * Clear the selection state
   */
  const clearSelection = useCallback(() => {
    setSelectedRange(null);
  }, []);

  return {
    selectedRange,
    bindToEditor,
    clearSelection,
  };
}

export default useSelectedRange;
