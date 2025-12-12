/**
 * Auto Project Detection
 * Phase 84.6: Detect .f0/project.json for zero-config setup
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { F0ProjectConfig, validateF0ProjectConfig } from '../types/f0ProjectConfig';

const F0_CONFIG_PATH = '.f0/project.json';

/**
 * Detect F0 project configuration in workspace (synchronous)
 * Returns the first valid .f0/project.json found
 */
export function detectF0Project(): F0ProjectConfig | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }

  // Check each workspace folder for .f0/project.json
  for (const folder of workspaceFolders) {
    const configPath = path.join(folder.uri.fsPath, F0_CONFIG_PATH);

    try {
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent);

        if (validateF0ProjectConfig(config)) {
          console.log('F0 project detected:', config.projectId);
          return config;
        } else {
          console.warn('Invalid .f0/project.json format:', configPath);
        }
      }
    } catch (error) {
      console.error('Error reading .f0/project.json:', error);
    }
  }

  return null;
}

/**
 * Write F0 project configuration to workspace
 */
export async function writeF0ProjectConfig(config: F0ProjectConfig): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('No workspace folder open');
  }

  const rootFolder = workspaceFolders[0];
  const f0Dir = path.join(rootFolder.uri.fsPath, '.f0');
  const configPath = path.join(f0Dir, 'project.json');

  // Create .f0 directory if it doesn't exist
  if (!fs.existsSync(f0Dir)) {
    fs.mkdirSync(f0Dir, { recursive: true });
  }

  // Write config
  fs.writeFileSync(
    configPath,
    JSON.stringify(config, null, 2),
    'utf8'
  );

  console.log('F0 project config written:', configPath);
}

/**
 * Check if current workspace has .f0/project.json
 */
export function hasF0ProjectConfig(): boolean {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return false;
  }

  const rootFolder = workspaceFolders[0];
  const configPath = path.join(rootFolder.uri.fsPath, F0_CONFIG_PATH);

  return fs.existsSync(configPath);
}
