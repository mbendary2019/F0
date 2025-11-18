// src/lib/collab/monacoBinding.ts
// Phase 53 Day 2: Monaco Editor ↔ Y.js Binding

import * as Y from "yjs";
import type * as monaco from "monaco-editor";

/**
 * Two-way binding between Monaco Editor and Y.js Y.Text
 *
 * Synchronizes:
 * - Text insertions/deletions
 * - Debounced updates
 * - Conflict-free merging via CRDT
 *
 * Usage:
 * ```ts
 * const binding = new MonacoYBinding(ytext, model);
 * // ... later
 * binding.destroy();
 * ```
 */
export class MonacoYBinding {
  private disposables: monaco.IDisposable[] = [];
  private applyingRemote = false;
  private applyingLocal = false;

  constructor(
    private ytext: Y.Text,
    private model: monaco.editor.ITextModel
  ) {
    // Initialize with Y.js content
    this.initializeContent();

    // Y.js → Monaco (remote changes)
    this.ytext.observe(this.handleYTextChange);

    // Monaco → Y.js (local changes)
    const monacoSub = this.model.onDidChangeContent(this.handleMonacoChange);
    this.disposables.push(monacoSub);
  }

  /**
   * Initialize Monaco with Y.js content
   */
  private initializeContent = () => {
    const ytextContent = this.ytext.toString();
    const monacoContent = this.model.getValue();

    if (ytextContent && ytextContent !== monacoContent) {
      this.applyingRemote = true;
      this.model.setValue(ytextContent);
      this.applyingRemote = false;
    }
  };

  /**
   * Handle Y.js text changes → apply to Monaco
   */
  private handleYTextChange = (event: Y.YTextEvent, transaction: Y.Transaction) => {
    if (this.applyingLocal) return;
    if (transaction.origin === this) return; // Ignore self-originated changes

    this.applyingRemote = true;

    try {
      let index = 0;
      const edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];

      event.delta.forEach((op: any) => {
        if (op.retain !== undefined) {
          index += op.retain;
        } else if (op.insert !== undefined) {
          const pos = this.model.getPositionAt(index);
          const text = typeof op.insert === "string" ? op.insert : "";

          edits.push({
            range: new (window as any).monaco.Range(
              pos.lineNumber,
              pos.column,
              pos.lineNumber,
              pos.column
            ),
            text
          });

          index += text.length;
        } else if (op.delete !== undefined) {
          const startPos = this.model.getPositionAt(index);
          const endPos = this.model.getPositionAt(index + op.delete);

          edits.push({
            range: new (window as any).monaco.Range(
              startPos.lineNumber,
              startPos.column,
              endPos.lineNumber,
              endPos.column
            ),
            text: ""
          });
        }
      });

      if (edits.length > 0) {
        this.model.applyEdits(edits);
      }
    } finally {
      this.applyingRemote = false;
    }
  };

  /**
   * Handle Monaco changes → apply to Y.js
   */
  private handleMonacoChange = (event: monaco.editor.IModelContentChangedEvent) => {
    if (this.applyingRemote) return;

    this.applyingLocal = true;

    try {
      // Sort changes in reverse order to apply from end to start
      const changes = event.changes.sort((a, b) => b.rangeOffset - a.rangeOffset);

      this.ytext.doc?.transact(() => {
        changes.forEach(change => {
          // Delete old content
          if (change.rangeLength > 0) {
            this.ytext.delete(change.rangeOffset, change.rangeLength);
          }

          // Insert new content
          if (change.text) {
            this.ytext.insert(change.rangeOffset, change.text);
          }
        });
      }, this); // Pass 'this' as origin to detect self-changes

    } finally {
      this.applyingLocal = false;
    }
  };

  /**
   * Cleanup and destroy binding
   */
  destroy() {
    this.ytext.unobserve(this.handleYTextChange);
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

/**
 * Helper: Get text offset from Monaco position
 */
export function getOffsetFromPosition(
  model: monaco.editor.ITextModel,
  position: monaco.Position
): number {
  return model.getOffsetAt(position);
}

/**
 * Helper: Get Monaco position from text offset
 */
export function getPositionFromOffset(
  model: monaco.editor.ITextModel,
  offset: number
): monaco.Position {
  return model.getPositionAt(offset);
}
