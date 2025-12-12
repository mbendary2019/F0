// src/bridge/commandPoller.ts
import * as vscode from 'vscode';
import { pollIdeCommands } from '../services/apiClient';
import { IdeCommandEnvelope, ApplyPatchPayload } from '../types/ideBridge';
import { BridgeContext } from './eventSender';

let pollingTimer: NodeJS.Timeout | undefined;
let lastCommandTs: string | undefined;

export type ApplyPatchFn = (files: { path: string; newContent: string }[]) => Promise<void>;

/**
 * Start command polling - polls every 3 seconds for new commands
 */
export function startCommandPolling(
  bridge: BridgeContext,
  applyPatchFiles: ApplyPatchFn
) {
  console.log('[F0 Command Poller] Starting command polling for session:', bridge.sessionId);

  // Poll every 3 seconds
  pollingTimer = setInterval(async () => {
    try {
      const res = await pollIdeCommands(
        bridge.sessionId,
        bridge.projectId,
        lastCommandTs
      );

      if (res.commands.length > 0) {
        console.log(`[F0 Command Poller] Received ${res.commands.length} command(s)`);

        for (const cmd of res.commands) {
          await handleCommand(cmd, applyPatchFiles);
          lastCommandTs = cmd.ts;
        }
      }
    } catch (err) {
      console.error('[F0 Command Poller] Failed to poll commands:', err);
    }
  }, 3000);

  vscode.window.showInformationMessage('F0 Command Polling started!');
}

/**
 * Stop command polling
 */
export function stopCommandPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = undefined;
  }
  lastCommandTs = undefined;
  console.log('[F0 Command Poller] Stopped');
}

/**
 * Handle incoming command
 */
async function handleCommand(cmd: IdeCommandEnvelope, applyPatchFiles: ApplyPatchFn) {
  console.log('[F0 Command Poller] Handling command:', cmd.kind, cmd.commandId);

  switch (cmd.kind) {
    case 'APPLY_PATCH':
      await handleApplyPatch(cmd, applyPatchFiles);
      break;

    case 'OPEN_FILE':
      await handleOpenFile(cmd);
      break;

    default:
      console.warn('[F0 Command Poller] Unknown command kind:', cmd.kind);
  }
}

/**
 * Handle APPLY_PATCH command
 */
async function handleApplyPatch(cmd: IdeCommandEnvelope, applyPatchFiles: ApplyPatchFn) {
  const payload = cmd.payload as ApplyPatchPayload;

  const choice = await vscode.window.showInformationMessage(
    `F0 Agent suggests applying patch "${payload.patchId}" (${payload.files.length} file(s)). Apply?`,
    'Apply',
    'Decline'
  );

  if (choice !== 'Apply') {
    console.log('[F0 Command Poller] User declined patch:', payload.patchId);
    return;
  }

  try {
    await applyPatchFiles(payload.files);
    vscode.window.showInformationMessage(
      `✅ Patch "${payload.patchId}" applied successfully!`
    );
  } catch (err) {
    console.error('[F0 Command Poller] Failed to apply patch:', err);
    vscode.window.showErrorMessage(`Failed to apply patch: ${err}`);
  }
}

/**
 * Handle OPEN_FILE command
 */
async function handleOpenFile(cmd: IdeCommandEnvelope) {
  const { path } = cmd.payload;

  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;
  const fileUri = vscode.Uri.joinPath(workspaceRoot, path);

  try {
    const doc = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(doc);
    console.log('[F0 Command Poller] Opened file:', path);
  } catch (err) {
    console.error('[F0 Command Poller] Failed to open file:', err);
    vscode.window.showErrorMessage(`Failed to open file: ${path}`);
  }
}
