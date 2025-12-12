// desktop/src/lib/atp/failingTestAnalyzer.ts
// Phase 140.4: Failing Test Analyzer
// Analyzes test failures and creates suggested fixes

import type {
  RawTestFailure,
  FailureLocation,
  SuggestedFix,
  FailingTestsSummary,
  FailingTestAnalysisResult,
} from './failingTestTypes';

/**
 * Generate a unique ID for a suggested fix
 */
function generateFixId(): string {
  return `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract failure location from a stack trace
 *
 * Parses common stack trace formats:
 * - Node.js: "at functionName (file.ts:line:col)"
 * - Jest/Vitest: "at Object.<anonymous> (file.ts:line:col)"
 *
 * @param stackTrace - Raw stack trace string
 * @returns FailureLocation or undefined if not found
 */
export function extractFailureLocationFromStack(
  stackTrace: string | undefined,
): FailureLocation | undefined {
  if (!stackTrace) return undefined;

  // Common patterns for extracting file:line:col
  const patterns = [
    // Standard Node.js format: at functionName (file.ts:line:col)
    /at\s+(?:[\w.<>]+\s+)?\((.+):(\d+):(\d+)\)/,
    // Short format: at file.ts:line:col
    /at\s+(.+):(\d+):(\d+)/,
    // Jest/Vitest format with parentheses
    /\((.+\.(?:ts|tsx|js|jsx)):(\d+):(\d+)\)/,
    // Simple file:line format
    /(.+\.(?:ts|tsx|js|jsx)):(\d+)(?::(\d+))?/,
  ];

  const lines = stackTrace.split('\n');

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const [, filePath, lineStr, colStr] = match;

        // Skip node_modules
        if (filePath.includes('node_modules')) continue;

        return {
          filePath: filePath.trim(),
          line: parseInt(lineStr, 10),
          column: colStr ? parseInt(colStr, 10) : undefined,
        };
      }
    }
  }

  return undefined;
}

/**
 * Summarize an error message to a short reason
 *
 * @param errorMessage - Full error message
 * @returns Short summary (max 100 chars)
 */
export function summarizeErrorMessage(errorMessage: string): string {
  // Remove ANSI escape codes
  const cleaned = errorMessage.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

  // Common patterns to extract key info
  const patterns = [
    // "Expected X but received Y"
    /Expected\s+(.{1,50})\s+but\s+received\s+(.{1,50})/i,
    // "Cannot read property 'X' of undefined"
    /Cannot read propert(?:y|ies)\s+'([^']+)'\s+of\s+(\w+)/i,
    // "TypeError: X is not a function"
    /TypeError:\s+(.{1,80})/i,
    // "ReferenceError: X is not defined"
    /ReferenceError:\s+(.{1,80})/i,
    // "AssertionError: X"
    /AssertionError:\s+(.{1,80})/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const summary = match[0].substring(0, 100);
      return summary.length < match[0].length ? summary + '...' : summary;
    }
  }

  // Fallback: first line, truncated
  const firstLine = cleaned.split('\n')[0].trim();
  return firstLine.length > 100 ? firstLine.substring(0, 97) + '...' : firstLine;
}

/**
 * Convert a raw test failure to a suggested fix
 *
 * @param failure - Raw test failure
 * @returns SuggestedFix with extracted information
 */
export function failureToSuggestedFix(failure: RawTestFailure): SuggestedFix {
  // Extract test file location from stack trace
  const testLocation = extractFailureLocationFromStack(failure.stackTrace);

  // Try to infer source location (where the actual bug might be)
  // This looks for non-test file references in the stack
  let sourceLocation: FailureLocation | undefined;
  if (failure.stackTrace) {
    const lines = failure.stackTrace.split('\n');
    for (const line of lines) {
      // Skip test files
      if (
        line.includes('.test.') ||
        line.includes('.spec.') ||
        line.includes('__tests__')
      ) {
        continue;
      }

      const loc = extractFailureLocationFromStack(line);
      if (loc && !loc.filePath.includes('node_modules')) {
        sourceLocation = loc;
        break;
      }
    }
  }

  return {
    id: generateFixId(),
    suiteId: failure.suiteId,
    suiteName: failure.suiteName,
    kind: failure.kind,
    testName: failure.testName,
    errorMessage: failure.errorMessage,
    stackTrace: failure.stackTrace,
    testLocation,
    sourceLocation,
    shortReason: summarizeErrorMessage(failure.errorMessage),
    status: 'pending',
    createdAt: Date.now(),
  };
}

/**
 * Build a summary of failing tests
 *
 * @param failures - Array of raw test failures
 * @param fixes - Array of suggested fixes
 * @returns FailingTestsSummary
 */
export function buildFailingTestsSummary(
  failures: RawTestFailure[],
  fixes: SuggestedFix[],
): FailingTestsSummary {
  // Get unique suite IDs with failures
  const suitesWithFailures = [...new Set(failures.map((f) => f.suiteId))];

  return {
    totalFailures: failures.length,
    suitesWithFailures,
    suggestedFixesCount: fixes.length,
  };
}

/**
 * Analyze failing tests and generate suggested fixes
 *
 * @param failures - Array of raw test failures
 * @returns Analysis result with suggested fixes
 */
export function analyzeFailingTests(
  failures: RawTestFailure[],
): FailingTestAnalysisResult {
  // Convert each failure to a suggested fix
  const suggestedFixes = failures.map(failureToSuggestedFix);

  // Build summary
  const summary = buildFailingTestsSummary(failures, suggestedFixes);

  return {
    rawFailures: failures,
    suggestedFixes,
    summary,
  };
}

/**
 * Get a human-readable summary of the analysis
 */
export function getFailingTestsSummaryText(summary: FailingTestsSummary): string {
  if (summary.totalFailures === 0) {
    return 'All tests passed!';
  }

  const parts: string[] = [];

  parts.push(`${summary.totalFailures} failing test(s)`);
  parts.push(`in ${summary.suitesWithFailures.length} suite(s)`);

  if (summary.suggestedFixesCount > 0) {
    parts.push(`${summary.suggestedFixesCount} suggested fix(es)`);
  }

  return parts.join(' | ');
}

/**
 * Group failures by file path
 */
export function groupFailuresByFile(
  fixes: SuggestedFix[],
): Map<string, SuggestedFix[]> {
  const grouped = new Map<string, SuggestedFix[]>();

  for (const fix of fixes) {
    // Use test location file, or 'unknown' if not available
    const filePath = fix.testLocation?.filePath || 'unknown';
    const existing = grouped.get(filePath) || [];
    existing.push(fix);
    grouped.set(filePath, existing);
  }

  return grouped;
}

/**
 * Filter fixes by status
 */
export function filterFixesByStatus(
  fixes: SuggestedFix[],
  statuses: SuggestedFix['status'][],
): SuggestedFix[] {
  return fixes.filter((f) => statuses.includes(f.status));
}
