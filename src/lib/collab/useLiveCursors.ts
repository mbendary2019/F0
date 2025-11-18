// src/lib/collab/useLiveCursors.ts
// Phase 53 Day 3: Live Cursors & Selection Highlights for Monaco

import { useEffect, useRef, useState } from 'react';
import type * as monaco from 'monaco-editor';
import type { Awareness } from 'y-protocols/awareness';

export interface CursorPosition {
  lineNumber: number;
  column: number;
}

export interface SelectionRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface CursorState {
  position: CursorPosition;
  selection?: SelectionRange | null;
  color: string;
  name: string;
  clientId: number;
}

/**
 * Hook to render live cursors and selections in Monaco Editor
 *
 * Features:
 * - Real-time cursor positions
 * - Selection highlights
 * - User name labels
 * - Color-coded per user
 *
 * @param editor - Monaco editor instance
 * @param awareness - Y.js Awareness instance
 * @param localColor - Current user's color
 * @param localName - Current user's name
 *
 * @returns { remoteCursors: CursorState[] }
 */
export function useLiveCursors(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  awareness: Awareness | null,
  localColor?: string,
  localName?: string
) {
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<CursorState[]>([]);

  // Track local cursor and broadcast to awareness
  useEffect(() => {
    if (!editor || !awareness) return;

    const updateLocalCursor = () => {
      const selection = editor.getSelection();
      if (!selection) return;

      const current = awareness.getLocalState() || {};

      awareness.setLocalState({
        ...current,
        cursor: {
          position: {
            lineNumber: selection.positionLineNumber,
            column: selection.positionColumn
          },
          selection: selection.isEmpty() ? null : {
            startLineNumber: selection.startLineNumber,
            startColumn: selection.startColumn,
            endLineNumber: selection.endLineNumber,
            endColumn: selection.endColumn
          },
          color: localColor || current.color || '#6C5CE7',
          name: localName || current.name || 'Anonymous'
        }
      });
    };

    // Listen to cursor changes
    const disposable = editor.onDidChangeCursorSelection(() => {
      updateLocalCursor();
    });

    // Initial broadcast
    updateLocalCursor();

    return () => {
      disposable.dispose();
    };
  }, [editor, awareness, localColor, localName]);

  // Render remote cursors and selections
  useEffect(() => {
    if (!editor || !awareness) return;

    // Create decorations collection
    if (!decorationsRef.current) {
      decorationsRef.current = editor.createDecorationsCollection();
    }

    const updateDecorations = () => {
      const states = Array.from(awareness.getStates().entries());
      const decorations: monaco.editor.IModelDeltaDecoration[] = [];
      const cursors: CursorState[] = [];

      for (const [clientId, state] of states) {
        // Skip local user
        if (clientId === awareness.clientID) continue;

        const cursor = state.cursor;
        if (!cursor || !cursor.position) continue;

        const { position, selection, color, name } = cursor;

        cursors.push({
          position,
          selection,
          color: color || '#999',
          name: name || `User ${clientId}`,
          clientId
        });

        // Cursor decoration
        decorations.push({
          range: new (window as any).monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          options: {
            className: `fz-remote-cursor`,
            stickiness: (window as any).monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            hoverMessage: {
              value: `**${name}**`
            },
            // Add colored marker
            beforeContentClassName: `fz-cursor-marker`,
            // Inline CSS for cursor color
            before: {
              content: '|',
              inlineClassName: `fz-cursor-line`,
              inlineClassNameAffectsLetterSpacing: false
            }
          }
        });

        // Selection decoration
        if (selection && !isSelectionEmpty(selection)) {
          decorations.push({
            range: new (window as any).monaco.Range(
              selection.startLineNumber,
              selection.startColumn,
              selection.endLineNumber,
              selection.endColumn
            ),
            options: {
              className: `fz-remote-selection`,
              stickiness: (window as any).monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
              // Use inline style for selection color
              inlineClassName: `fz-selection-${clientId}`
            }
          });
        }
      }

      // Apply decorations
      decorationsRef.current?.set(decorations);
      setRemoteCursors(cursors);

      // Inject CSS variables for colors
      injectCursorStyles(cursors);
    };

    // Listen to awareness changes
    const onChange = () => {
      updateDecorations();
    };

    awareness.on('change', onChange);
    updateDecorations(); // Initial render

    return () => {
      awareness.off('change', onChange);
      decorationsRef.current?.clear();
    };
  }, [editor, awareness]);

  return { remoteCursors };
}

/**
 * Check if selection is empty (cursor only)
 */
function isSelectionEmpty(selection: SelectionRange): boolean {
  return (
    selection.startLineNumber === selection.endLineNumber &&
    selection.startColumn === selection.endColumn
  );
}

/**
 * Inject CSS styles for cursor colors dynamically
 */
function injectCursorStyles(cursors: CursorState[]) {
  // Remove existing style tag
  const existingStyle = document.getElementById('fz-cursor-styles');
  if (existingStyle) {
    existingStyle.remove();
  }

  // Create new style tag
  const style = document.createElement('style');
  style.id = 'fz-cursor-styles';

  let css = `
    /* Remote cursor line */
    .fz-cursor-line {
      border-left: 2px solid var(--cursor-color, #6C5CE7) !important;
      margin-left: -1px;
      position: relative;
      z-index: 1000;
    }

    /* Cursor marker (optional dot at top) */
    .fz-cursor-marker::before {
      content: '';
      position: absolute;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--cursor-color, #6C5CE7);
      top: -4px;
      left: -5px;
      z-index: 1001;
    }

    /* Base selection style */
    .fz-remote-selection {
      opacity: 0.2;
      background-color: var(--selection-color, rgba(108, 92, 231, 0.2)) !important;
      border-radius: 2px;
    }
  `;

  // Add per-client colors
  cursors.forEach(cursor => {
    const rgb = hexToRgb(cursor.color);
    css += `
      .fz-selection-${cursor.clientId} {
        --selection-color: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2);
      }
    `;
  });

  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : { r: 108, g: 92, b: 231 }; // Default purple
}
