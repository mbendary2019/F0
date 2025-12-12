/**
 * Workspace Context Collector for Xcode Helper
 * Phase 84.8.2: Collects workspace information
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export async function collectWorkspaceContext(): Promise<any> {
  const cwd = process.cwd();

  return {
    projectId: process.env.F0_PROJECT_ID || 'default',
    sessionId: '', // Will be filled by session manager
    changedFiles: getGitChangedFiles(cwd),
    packageJson: getPackageJsonInfo(cwd),
    timestamp: Date.now(),
  };
}

function getGitChangedFiles(cwd: string): any[] {
  try {
    const output = execSync('git diff --name-status HEAD', {
      cwd,
      encoding: 'utf8',
    });

    const changedFiles: any[] = [];

    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const [statusCode, filePath] = trimmed.split(/\s+/);
      let status: 'modified' | 'added' | 'deleted';

      if (statusCode.startsWith('M')) {
        status = 'modified';
      } else if (statusCode.startsWith('A')) {
        status = 'added';
      } else if (statusCode.startsWith('D')) {
        status = 'deleted';
      } else {
        continue;
      }

      changedFiles.push({ path: filePath, status });
    }

    return changedFiles;
  } catch {
    return [];
  }
}

function getPackageJsonInfo(cwd: string): any {
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
  } catch {
    return undefined;
  }
}
