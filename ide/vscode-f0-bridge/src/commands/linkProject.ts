/**
 * Link Project Command
 * Phase 84.4.1: Command to link workspace to F0 project
 */

import * as vscode from 'vscode';
import { setProjectBinding } from '../config/projectBinding';

/**
 * Command handler for F0: Link Project
 * Guides user through linking workspace to F0 project
 */
export async function linkProjectCommand(): Promise<void> {
  // Step 1: Ask for Project ID
  const projectId = await vscode.window.showInputBox({
    title: 'F0 Project ID',
    placeHolder: 'Enter your F0 projectId (from F0 dashboard)',
    prompt: 'You can find this in your F0 project settings',
    ignoreFocusOut: true,
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

  // Step 2: Ask for API Base URL
  const apiBase = await vscode.window.showQuickPick(
    [
      {
        label: 'Local Development',
        description: 'http://localhost:3030',
        detail: 'Use this if you are running F0 locally',
        value: 'http://localhost:3030',
      },
      {
        label: 'Production',
        description: 'https://app.from-zero.dev',
        detail: 'Use this for production F0 instance',
        value: 'https://app.from-zero.dev',
      },
      {
        label: 'Custom',
        description: 'Enter custom URL',
        detail: 'Specify a custom F0 backend URL',
        value: 'custom',
      },
    ],
    {
      title: 'F0 API Base URL',
      placeHolder: 'Select F0 backend environment',
      ignoreFocusOut: true,
    }
  );

  if (!apiBase) {
    return; // User cancelled
  }

  let finalApiBase = apiBase.value;

  // If custom, ask for URL
  if (apiBase.value === 'custom') {
    const customUrl = await vscode.window.showInputBox({
      title: 'Custom F0 API Base URL',
      placeHolder: 'https://your-f0-instance.com',
      value: 'http://localhost:3030',
      ignoreFocusOut: true,
      validateInput: (value) => {
        try {
          new URL(value);
          return null;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    });

    if (!customUrl) {
      return; // User cancelled
    }

    finalApiBase = customUrl;
  }

  // Save binding
  await setProjectBinding({
    projectId: projectId.trim(),
    apiBase: finalApiBase,
  });

  vscode.window.showInformationMessage(
    `✅ F0 project linked: ${projectId.trim()} → ${finalApiBase}`
  );
}
