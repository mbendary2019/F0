/**
 * Phase 53 Day 3 - Live Cursors & Selections
 * Monaco editor selection binding utilities
 */

import * as monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';
import type { RemoteCursor } from '../presence/types';

export type SelectionBindingOptions = {
  editor: editor.IStandaloneCodeEditor;
  onLocalSelection: (
    sel: {
      start: { line: number; column: number };
      end: { line: number; column: number };
    } | null
  ) => void;
  computeRects: (
    userId: string,
    selection: RemoteCursor['selection']
  ) => { x: number; y: number; width: number; height: number }[];
};

export function bindSelection({
  editor,
  onLocalSelection,
}: SelectionBindingOptions) {
  const disposables: monaco.IDisposable[] = [];

  const update = () => {
    const sel = editor.getSelection();
    if (!sel) return onLocalSelection(null);

    const start = { line: sel.startLineNumber, column: sel.startColumn };
    const end = { line: sel.endLineNumber, column: sel.endColumn };
    onLocalSelection({ start, end });
  };

  disposables.push(editor.onDidChangeCursorSelection(update));

  // Fire immediately
  update();

  return () => disposables.forEach((d) => d.dispose());
}
