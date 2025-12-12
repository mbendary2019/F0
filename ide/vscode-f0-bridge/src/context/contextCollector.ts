/**
 * Workspace Context Collector
 * Phase 84.7: Gathers workspace information to send to F0 backend
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Workspace context interface matching backend IdeWorkspaceContext
 */
export interface IdeWorkspaceContext {
  projectId: string;
  sessionId: string;
  openedFiles: { path: string; languageId?: string }[];
  currentFile?: { path: string; languageId?: string };
  changedFiles?: { path: string; status: 'modified' | 'added' | 'deleted' }[];
  packageJson?: {
    path: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  timestamp?: number;
}

/**
 * Get all currently opened files in VS Code
 */
export function getOpenedFiles(): { path: string; languageId?: string }[] {
  const openedFiles: { path: string; languageId?: string }[] = [];

  // Get all visible text editors
  for (const editor of vscode.window.visibleTextEditors) {
    const document = editor.document;

    // Skip untitled documents
    if (document.uri.scheme !== 'file') {
      continue;
    }

    // Get relative path from workspace
    const relativePath = vscode.workspace.asRelativePath(document.uri);

    openedFiles.push({
      path: relativePath,
      languageId: document.languageId,
    });
  }

  return openedFiles;
}

/**
 * Get the currently active file in VS Code
 */
export function getCurrentFile(): { path: string; languageId?: string } | undefined {
  const activeEditor = vscode.window.activeTextEditor;

  if (!activeEditor) {
    return undefined;
  }

  const document = activeEditor.document;

  // Skip untitled documents
  if (document.uri.scheme !== 'file') {
    return undefined;
  }

  // Get relative path from workspace
  const relativePath = vscode.workspace.asRelativePath(document.uri);

  return {
    path: relativePath,
    languageId: document.languageId,
  };
}

/**
 * Get git changed files using git diff
 */
export async function getGitChangedFiles(): Promise<
  { path: string; status: 'modified' | 'added' | 'deleted' }[]
> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }

  const rootPath = workspaceFolders[0].uri.fsPath;

  try {
    // Run git diff --name-status HEAD
    const { stdout } = await execAsync('git diff --name-status HEAD', {
      cwd: rootPath,
    });

    if (!stdout || stdout.trim().length === 0) {
      return [];
    }

    // Parse output
    const changedFiles: { path: string; status: 'modified' | 'added' | 'deleted' }[] = [];

    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) {
        continue;
      }

      const statusCode = parts[0];
      const filePath = parts[1];

      let status: 'modified' | 'added' | 'deleted';
      if (statusCode === 'M') {
        status = 'modified';
      } else if (statusCode === 'A') {
        status = 'added';
      } else if (statusCode === 'D') {
        status = 'deleted';
      } else {
        // Handle other statuses (R=renamed, C=copied) as modified
        status = 'modified';
      }

      changedFiles.push({ path: filePath, status });
    }

    return changedFiles;
  } catch (error) {
    // Git not available or not a git repository
    console.warn('Failed to get git changed files:', error);
    return [];
  }
}

/**
 * Get package.json information
 */
export async function getPackageJsonInfo(): Promise<{
  path: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const packageJsonPath = path.join(rootPath, 'package.json');

  try {
    // Check if package.json exists
    if (!fs.existsSync(packageJsonPath)) {
      return undefined;
    }

    // Read and parse package.json
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);

    return {
      path: 'package.json',
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
    };
  } catch (error) {
    console.error('Failed to read package.json:', error);
    return undefined;
  }
}

/**
 * Collect all workspace context
 */
export async function collectWorkspaceContext(
  projectId: string,
  sessionId: string
): Promise<IdeWorkspaceContext> {
  const [changedFiles, packageJson] = await Promise.all([
    getGitChangedFiles(),
    getPackageJsonInfo(),
  ]);

  const context: IdeWorkspaceContext = {
    projectId,
    sessionId,
    openedFiles: getOpenedFiles(),
    currentFile: getCurrentFile(),
    changedFiles,
    packageJson,
    timestamp: Date.now(),
  };

  return context;
}
