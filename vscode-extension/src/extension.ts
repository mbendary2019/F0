/**
 * F0 Ops Helper - VS Code Extension
 * Streamlines Firebase deployment and ops management
 */

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
}

async function runCommand(cmd: string): Promise<{ stdout: string; stderr: string }> {
  const cwd = getWorkspaceRoot();
  if (!cwd) {
    throw new Error('No workspace folder open');
  }
  return await execAsync(cmd, { cwd });
}

export function activate(context: vscode.ExtensionContext) {
  console.log('F0 Ops Helper extension activated');

  // Command: Login to Firebase
  context.subscriptions.push(
    vscode.commands.registerCommand('f0.login', async () => {
      try {
        await runCommand('firebase login');
        vscode.window.showInformationMessage('✅ Logged in to Firebase');
      } catch (error: any) {
        vscode.window.showErrorMessage(`❌ Login failed: ${error.message}`);
      }
    })
  );

  // Command: Deploy Phase
  context.subscriptions.push(
    vscode.commands.registerCommand('f0.deployPhase', async () => {
      const phase = await vscode.window.showInputBox({
        prompt: 'Enter phase script path (e.g., ./scripts/deploy-phase44.sh)',
        placeHolder: './scripts/deploy-phase44.sh',
      });

      if (!phase) return;

      const term = vscode.window.createTerminal('F0 Deploy');
      term.show();
      term.sendText(phase);
    })
  );

  // Command: Open Firebase Dashboard
  context.subscriptions.push(
    vscode.commands.registerCommand('f0.openDashboard', async () => {
      vscode.env.openExternal(
        vscode.Uri.parse('https://console.firebase.google.com/')
      );
    })
  );

  // Command: Tail Logs
  context.subscriptions.push(
    vscode.commands.registerCommand('f0.tailLogs', async () => {
      const functionName = await vscode.window.showInputBox({
        prompt: 'Enter function name (optional, leave blank for all)',
        placeHolder: 'e.g., gossipPush',
      });

      const term = vscode.window.createTerminal('F0 Logs');
      term.show();

      if (functionName) {
        term.sendText(`firebase functions:log --only ${functionName}`);
      } else {
        term.sendText('firebase functions:log');
      }
    })
  );
}

export function deactivate() {
  console.log('F0 Ops Helper extension deactivated');
}
