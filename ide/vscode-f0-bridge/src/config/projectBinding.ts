/**
 * Project Binding Configuration
 * Phase 84.4.1: Manages F0 project linking to workspace
 * Phase 84.6: Auto-detection via .f0/project.json
 */

import * as vscode from 'vscode';
import { detectF0Project } from './projectDetection';

export interface F0ProjectBinding {
  projectId: string;
  apiBase: string; // e.g., "https://app.from-zero.dev" or "http://localhost:3030"
  // Optional: environment, projectName for display
}

const CONFIG_NAMESPACE = 'f0';

/**
 * Get current project binding
 * Phase 84.6: Priority order:
 * 1. .f0/project.json (zero-config)
 * 2. workspace settings (legacy)
 */
export function getProjectBinding(): F0ProjectBinding | null {
  // Priority 1: Check .f0/project.json
  const f0Config = detectF0Project();
  if (f0Config) {
    return {
      projectId: f0Config.projectId,
      apiBase: f0Config.backendUrl,
    };
  }

  // Priority 2: Fallback to workspace settings (legacy)
  const cfg = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
  const projectId = cfg.get<string>('projectId');
  const apiBase = cfg.get<string>('apiBase') ?? 'http://localhost:3030';

  if (!projectId) {
    return null;
  }

  return { projectId, apiBase };
}

/**
 * Set project binding in workspace settings
 */
export async function setProjectBinding(binding: F0ProjectBinding): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);

  await cfg.update('projectId', binding.projectId, vscode.ConfigurationTarget.Workspace);
  await cfg.update('apiBase', binding.apiBase, vscode.ConfigurationTarget.Workspace);
}

/**
 * Clear project binding from workspace
 */
export async function clearProjectBinding(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);

  await cfg.update('projectId', undefined, vscode.ConfigurationTarget.Workspace);
  await cfg.update('apiBase', undefined, vscode.ConfigurationTarget.Workspace);
}

/**
 * Check if workspace has a valid project binding
 */
export function hasProjectBinding(): boolean {
  return getProjectBinding() !== null;
}
