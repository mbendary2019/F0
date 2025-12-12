// desktop/src/lib/analysis/projectIssuesScanner.ts
// Phase 124.8: Project-Wide Issues Scanner
// Scans entire project for code issues using the existing analyzeCodeLocally patterns

import * as fs from 'fs';
import * as path from 'path';

/**
 * Summary of issues for a single file
 */
export type FileIssuesSummary = {
  filePath: string;
  relativePath: string;
  issueCount: number;
  errors: number;
  warnings: number;
  infos: number;
  categories: Record<string, number>;
  // Phase 124.8.1: Store actual issues for quick access
  issues: Array<{
    id: string;
    severity: 'info' | 'warning' | 'error';
    category: 'logic' | 'security' | 'performance' | 'style' | 'best-practice';
    message: string;
    lineStart: number;
    lineEnd: number;
  }>;
};

/**
 * Result of scanning the entire project
 */
export type ProjectScanResult = {
  scannedFiles: number;
  totalIssues: number;
  totalErrors: number;
  totalWarnings: number;
  totalInfos: number;
  summaries: FileIssuesSummary[];
  skippedFiles: number;
  scanDurationMs: number;
};

/**
 * Options for project scan
 */
export interface ScanProjectOptions {
  projectRoot: string;
  maxFiles?: number;
  /** Callback for progress updates */
  onProgress?: (scanned: number, total: number, currentFile: string) => void;
}

// Directories to exclude from scanning
// Phase 145.4.1: Added dist-electron and other build artifacts
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'dist-electron',  // Phase 145.4.1: Electron build output
  'build',
  'coverage',
  '.git',
  '.f0',
  'out',
  '__pycache__',
  '.cache',
  '.turbo',
  '.vercel',
  '.nuxt',
  '.output',
  'public',
  'static',
  '.idea',
  '.vscode',
  '.backup',        // Phase 145.4.1: Auto-fix backup folders
  'backup',         // Phase 145.4.1: Auto-fix backup folders
]);

// File extensions to scan
const SCANNABLE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

// Files to exclude
const EXCLUDED_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.DS_Store',
]);

/**
 * Check if a file should be scanned
 */
function shouldScanFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  // Skip excluded files
  if (EXCLUDED_FILES.has(fileName)) return false;

  // Skip test files for now (optional - can be made configurable)
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(fileName)) return false;

  // Only scan supported extensions
  return SCANNABLE_EXTENSIONS.has(ext);
}

/**
 * Recursively collect all scannable files
 */
function collectFiles(dir: string, files: string[] = [], maxFiles: number = 200): string[] {
  if (files.length >= maxFiles) return files;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (files.length >= maxFiles) break;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (!EXCLUDED_DIRS.has(entry.name)) {
          collectFiles(fullPath, files, maxFiles);
        }
      } else if (entry.isFile() && shouldScanFile(fullPath)) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Ignore permission errors
    console.warn(`[projectIssuesScanner] Cannot read directory: ${dir}`);
  }

  return files;
}

/**
 * Analyze a single file for issues (simplified version for scanner)
 * This uses the same patterns as analyzeCodeLocally in main.ts
 */
// Phase 129.7: Export for ACE
export function analyzeFile(filePath: string, code: string): FileIssuesSummary['issues'] {
  const issues: FileIssuesSummary['issues'] = [];
  const lines = code.split('\n');
  const ext = path.extname(filePath).toLowerCase();
  const isTypeScript = ext === '.ts' || ext === '.tsx';
  const isTestFile = /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath);

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) return;

    // Check for console.log
    if (line.includes('console.log') && !isTestFile) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'warning',
        category: 'best-practice',
        message: 'console.log() should be removed in production',
        lineStart: lineNum,
        lineEnd: lineNum,
      });
    }

    // Check for debugger
    if (/\bdebugger\b/.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'error',
        category: 'best-practice',
        message: 'debugger statement should be removed',
        lineStart: lineNum,
        lineEnd: lineNum,
      });
    }

    // Check for == instead of ===
    if (/[^!=]==[^=]/.test(line) && !line.includes('===')) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'warning',
        category: 'logic',
        message: 'Use === instead of == for strict equality',
        lineStart: lineNum,
        lineEnd: lineNum,
      });
    }

    // Check for != instead of !==
    if (/[^!]!=[^=]/.test(line) && !line.includes('!==')) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'warning',
        category: 'logic',
        message: 'Use !== instead of != for strict inequality',
        lineStart: lineNum,
        lineEnd: lineNum,
      });
    }

    // Check for var usage
    if (/\bvar\s+/.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'warning',
        category: 'best-practice',
        message: 'Use let or const instead of var',
        lineStart: lineNum,
        lineEnd: lineNum,
      });
    }

    // Check for any type in TypeScript
    if (isTypeScript && /:\s*any\b/.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'warning',
        category: 'style',
        message: 'Avoid using "any" type',
        lineStart: lineNum,
        lineEnd: lineNum,
      });
    }

    // Check for hardcoded secrets
    if (/(?:password|secret|api_key|apikey|token)\s*[:=]\s*['"][^'"]+['"]/i.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'error',
        category: 'security',
        message: 'Potential hardcoded secret - use environment variables',
        lineStart: lineNum,
        lineEnd: lineNum,
      });
    }

    // Check for eval
    if (/\beval\s*\(/.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'error',
        category: 'security',
        message: 'eval() is dangerous - find a safer alternative',
        lineStart: lineNum,
        lineEnd: lineNum,
      });
    }

    // Check for innerHTML
    if (/\.innerHTML\s*=/.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'warning',
        category: 'security',
        message: 'innerHTML can lead to XSS - use textContent or sanitize input',
        lineStart: lineNum,
        lineEnd: lineNum,
      });
    }

    // Check for empty catch blocks
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(line)) {
      issues.push({
        id: `f0-issue-${Math.random().toString(36).slice(2, 8)}`,
        severity: 'warning',
        category: 'logic',
        message: 'Empty catch block - errors should be handled or logged',
        lineStart: lineNum,
        lineEnd: lineNum,
      });
    }
  });

  return issues;
}

/**
 * Scan entire project for issues
 */
export async function scanProjectForIssues(
  options: ScanProjectOptions
): Promise<ProjectScanResult> {
  const { projectRoot, maxFiles = 200, onProgress } = options;
  const startTime = Date.now();

  console.log(`[projectIssuesScanner] Starting scan at: ${projectRoot} (max ${maxFiles} files)`);

  // Collect files to scan
  const files = collectFiles(projectRoot, [], maxFiles);
  const totalFiles = files.length;
  console.log(`[projectIssuesScanner] Found ${totalFiles} files to scan`);

  const summaries: FileIssuesSummary[] = [];
  let totalIssues = 0;
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalInfos = 0;
  let skippedFiles = 0;

  // Scan each file
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const relativePath = path.relative(projectRoot, filePath);

    if (onProgress) {
      onProgress(i + 1, totalFiles, relativePath);
    }

    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      const issues = analyzeFile(filePath, code);

      if (issues.length > 0) {
        const errors = issues.filter((i) => i.severity === 'error').length;
        const warnings = issues.filter((i) => i.severity === 'warning').length;
        const infos = issues.filter((i) => i.severity === 'info').length;

        // Count by category
        const categories: Record<string, number> = {};
        issues.forEach((issue) => {
          categories[issue.category] = (categories[issue.category] || 0) + 1;
        });

        summaries.push({
          filePath,
          relativePath,
          issueCount: issues.length,
          errors,
          warnings,
          infos,
          categories,
          issues,
        });

        totalIssues += issues.length;
        totalErrors += errors;
        totalWarnings += warnings;
        totalInfos += infos;
      }
    } catch (err) {
      console.warn(`[projectIssuesScanner] Failed to scan: ${relativePath}`);
      skippedFiles++;
    }
  }

  const scanDurationMs = Date.now() - startTime;

  // Sort by issue count (most issues first)
  summaries.sort((a, b) => b.issueCount - a.issueCount);

  console.log(
    `[projectIssuesScanner] Scan complete: ${totalFiles} files, ${totalIssues} issues, ${scanDurationMs}ms`
  );

  return {
    scannedFiles: totalFiles - skippedFiles,
    totalIssues,
    totalErrors,
    totalWarnings,
    totalInfos,
    summaries,
    skippedFiles,
    scanDurationMs,
  };
}

export default scanProjectForIssues;
