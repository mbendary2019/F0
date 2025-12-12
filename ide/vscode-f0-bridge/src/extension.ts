/**
 * F0 Live Bridge - VS Code Extension
 * Phase 84.4: Project Linking + Auth Integration
 * Phase 87: IDE Bridge Integration
 */

import * as vscode from 'vscode';
import { F0Panel } from './panels/F0Panel';
import { applyUnifiedDiffToWorkspace } from './patch/applyUnifiedDiffToWorkspace';
import { createAuthManager, AuthManager } from './auth/authManager';
import { linkProjectCommand } from './commands/linkProject';
import { initProjectCommand } from './commands/initProject';
import { getProjectBinding } from './config/projectBinding';
import { startEventBridge, stopEventBridge, BridgeContext } from './bridge/eventSender';
import { startCommandPolling, stopCommandPolling } from './bridge/commandPoller';
import { registerInlineSuggestions, unregisterInlineSuggestions } from './bridge/inlineSuggestions';

// Bridge state
let activeBridge: BridgeContext | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('F0 Live Bridge extension activated');

  // Create AuthManager instance
  const authManager = createAuthManager(context);

  // Phase 84.5: URI Handler for OAuth callback
  const uriHandler: vscode.UriHandler = {
    async handleUri(uri: vscode.Uri) {
      if (uri.path !== '/callback') {
        return;
      }

      const params = new URLSearchParams(uri.query);
      const token = params.get('token');
      const expiresIn = params.get('expiresIn');

      if (!token) {
        vscode.window.showErrorMessage('F0: Missing token in OAuth callback.');
        return;
      }

      await authManager.finishOAuth(
        token,
        expiresIn ? Number(expiresIn) : undefined
      );

      // Notify user
      vscode.window.showInformationMessage('✅ Successfully signed in to F0!');

      // Refresh panel if open (trigger re-initialization)
      if (F0Panel.currentPanel) {
        vscode.commands.executeCommand('f0.openAssistant');
      }
    },
  };

  context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));

  // Command: Initialize Project
  context.subscriptions.push(
    vscode.commands.registerCommand('f0.initProject', initProjectCommand)
  );

  // Command: Link Project
  context.subscriptions.push(
    vscode.commands.registerCommand('f0.linkProject', linkProjectCommand)
  );

  // Command: Sign Out
  context.subscriptions.push(
    vscode.commands.registerCommand('f0.signOut', async () => {
      await authManager.signOut();
    })
  );

  // Command: Open F0 Assistant Panel
  const openAssistant = vscode.commands.registerCommand('f0.openAssistant', () => {
    // Check project binding first
    const binding = getProjectBinding();
    if (!binding) {
      vscode.window.showErrorMessage(
        'No F0 project linked. Please link a project first.',
        'Link Project'
      ).then(choice => {
        if (choice === 'Link Project') {
          vscode.commands.executeCommand('f0.linkProject');
        }
      });
      return;
    }

    // Open panel with AuthManager
    F0Panel.createOrShow(context, authManager);
  });

  // Command: Fix Selected Code
  const fixSelection = vscode.commands.registerCommand('f0.fixSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('F0: No active editor');
      return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showInformationMessage('F0: No code selected');
      return;
    }

    const selectedText = editor.document.getText(selection);
    const filePath = vscode.workspace.asRelativePath(editor.document.uri);

    vscode.window.showInformationMessage(
      `F0: Captured selection from ${filePath} (${selection.start.line + 1}:${selection.start.character + 1} - ${selection.end.line + 1}:${selection.end.character + 1})`
    );

    // TODO Phase 84.3+:
    // 1. Get config (projectId, apiBase, apiKey)
    // 2. Call /api/ide/session to create session
    // 3. Call /api/ide/chat with fileContext
    // 4. Receive patchText
    // 5. Apply using applyUnifiedDiffToWorkspace()

    console.log('F0: Selected text:', selectedText);
    console.log('F0: File path:', filePath);
    console.log('F0: Selection range:', {
      startLine: selection.start.line,
      startCol: selection.start.character,
      endLine: selection.end.line,
      endCol: selection.end.character,
    });
  });

  // Command: Start Live Bridge
  const startBridge = vscode.commands.registerCommand('f0.startBridge', async () => {
    const binding = getProjectBinding();
    if (!binding) {
      vscode.window.showErrorMessage('No F0 project linked. Please link a project first.');
      return;
    }

    if (activeBridge) {
      vscode.window.showWarningMessage('F0 Bridge is already running.');
      return;
    }

    // Create session ID (for now, use projectId as sessionId)
    const sessionId = binding.projectId;

    activeBridge = {
      sessionId,
      projectId: binding.projectId,
    };

    // Helper function to apply patches
    const applyPatchFiles = async (files: { path: string; newContent: string }[]) => {
      for (const file of files) {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
          throw new Error('No workspace folder open');
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;
        const fileUri = vscode.Uri.joinPath(workspaceRoot, file.path);

        const edit = new vscode.WorkspaceEdit();

        // Check if file exists
        try {
          const doc = await vscode.workspace.openTextDocument(fileUri);
          const fullRange = new vscode.Range(
            doc.lineAt(0).range.start,
            doc.lineAt(doc.lineCount - 1).range.end
          );
          edit.replace(fileUri, fullRange, file.newContent);
        } catch {
          // File doesn't exist, create it
          edit.createFile(fileUri, { ignoreIfExists: true });
          const doc = await vscode.workspace.openTextDocument(fileUri);
          const fullRange = new vscode.Range(0, 0, doc.lineCount, 0);
          edit.replace(fileUri, fullRange, file.newContent);
        }

        await vscode.workspace.applyEdit(edit);
      }
    };

    // Start event bridge and command polling
    startEventBridge(context, activeBridge);
    startCommandPolling(activeBridge, applyPatchFiles);

    // Register inline suggestions (Phase 87.3)
    registerInlineSuggestions(context, {
      projectId: activeBridge.projectId,
      sessionId: activeBridge.sessionId,
    });

    vscode.window.showInformationMessage('✅ F0 Live Bridge started!');
  });

  // Command: Stop Live Bridge
  const stopBridge = vscode.commands.registerCommand('f0.stopBridge', () => {
    if (!activeBridge) {
      vscode.window.showWarningMessage('F0 Bridge is not running.');
      return;
    }

    stopEventBridge();
    stopCommandPolling();
    unregisterInlineSuggestions();
    activeBridge = undefined;

    vscode.window.showInformationMessage('F0 Live Bridge stopped.');
  });

  context.subscriptions.push(openAssistant, fixSelection, startBridge, stopBridge);
}

export function deactivate() {
  // Stop bridge on deactivation
  if (activeBridge) {
    stopEventBridge();
    stopCommandPolling();
    unregisterInlineSuggestions();
    activeBridge = undefined;
  }
  console.log('F0 Live Bridge extension deactivated');
}
