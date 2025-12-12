/**
 * Initialize F0 Project Command
 * Phase 84.6: Create .f0/project.json for zero-config setup
 */

import * as vscode from 'vscode';
import { writeF0ProjectConfig } from '../config/projectDetection';
import { F0ProjectConfig } from '../types/f0ProjectConfig';

export async function initProjectCommand(): Promise<void> {
  // Step 1: Ask for project ID
  const projectId = await vscode.window.showInputBox({
    title: 'F0 Project ID',
    placeHolder: 'Enter your F0 project ID',
    prompt: 'You can find this in your F0 dashboard',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Project ID cannot be empty';
      }
      return null;
    },
  });

  if (!projectId) {
    return; // User cancelled
  }

  // Step 2: Ask for project name
  const projectName = await vscode.window.showInputBox({
    title: 'F0 Project Name',
    placeHolder: 'Enter a friendly name for this project',
    value: vscode.workspace.name || 'My F0 Project',
  });

  if (!projectName) {
    return; // User cancelled
  }

  // Step 3: Choose environment
  const envChoice = await vscode.window.showQuickPick(
    [
      { label: 'Production', value: 'prod' as const, description: 'https://from-zero.app' },
      { label: 'Development', value: 'dev' as const, description: 'http://localhost:3030' },
      { label: 'Staging', value: 'staging' as const, description: 'https://staging.from-zero.app' },
    ],
    {
      title: 'Select Environment',
      placeHolder: 'Choose F0 backend environment',
    }
  );

  if (!envChoice) {
    return; // User cancelled
  }

  // Determine backend URL based on environment
  let backendUrl: string;
  switch (envChoice.value) {
    case 'prod':
      backendUrl = 'https://from-zero.app';
      break;
    case 'dev':
      backendUrl = 'http://localhost:3030';
      break;
    case 'staging':
      backendUrl = 'https://staging.from-zero.app';
      break;
  }

  // Step 4: Create config
  const config: F0ProjectConfig = {
    projectId: projectId.trim(),
    projectName: projectName.trim(),
    backendUrl,
    environment: envChoice.value,
    lastSync: Date.now(),
  };

  try {
    // Write .f0/project.json
    await writeF0ProjectConfig(config);

    // Show success message
    const openFolder = await vscode.window.showInformationMessage(
      `✅ F0 project initialized: ${config.projectName}`,
      'Open .f0 folder',
      'Reload Window'
    );

    if (openFolder === 'Reload Window') {
      // Reload window to re-detect project
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    } else if (openFolder === 'Open .f0 folder') {
      // Open .f0 folder in explorer
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        const f0FolderUri = vscode.Uri.joinPath(workspaceFolder.uri, '.f0');
        await vscode.commands.executeCommand('revealFileInOS', f0FolderUri);
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to initialize F0 project: ${errorMsg}`);
  }
}
