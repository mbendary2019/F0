// desktop/src/lib/agent/tools/issueFixer.ts
// Phase 124.6.2: AI Issue Fix Generator
// Phase 124.7: Batch Issue Fix (Fix All)
// Generates code fixes for issues detected by code review

import type { F0Issue } from '../../types/issues';

/**
 * Input for apply issue fix tool
 */
export interface ApplyIssueFixInput {
  /** File path to fix */
  filePath: string;
  /** Current source code */
  source: string;
  /** Issue to fix */
  issue: F0Issue;
  /** Project root (for context) */
  projectRoot?: string;
}

/**
 * Result from apply issue fix tool
 */
export interface ApplyIssueFixResult {
  /** Whether fix was generated successfully */
  success: boolean;
  /** File path */
  filePath: string;
  /** Fixed source code (full file) */
  fixedSource?: string;
  /** Unified diff format (optional alternative) */
  unifiedDiff?: string;
  /** Description of the fix applied */
  summary: string;
  /** Error message if failed */
  error?: string;
}

// ============================================
// Phase 124.7: Batch Issue Fix Types
// ============================================

/**
 * Input for batch apply issue fix tool
 */
export interface BatchApplyIssueFixInput {
  /** Project root (for context) */
  projectRoot?: string | null;
  /** File path to fix */
  filePath: string;
  /** Current source code */
  source: string;
  /** Array of issues to fix */
  issues: F0Issue[];
}

/**
 * Result from batch apply issue fix tool
 */
export interface BatchApplyIssueFixResult {
  /** Whether batch fix was successful (at least one fix applied) */
  success: boolean;
  /** File path */
  filePath: string;
  /** Fixed source code (full file) */
  fixedSource: string;
  /** IDs of issues that were successfully fixed */
  appliedIssueIds: string[];
  /** IDs of issues that were skipped */
  skippedIssueIds: string[];
  /** Summary of what was done */
  summary: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Build a prompt for the LLM to fix an issue
 * This focuses on the specific lines with context
 */
export function buildIssueFixPrompt(input: ApplyIssueFixInput): string {
  const { filePath, source, issue } = input;
  const lines = source.split('\n');

  // Get context: 5 lines before and after the issue
  const contextBefore = 5;
  const contextAfter = 5;
  const startLine = Math.max(0, issue.lineStart - 1 - contextBefore);
  const endLine = Math.min(lines.length, issue.lineEnd + contextAfter);

  // Build the context snippet with line numbers
  const contextLines = lines
    .slice(startLine, endLine)
    .map((line, i) => {
      const lineNum = startLine + i + 1;
      const marker = (lineNum >= issue.lineStart && lineNum <= issue.lineEnd) ? '>>>' : '   ';
      return `${marker} ${lineNum.toString().padStart(4)}: ${line}`;
    })
    .join('\n');

  const prompt = `You are a code fixer assistant. Fix the following issue in the code.

FILE: ${filePath}
ISSUE TYPE: ${issue.severity} (${issue.category})
ISSUE MESSAGE: ${issue.message}
ISSUE LINES: ${issue.lineStart}-${issue.lineEnd}
${issue.fixPrompt ? `FIX HINT: ${issue.fixPrompt}` : ''}

CONTEXT (lines marked with >>> need fixing):
\`\`\`
${contextLines}
\`\`\`

FULL FILE:
\`\`\`
${source}
\`\`\`

INSTRUCTIONS:
1. Fix ONLY the issue described above
2. Keep the rest of the code exactly the same
3. Maintain the same coding style (indentation, quotes, etc.)
4. Return the COMPLETE fixed file content
5. Do NOT add explanations - only return the fixed code

Return the fixed code wrapped in \`\`\` markers.`;

  return prompt;
}

/**
 * Parse the LLM response to extract the fixed code
 */
export function parseFixResponse(response: string): string | null {
  // Try to extract code from markdown code blocks
  const codeBlockMatch = response.match(/```(?:\w*\n)?([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim();
  }

  // If no code block, check if the entire response is code
  // (starts with import/export/const/function/class or similar)
  const codeIndicators = [
    /^import\s/,
    /^export\s/,
    /^const\s/,
    /^let\s/,
    /^var\s/,
    /^function\s/,
    /^class\s/,
    /^\/\//,
    /^\/\*/,
    /^'use\s/,
    /^"use\s/,
  ];

  const firstLine = response.trim().split('\n')[0];
  for (const indicator of codeIndicators) {
    if (indicator.test(firstLine)) {
      return response.trim();
    }
  }

  return null;
}

/**
 * Generate a unified diff between old and new source
 * Simple implementation for display purposes
 */
export function generateUnifiedDiff(
  filePath: string,
  oldSource: string,
  newSource: string
): string {
  const oldLines = oldSource.split('\n');
  const newLines = newSource.split('\n');

  const diff: string[] = [];
  diff.push(`--- a/${filePath}`);
  diff.push(`+++ b/${filePath}`);

  // Simple line-by-line diff (not optimal but works for display)
  let i = 0;
  let j = 0;
  let hunkStart = -1;
  const hunkLines: string[] = [];

  while (i < oldLines.length || j < newLines.length) {
    const oldLine = oldLines[i];
    const newLine = newLines[j];

    if (oldLine === newLine) {
      if (hunkLines.length > 0) {
        hunkLines.push(` ${oldLine || ''}`);
      }
      i++;
      j++;
    } else if (oldLine !== undefined && (newLine === undefined || oldLine !== newLines[j + 1])) {
      // Line removed
      if (hunkStart === -1) {
        hunkStart = i + 1;
        // Add context before
        for (let k = Math.max(0, i - 3); k < i; k++) {
          hunkLines.push(` ${oldLines[k]}`);
        }
      }
      hunkLines.push(`-${oldLine}`);
      i++;
    } else {
      // Line added
      if (hunkStart === -1) {
        hunkStart = i + 1;
        // Add context before
        for (let k = Math.max(0, i - 3); k < i; k++) {
          hunkLines.push(` ${oldLines[k]}`);
        }
      }
      hunkLines.push(`+${newLine}`);
      j++;
    }
  }

  if (hunkLines.length > 0) {
    diff.push(`@@ -${hunkStart},${oldLines.length} +${hunkStart},${newLines.length} @@`);
    diff.push(...hunkLines);
  }

  return diff.join('\n');
}

/**
 * Local fix generator (fallback when LLM is not available)
 * Handles simple, pattern-based fixes
 */
export function generateLocalFix(input: ApplyIssueFixInput): ApplyIssueFixResult {
  const { filePath, source, issue } = input;
  const lines = source.split('\n');

  // Try to apply automatic fixes for known issue types
  let fixedSource: string | null = null;
  let summary = '';

  switch (issue.category) {
    case 'best-practice':
      // Handle console.log removal
      // Phase 129.8: Improved regex to handle nested parens and complex calls
      if (issue.message.includes('console.log')) {
        const lineIndex = issue.lineStart - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          const originalLine = lines[lineIndex];
          // More robust pattern: match console.log followed by balanced parens or until end of statement
          // First try simple pattern, then fallback to line-based removal
          let newLine = originalLine.replace(
            /console\.log\s*\([^;]*\);?/g,
            '/* console.log removed */'
          );
          // If no change, try matching to end of line (for complex multi-arg calls)
          if (newLine === originalLine && originalLine.includes('console.log')) {
            newLine = originalLine.replace(
              /console\.log\s*\(.*$/,
              '/* console.log removed */'
            );
          }
          // If still no change and line starts with console.log, comment entire line
          if (newLine === originalLine && originalLine.trim().startsWith('console.log')) {
            newLine = originalLine.replace(originalLine.trim(), '/* ' + originalLine.trim() + ' */');
          }

          if (newLine !== originalLine) {
            lines[lineIndex] = newLine;
            fixedSource = lines.join('\n');
            summary = 'Removed console.log statement';
          }
        }
      }
      // Handle debugger statement removal
      else if (issue.message.includes('debugger')) {
        const lineIndex = issue.lineStart - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          lines[lineIndex] = lines[lineIndex].replace(/\bdebugger;?\s*/g, '');
          // If line is now empty (or just whitespace), remove it
          if (lines[lineIndex].trim() === '') {
            lines.splice(lineIndex, 1);
          }
          fixedSource = lines.join('\n');
          summary = 'Removed debugger statement';
        }
      }
      // Handle == to === conversion
      else if (issue.message.includes('=== instead of ==')) {
        const lineIndex = issue.lineStart - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          lines[lineIndex] = lines[lineIndex].replace(/([^!=])={2}([^=])/g, '$1===$2');
          fixedSource = lines.join('\n');
          summary = 'Replaced == with === for strict equality';
        }
      }
      // Handle != to !== conversion
      else if (issue.message.includes('!== instead of !=')) {
        const lineIndex = issue.lineStart - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          lines[lineIndex] = lines[lineIndex].replace(/([^!])!={1}([^=])/g, '$1!==$2');
          fixedSource = lines.join('\n');
          summary = 'Replaced != with !== for strict inequality';
        }
      }
      // Handle var to const conversion
      else if (issue.message.includes('let or const instead of var')) {
        const lineIndex = issue.lineStart - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          lines[lineIndex] = lines[lineIndex].replace(/\bvar\s+/, 'const ');
          fixedSource = lines.join('\n');
          summary = 'Replaced var with const for better scoping';
        }
      }
      // Handle document.write removal
      else if (issue.message.includes('document.write')) {
        const lineIndex = issue.lineStart - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          lines[lineIndex] = lines[lineIndex].replace(
            /document\.write\([^)]*\);?/g,
            '/* document.write removed - use DOM methods instead */'
          );
          fixedSource = lines.join('\n');
          summary = 'Removed document.write (use DOM methods instead)';
        }
      }
      // Handle alert() removal
      else if (issue.message.includes('alert()')) {
        const lineIndex = issue.lineStart - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          lines[lineIndex] = lines[lineIndex].replace(
            /\balert\s*\([^)]*\);?/g,
            '/* alert removed - use proper UI notification */'
          );
          fixedSource = lines.join('\n');
          summary = 'Removed alert() (use proper UI notification)';
        }
      }
      break;

    case 'style':
      // Handle TODO/FIXME - can't auto-fix, just acknowledge
      if (issue.message.includes('TODO') || issue.message.includes('FIXME')) {
        return {
          success: false,
          filePath,
          summary: 'TODO/FIXME comments require manual attention',
          error: 'Cannot auto-fix TODO/FIXME comments - requires manual implementation',
        };
      }

      // Handle 'any' type replacement
      if (issue.message.includes('"any"')) {
        const lineIndex = issue.lineStart - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          // Replace : any with : unknown as a safer alternative
          lines[lineIndex] = lines[lineIndex].replace(/:\s*any\b/g, ': unknown');
          fixedSource = lines.join('\n');
          summary = 'Replaced "any" with "unknown" for better type safety';
        }
      }
      break;

    case 'logic':
      // Handle empty catch block - add console.error
      if (issue.message.includes('Empty catch block')) {
        const lineIndex = issue.lineStart - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          // Find the closing brace and add error handling
          const catchLine = lines[lineIndex];
          const indent = catchLine.match(/^\s*/)?.[0] || '';
          // Check if next line is just '}'
          if (lineIndex + 1 < lines.length && lines[lineIndex + 1].trim() === '}') {
            lines[lineIndex + 1] = `${indent}  console.error(e);\n${indent}}`;
            fixedSource = lines.join('\n');
            summary = 'Added console.error to empty catch block';
          }
        }
      }
      // Phase 124.7.2: JSON fixes
      // Handle trailing comma in JSON
      else if (issue.message.includes('Trailing comma')) {
        const lineIndex = issue.lineStart - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          // Remove trailing comma
          lines[lineIndex] = lines[lineIndex].replace(/,(\s*)$/, '$1');
          fixedSource = lines.join('\n');
          summary = 'Removed trailing comma from JSON';
        }
      }
      // Handle single quotes in JSON (replace with double quotes)
      else if (issue.message.includes('double quotes, not single quotes')) {
        const lineIndex = issue.lineStart - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          // Replace single quotes with double quotes
          lines[lineIndex] = lines[lineIndex].replace(/'([^']*)'/g, '"$1"');
          fixedSource = lines.join('\n');
          summary = 'Replaced single quotes with double quotes';
        }
      }
      // Handle comments in JSON (remove them)
      else if (issue.message.includes('Comments are not allowed')) {
        const lineIndex = issue.lineStart - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          // Remove the comment line entirely
          lines.splice(lineIndex, 1);
          fixedSource = lines.join('\n');
          summary = 'Removed comment from JSON';
        }
      }
      // JSON Syntax Error cannot be auto-fixed - requires manual attention
      else if (issue.message.includes('JSON Syntax Error')) {
        return {
          success: false,
          filePath,
          summary: 'JSON syntax error requires manual fix',
          error: 'Cannot auto-fix JSON syntax errors - please review the error message and fix manually',
        };
      }
      // Handle duplicate keys - cannot auto-fix safely
      else if (issue.message.includes('Duplicate key')) {
        return {
          success: false,
          filePath,
          summary: 'Duplicate keys require manual review',
          error: 'Cannot auto-fix duplicate keys - please review which value should be kept',
        };
      }
      break;

    case 'security':
      // Cannot auto-fix security issues safely
      return {
        success: false,
        filePath,
        summary: 'Security issues require manual review',
        error: 'Cannot auto-fix security issues - requires manual code review and testing',
      };

    default:
      break;
  }

  if (fixedSource) {
    return {
      success: true,
      filePath,
      fixedSource,
      summary,
    };
  }

  return {
    success: false,
    filePath,
    summary: 'Could not generate automatic fix',
    error: `No automatic fix available for: ${issue.message}`,
  };
}

/**
 * Main function to apply issue fix
 * Uses LLM if available, falls back to local patterns
 */
export async function applyIssueFix(
  input: ApplyIssueFixInput,
  llmCall?: (prompt: string) => Promise<string>
): Promise<ApplyIssueFixResult> {
  const { filePath, source, issue } = input;

  console.log(`[issueFixer] Attempting to fix issue in ${filePath}: ${issue.message}`);

  // If LLM is available, use it
  if (llmCall) {
    try {
      const prompt = buildIssueFixPrompt(input);
      const response = await llmCall(prompt);
      const fixedSource = parseFixResponse(response);

      if (fixedSource && fixedSource !== source) {
        return {
          success: true,
          filePath,
          fixedSource,
          unifiedDiff: generateUnifiedDiff(filePath, source, fixedSource),
          summary: `Fixed: ${issue.message}`,
        };
      }
    } catch (error) {
      console.error('[issueFixer] LLM call failed:', error);
      // Fall through to local fix
    }
  }

  // Fall back to local pattern-based fixes
  return generateLocalFix(input);
}

// ============================================
// Phase 124.7: Batch Issue Fix Function
// ============================================

/**
 * Apply fixes for multiple issues in a single file
 * Issues are sorted from bottom to top to preserve line numbers
 */
export async function batchApplyIssueFix(
  input: BatchApplyIssueFixInput,
): Promise<BatchApplyIssueFixResult> {
  const { filePath, source, issues } = input;

  console.log(`[batchApplyIssueFix] Starting batch fix for ${filePath} with ${issues.length} issues`);

  // If no issues, return early
  if (!issues.length) {
    return {
      success: false,
      filePath,
      fixedSource: source,
      appliedIssueIds: [],
      skippedIssueIds: [],
      summary: 'No issues to fix',
      error: 'No issues provided',
    };
  }

  let working = source;
  const appliedIssueIds: string[] = [];
  const skippedIssueIds: string[] = [];

  // Sort issues from bottom to top to preserve line numbers when fixing
  const sortedIssues = [...issues].sort(
    (a, b) => b.lineStart - a.lineStart,
  );

  for (const issue of sortedIssues) {
    // Skip security issues - they require manual review
    if (issue.category === 'security') {
      console.log(`[batchApplyIssueFix] Skipping security issue: ${issue.id}`);
      skippedIssueIds.push(issue.id);
      continue;
    }

    try {
      // Use the same local fix logic
      const result = generateLocalFix({
        filePath,
        source: working,
        issue,
      });

      if (result.success && result.fixedSource && result.fixedSource !== working) {
        working = result.fixedSource;
        appliedIssueIds.push(issue.id);
        console.log(`[batchApplyIssueFix] Applied fix for issue: ${issue.id} - ${result.summary}`);
      } else {
        console.log(`[batchApplyIssueFix] Could not fix issue: ${issue.id} - ${result.error || 'No fix available'}`);
        skippedIssueIds.push(issue.id);
      }
    } catch (err) {
      console.warn('[batchApplyIssueFix] Skipped issue due to error', {
        issueId: issue.id,
        err,
      });
      skippedIssueIds.push(issue.id);
    }
  }

  const summary = `Applied ${appliedIssueIds.length} fix${appliedIssueIds.length !== 1 ? 'es' : ''}, skipped ${skippedIssueIds.length}.`;

  console.log(`[batchApplyIssueFix] ${summary}`);

  return {
    success: appliedIssueIds.length > 0,
    filePath,
    fixedSource: working,
    appliedIssueIds,
    skippedIssueIds,
    summary,
  };
}

export default applyIssueFix;
