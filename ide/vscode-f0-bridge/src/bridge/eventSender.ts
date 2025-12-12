// src/bridge/eventSender.ts
import * as vscode from 'vscode';
import { sendIdeEvent } from '../services/apiClient';
import {
  IdeEventEnvelope,
  FileSnapshotPayload,
  FileChangedPayload,
  FileDeltaPayload,
} from '../types/ideBridge';
import { computeDeltaOrSnapshot, resetDiffEngine } from './diffEngine';

export interface BridgeContext {
  sessionId: string;
  projectId: string;
}

let disposables: vscode.Disposable[] = [];
let heartbeatTimer: NodeJS.Timeout | undefined;

/**
 * Start event bridge - watches for file changes and sends events
 */
export function startEventBridge(
  ctx: vscode.ExtensionContext,
  bridge: BridgeContext
) {
  console.log('[F0 Event Bridge] Starting event bridge for session:', bridge.sessionId);

  // Reset any previous state
  stopEventBridge();
  resetDiffEngine();

  // 1. Listen for file open events -> FILE_SNAPSHOT
  const openListener = vscode.workspace.onDidOpenTextDocument(async (doc) => {
    if (doc.uri.scheme !== 'file') return;

    const relativePath = vscode.workspace.asRelativePath(doc.uri);
    const { snapshot } = computeDeltaOrSnapshot(
      relativePath,
      doc.languageId,
      doc.getText()
    );

    if (!snapshot) return;

    const event: IdeEventEnvelope = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: bridge.sessionId,
      projectId: bridge.projectId,
      source: 'vscode',
      kind: 'FILE_SNAPSHOT',
      ts: new Date().toISOString(),
      payload: snapshot,
    };

    try {
      await sendIdeEvent(event);
      console.log('[F0 Event Bridge] Sent FILE_SNAPSHOT for:', relativePath);
    } catch (err) {
      console.error('[F0 Event Bridge] Failed to send FILE_SNAPSHOT:', err);
    }
  });

  // 2. Listen for file change events -> FILE_DELTA or FILE_CHANGED
  const changeListener = vscode.workspace.onDidChangeTextDocument(async (e) => {
    if (e.document.uri.scheme !== 'file') return;
    if (e.contentChanges.length === 0) return;

    const relativePath = vscode.workspace.asRelativePath(e.document.uri);
    const { snapshot, delta } = computeDeltaOrSnapshot(
      relativePath,
      e.document.languageId,
      e.document.getText()
    );

    // First time seeing file (rare in onChange, but possible)
    if (snapshot) {
      const event: IdeEventEnvelope = {
        eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId: bridge.sessionId,
        projectId: bridge.projectId,
        source: 'vscode',
        kind: 'FILE_SNAPSHOT',
        ts: new Date().toISOString(),
        payload: snapshot,
      };

      try {
        await sendIdeEvent(event);
        console.log('[F0 Event Bridge] Sent FILE_SNAPSHOT for:', relativePath);
      } catch (err) {
        console.error('[F0 Event Bridge] Failed to send FILE_SNAPSHOT:', err);
      }
      return;
    }

    // Small change -> send delta
    if (delta) {
      const event: IdeEventEnvelope = {
        eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId: bridge.sessionId,
        projectId: bridge.projectId,
        source: 'vscode',
        kind: 'FILE_DELTA',
        ts: new Date().toISOString(),
        payload: delta,
      };

      try {
        await sendIdeEvent(event);
        console.log(
          `[F0 Event Bridge] Sent FILE_DELTA for: ${relativePath} (${delta.insertText.length} chars)`
        );
      } catch (err) {
        console.error('[F0 Event Bridge] Failed to send FILE_DELTA:', err);
      }
      return;
    }

    // Large change -> fallback to full FILE_CHANGED
    const fullPayload: FileChangedPayload = {
      path: relativePath,
      languageId: e.document.languageId,
      content: e.document.getText(),
    };

    const fullEvent: IdeEventEnvelope = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: bridge.sessionId,
      projectId: bridge.projectId,
      source: 'vscode',
      kind: 'FILE_CHANGED',
      ts: new Date().toISOString(),
      payload: fullPayload,
    };

    try {
      await sendIdeEvent(fullEvent);
      console.log('[F0 Event Bridge] Sent FILE_CHANGED (full) for:', relativePath);
    } catch (err) {
      console.error('[F0 Event Bridge] Failed to send FILE_CHANGED:', err);
    }
  });

  // 3. Listen for selection changes -> SELECTION_CHANGED
  const selectionListener = vscode.window.onDidChangeTextEditorSelection(async (e) => {
    if (e.textEditor.document.uri.scheme !== 'file') return;
    if (e.selections.length === 0) return;

    const selection = e.selections[0];
    if (selection.isEmpty) return;

    const relativePath = vscode.workspace.asRelativePath(e.textEditor.document.uri);
    const selectedText = e.textEditor.document.getText(selection);

    const payload = {
      path: relativePath,
      selectedText,
      startLine: selection.start.line,
      startCol: selection.start.character,
      endLine: selection.end.line,
      endCol: selection.end.character,
    };

    const event: IdeEventEnvelope = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: bridge.sessionId,
      projectId: bridge.projectId,
      source: 'vscode',
      kind: 'SELECTION_CHANGED',
      ts: new Date().toISOString(),
      payload,
    };

    try {
      await sendIdeEvent(event);
      console.log('[F0 Event Bridge] Sent SELECTION_CHANGED for:', relativePath);
    } catch (err) {
      console.error('[F0 Event Bridge] Failed to send SELECTION_CHANGED:', err);
    }
  });

  // 4. Heartbeat every 30 seconds
  heartbeatTimer = setInterval(async () => {
    const event: IdeEventEnvelope = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: bridge.sessionId,
      projectId: bridge.projectId,
      source: 'vscode',
      kind: 'HEARTBEAT',
      ts: new Date().toISOString(),
      payload: { status: 'alive' },
    };

    try {
      await sendIdeEvent(event);
      console.log('[F0 Event Bridge] Sent HEARTBEAT');
    } catch (err) {
      console.error('[F0 Event Bridge] Failed to send HEARTBEAT:', err);
    }
  }, 30_000);

  // Store disposables
  disposables = [openListener, changeListener, selectionListener];
  ctx.subscriptions.push(...disposables);

  vscode.window.showInformationMessage('F0 Event Bridge started!');
}

/**
 * Stop event bridge
 */
export function stopEventBridge() {
  disposables.forEach((d) => d.dispose());
  disposables = [];

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  }

  resetDiffEngine();
  console.log('[F0 Event Bridge] Stopped');
}
