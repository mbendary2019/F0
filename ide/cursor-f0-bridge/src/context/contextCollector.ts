/**
 * Context Collector for Cursor Bridge CLI
 * Phase 84.8: Collects workspace context from current directory
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { IdeWorkspaceContext } from '../api/types';

/**
 * Check if current directory is a git repository
 */
export function isGitRepository(cwd: string = process.cwd()): boolean {
  try {
    execSync('git rev-parse --git-dir', { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get changed files from git diff
 */
export function getGitChangedFiles(
  cwd: string = process.cwd()
): { path: string; status: 'modified' | 'added' | 'deleted' }[] {
  if (!isGitRepository(cwd)) {
    return [];
  }

  try {
    const output = execSync('git diff --name-status HEAD', {
      cwd,
      encoding: 'utf8',
    });

    const changedFiles: { path: string; status: 'modified' | 'added' | 'deleted' }[] = [];

    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;

      const statusCode = parts[0];
      const filePath = parts[1];

      let status: 'modified' | 'added' | 'deleted';
      if (statusCode.startsWith('M')) {
        status = 'modified';
      } else if (statusCode.startsWith('A')) {
        status = 'added';
      } else if (statusCode.startsWith('D')) {
        status = 'deleted';
      } else {
        continue; // Skip unknown status
      }

      changedFiles.push({ path: filePath, status });
    }

    return changedFiles;
  } catch (err) {
    console.warn('[ContextCollector] Failed to get git changes:', err);
    return [];
  }
}

/**
 * Get package.json info
 */
export function getPackageJsonInfo(cwd: string = process.cwd()): {
  path: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} | undefined {
  const packageJsonPath = path.join(cwd, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(content);

    return {
      path: 'package.json',
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
    };
  } catch (err) {
    console.warn('[ContextCollector] Failed to parse package.json:', err);
    return undefined;
  }
}

/**
 * Find common source files in current directory
 * (Simplified version - CLI doesn't have access to opened files in editor)
 */
export function findCommonSourceFiles(cwd: string = process.cwd()): { path: string; languageId?: string }[] {
  const sourceFiles: { path: string; languageId?: string }[] = [];

  const extensions: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescriptreact',
    '.js': 'javascript',
    '.jsx': 'javascriptreact',
    '.py': 'python',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.cpp': 'cpp',
    '.c': 'c',
    '.css': 'css',
    '.scss': 'scss',
    '.html': 'html',
    '.json': 'json',
    '.md': 'markdown',
  };

  // Recursively find files (max depth 3)
  function findFiles(dir: string, depth: number = 0) {
    if (depth > 3) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip common ignored directories
        if (entry.isDirectory()) {
          if (['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) {
            continue;
          }
          findFiles(path.join(dir, entry.name), depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions[ext]) {
            const relativePath = path.relative(cwd, path.join(dir, entry.name));
            sourceFiles.push({
              path: relativePath,
              languageId: extensions[ext],
            });
          }
        }
      }
    } catch (err) {
      // Ignore permission errors
    }
  }

  findFiles(cwd);

  // Limit to 50 files
  return sourceFiles.slice(0, 50);
}

/**
 * Collect full workspace context
 */
export function collectWorkspaceContext(
  projectId: string,
  sessionId: string,
  cwd: string = process.cwd()
): IdeWorkspaceContext {
  const changedFiles = getGitChangedFiles(cwd);
  const packageJson = getPackageJsonInfo(cwd);
  const openedFiles = findCommonSourceFiles(cwd);

  return {
    projectId,
    sessionId,
    openedFiles,
    changedFiles,
    packageJson,
    timestamp: Date.now(),
  };
}
