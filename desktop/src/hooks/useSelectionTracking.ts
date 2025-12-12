// desktop/src/hooks/useSelectionTracking.ts
import { useCallback, useRef } from 'react';
import type * as Monaco from 'monaco-editor';
import type { EditorSelection } from '../types/editor';

export type UseSelectionTrackingOptions = {
  filePath: string | null;
  // content is passed for future use (e.g., content-based selection validation)
  content?: string;
  onSelectionChange: (selection: EditorSelection | null) => void;
};

/**
 * Phase 109.5.1: Monaco Editor Selection Tracking Hook
 *
 * This hook provides Monaco Editor integration for tracking user text selections.
 * It uses Monaco's onDidChangeCursorSelection API for precise selection tracking.
 */
export function useSelectionTracking({
  filePath,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  content: _content,
  onSelectionChange,
}: UseSelectionTrackingOptions) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);

  /**
   * Called when Monaco Editor mounts
   */
  const handleEditorDidMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Listen for selection changes
      editor.onDidChangeCursorSelection((e) => {
        if (!filePath) {
          onSelectionChange(null);
          return;
        }

        const selection = e.selection;
        const model = editor.getModel();
        if (!model) {
          onSelectionChange(null);
          return;
        }

        // Check if there's actually a selection (not just cursor position)
        const isEmpty = selection.isEmpty();
        if (isEmpty) {
          onSelectionChange(null);
          return;
        }

        // Get the selected text
        const selectedText = model.getValueInRange(selection);
        if (!selectedText || selectedText.length === 0) {
          onSelectionChange(null);
          return;
        }

        // Convert Monaco positions to character offsets
        const startOffset = model.getOffsetAt(selection.getStartPosition());
        const endOffset = model.getOffsetAt(selection.getEndPosition());

        console.log('[F0 Monaco] Selection changed:', {
          filePath,
          startOffset,
          endOffset,
          length: selectedText.length,
          preview: selectedText.slice(0, 50) + (selectedText.length > 50 ? '...' : ''),
        });

        onSelectionChange({
          filePath,
          startOffset,
          endOffset,
          selectedText,
        });
      });

      // Focus the editor
      editor.focus();
    },
    [filePath, onSelectionChange]
  );

  /**
   * Get current selection programmatically
   */
  const getCurrentSelection = useCallback((): EditorSelection | null => {
    const editor = editorRef.current;
    if (!editor || !filePath) return null;

    const selection = editor.getSelection();
    const model = editor.getModel();
    if (!selection || !model || selection.isEmpty()) return null;

    const selectedText = model.getValueInRange(selection);
    if (!selectedText) return null;

    const startOffset = model.getOffsetAt(selection.getStartPosition());
    const endOffset = model.getOffsetAt(selection.getEndPosition());

    return {
      filePath,
      startOffset,
      endOffset,
      selectedText,
    };
  }, [filePath]);

  /**
   * Set selection programmatically (useful for highlighting code from agent)
   */
  const setSelection = useCallback(
    (startOffset: number, endOffset: number) => {
      const editor = editorRef.current;
      if (!editor) return;

      const model = editor.getModel();
      if (!model) return;

      const startPos = model.getPositionAt(startOffset);
      const endPos = model.getPositionAt(endOffset);

      editor.setSelection({
        startLineNumber: startPos.lineNumber,
        startColumn: startPos.column,
        endLineNumber: endPos.lineNumber,
        endColumn: endPos.column,
      });

      // Reveal the selection
      editor.revealRangeInCenter({
        startLineNumber: startPos.lineNumber,
        startColumn: startPos.column,
        endLineNumber: endPos.lineNumber,
        endColumn: endPos.column,
      });
    },
    []
  );

  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const position = editor.getPosition();
    if (position) {
      editor.setSelection({
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
    }
    onSelectionChange(null);
  }, [onSelectionChange]);

  return {
    editorRef,
    monacoRef,
    handleEditorDidMount,
    getCurrentSelection,
    setSelection,
    clearSelection,
  };
}
