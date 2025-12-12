// src/lib/agents/federation/reviewAgent.ts
// =============================================================================
// Phase 155.4 – ReviewAgent Implementation
// Reviews code changes before commit for quality and security
// =============================================================================

import type {
  AgentBus,
  AgentMessage,
  ReviewRequestPayload,
  ReviewResultPayload,
} from './types';
import { createMessage, getAgentBus } from './bus';
import { createReviewApprovedEnvelope, createHumanApprovalEnvelope } from './safety';

// =============================================================================
// Types
// =============================================================================

export type ReviewConfig = {
  /** Minimum score to auto-approve (0-100) */
  autoApproveThreshold?: number;
  /** Whether to check for security issues */
  checkSecurity?: boolean;
  /** Whether to check for best practices */
  checkBestPractices?: boolean;
  /** Whether to check for performance issues */
  checkPerformance?: boolean;
  /** Maximum file size to review (bytes) */
  maxFileSize?: number;
};

export type CodeIssue = {
  severity: 'error' | 'warning' | 'info';
  file: string;
  line?: number;
  column?: number;
  message: string;
  rule?: string;
  suggestion?: string;
};

export type ReviewResult = {
  approved: boolean;
  score: number;
  issues: CodeIssue[];
  summary: string;
};

// =============================================================================
// Review Rules
// =============================================================================

/**
 * Security patterns to detect
 */
const SECURITY_PATTERNS: Array<{ pattern: RegExp; message: string; severity: 'error' | 'warning' }> = [
  { pattern: /eval\s*\(/, message: 'Avoid using eval() - security risk', severity: 'error' },
  { pattern: /dangerouslySetInnerHTML/, message: 'dangerouslySetInnerHTML can lead to XSS', severity: 'warning' },
  { pattern: /process\.env\.[A-Z_]+\s*(?!\?\?|!|\||&&)/, message: 'Ensure env variables have fallbacks', severity: 'info' as 'warning' },
  { pattern: /password\s*=\s*['"][^'"]+['"]/, message: 'Hardcoded password detected', severity: 'error' },
  { pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/, message: 'Hardcoded API key detected', severity: 'error' },
  { pattern: /secret\s*=\s*['"][^'"]+['"]/, message: 'Hardcoded secret detected', severity: 'error' },
  { pattern: /innerHTML\s*=/, message: 'Direct innerHTML assignment - XSS risk', severity: 'warning' },
  { pattern: /document\.write\s*\(/, message: 'Avoid document.write() - security and performance', severity: 'warning' },
];

/**
 * Best practice patterns to check
 */
const BEST_PRACTICE_PATTERNS: Array<{ pattern: RegExp; message: string; severity: 'warning' | 'info' }> = [
  { pattern: /console\.log\s*\(/, message: 'Remove console.log before production', severity: 'info' },
  { pattern: /TODO:/i, message: 'Unresolved TODO comment', severity: 'info' },
  { pattern: /FIXME:/i, message: 'FIXME comment needs attention', severity: 'warning' },
  { pattern: /any(?:\s|;|,|\))/, message: 'Avoid using "any" type - prefer specific types', severity: 'info' },
  { pattern: /as\s+any/, message: 'Avoid type assertions to "any"', severity: 'warning' },
  { pattern: /\!\s*important/, message: 'Avoid !important in CSS', severity: 'info' },
  { pattern: /eslint-disable(?!-next-line)/, message: 'Avoid disabling ESLint for entire files', severity: 'warning' },
  { pattern: /@ts-ignore/, message: 'Avoid @ts-ignore - fix the type issue', severity: 'warning' },
];

/**
 * Performance patterns to check
 */
const PERFORMANCE_PATTERNS: Array<{ pattern: RegExp; message: string; severity: 'warning' | 'info' }> = [
  { pattern: /new\s+Date\s*\(\)\s*\.getTime\s*\(\)/, message: 'Use Date.now() instead for better performance', severity: 'info' },
  { pattern: /\.forEach\s*\([^)]*async/, message: 'forEach with async doesn\'t await properly', severity: 'warning' },
  { pattern: /JSON\.parse\s*\(\s*JSON\.stringify/, message: 'Deep clone with JSON is slow - use structuredClone or lodash', severity: 'info' },
  { pattern: /\[\.\.\.\w+,\s*\.\.\.\w+\]/, message: 'Multiple spreads can be slow - consider concat()', severity: 'info' },
];

// =============================================================================
// ReviewAgent Class
// =============================================================================

/**
 * Agent responsible for reviewing code changes
 */
export class ReviewAgent {
  private config: ReviewConfig;
  private bus: AgentBus;

  constructor(config?: ReviewConfig) {
    this.config = {
      autoApproveThreshold: config?.autoApproveThreshold ?? 80,
      checkSecurity: config?.checkSecurity ?? true,
      checkBestPractices: config?.checkBestPractices ?? true,
      checkPerformance: config?.checkPerformance ?? true,
      maxFileSize: config?.maxFileSize ?? 100000, // 100KB
    };
    this.bus = getAgentBus();

    console.log('[155.4][AGENTS][REVIEW] ReviewAgent initialized');
  }

  /**
   * Start listening for review requests
   */
  start(): () => void {
    console.log('[155.4][AGENTS][REVIEW] Starting listener');

    return this.bus.subscribe<ReviewRequestPayload>('review', async (message) => {
      if (message.kind !== 'review_request') return;

      console.log('[155.4][AGENTS][REVIEW] Received review request:', message.id);

      try {
        const result = await this.reviewCode(message.payload);

        // Determine envelope based on result
        const envelope = result.approved
          ? createReviewApprovedEnvelope(`Score: ${result.score}/100`)
          : createHumanApprovalEnvelope(
              result.issues.some(i => i.severity === 'error') ? 'high' : 'medium',
              `Review failed with score ${result.score}/100`
            );

        // Send review result
        const response = createMessage<ReviewResultPayload>({
          from: 'review',
          to: 'broadcast',
          kind: 'review_result',
          payload: {
            taskId: message.payload.taskId,
            approved: result.approved,
            score: result.score,
            issues: result.issues,
            summary: result.summary,
          },
          projectId: message.projectId,
          sessionId: message.sessionId,
          parentMessageId: message.id,
          envelope,
        });

        await this.bus.send(response);

      } catch (error) {
        console.error('[155.4][AGENTS][REVIEW] Error reviewing code:', error);

        // Send error message
        const errorMsg = createMessage({
          from: 'review',
          to: 'broadcast',
          kind: 'error',
          payload: {
            code: 'REVIEW_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            recoverable: true,
            taskId: message.payload.taskId,
          },
          projectId: message.projectId,
          sessionId: message.sessionId,
          parentMessageId: message.id,
        });

        await this.bus.send(errorMsg);
      }
    });
  }

  /**
   * Review code changes
   */
  async reviewCode(request: ReviewRequestPayload): Promise<ReviewResult> {
    console.log('[155.4][AGENTS][REVIEW] Reviewing', request.files.length, 'files');

    const issues: CodeIssue[] = [];

    for (const file of request.files) {
      // Check file size
      if (file.content.length > (this.config.maxFileSize ?? 100000)) {
        issues.push({
          severity: 'warning',
          file: file.path,
          message: `File exceeds ${(this.config.maxFileSize ?? 100000) / 1000}KB - review truncated`,
        });
        continue;
      }

      // Run checks
      if (this.config.checkSecurity) {
        issues.push(...this.checkPatterns(file.path, file.content, SECURITY_PATTERNS));
      }

      if (this.config.checkBestPractices) {
        issues.push(...this.checkPatterns(file.path, file.content, BEST_PRACTICE_PATTERNS));
      }

      if (this.config.checkPerformance) {
        issues.push(...this.checkPatterns(file.path, file.content, PERFORMANCE_PATTERNS));
      }

      // Check for common file-specific issues
      issues.push(...this.checkFileSpecific(file.path, file.content));
    }

    // Calculate score
    const score = this.calculateScore(issues);

    // Determine if approved
    const approved = score >= (this.config.autoApproveThreshold ?? 80);

    // Generate summary
    const summary = this.generateSummary(issues, score, approved);

    console.log('[155.4][AGENTS][REVIEW] Review complete:', { score, approved, issueCount: issues.length });

    return { approved, score, issues, summary };
  }

  /**
   * Check content against patterns
   */
  private checkPatterns(
    filePath: string,
    content: string,
    patterns: Array<{ pattern: RegExp; message: string; severity: 'error' | 'warning' | 'info' }>
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      for (const { pattern, message, severity } of patterns) {
        const match = line.match(pattern);
        if (match) {
          issues.push({
            severity,
            file: filePath,
            line: lineNum + 1,
            column: match.index,
            message,
            rule: pattern.source.slice(0, 30),
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check file-specific issues
   */
  private checkFileSpecific(filePath: string, content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const ext = filePath.split('.').pop()?.toLowerCase();

    // React/TSX specific checks
    if (ext === 'tsx' || ext === 'jsx') {
      // Check for missing key in map
      const mapWithoutKey = content.match(/\.map\s*\([^)]+\)\s*=>\s*<[^>]+(?!key=)/g);
      if (mapWithoutKey) {
        issues.push({
          severity: 'warning',
          file: filePath,
          message: 'Array.map() rendering elements may be missing key prop',
        });
      }

      // Check for missing 'use client' in client components
      if (
        (content.includes('useState') || content.includes('useEffect') || content.includes('onClick')) &&
        !content.includes("'use client'") &&
        !content.includes('"use client"')
      ) {
        issues.push({
          severity: 'warning',
          file: filePath,
          line: 1,
          message: 'Client-side hooks/events used without "use client" directive',
        });
      }
    }

    // TypeScript specific checks
    if (ext === 'ts' || ext === 'tsx') {
      // Check for explicit any
      const explicitAny = content.match(/:\s*any\b/g);
      if (explicitAny && explicitAny.length > 3) {
        issues.push({
          severity: 'warning',
          file: filePath,
          message: `Multiple explicit "any" types (${explicitAny.length}) - consider proper typing`,
        });
      }
    }

    // Package.json checks
    if (filePath.endsWith('package.json')) {
      try {
        const pkg = JSON.parse(content);
        if (!pkg.version) {
          issues.push({
            severity: 'info',
            file: filePath,
            message: 'Missing version field in package.json',
          });
        }
        if (pkg.dependencies?.['lodash'] && !pkg.dependencies?.['lodash-es']) {
          issues.push({
            severity: 'info',
            file: filePath,
            message: 'Consider using lodash-es for better tree-shaking',
          });
        }
      } catch {
        issues.push({
          severity: 'error',
          file: filePath,
          message: 'Invalid JSON in package.json',
        });
      }
    }

    return issues;
  }

  /**
   * Calculate review score
   */
  private calculateScore(issues: CodeIssue[]): number {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'error':
          score -= 15;
          break;
        case 'warning':
          score -= 5;
          break;
        case 'info':
          score -= 1;
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate review summary
   */
  private generateSummary(issues: CodeIssue[], score: number, approved: boolean): string {
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    let summary = approved
      ? `✅ Code review passed with score ${score}/100.`
      : `❌ Code review failed with score ${score}/100.`;

    if (issues.length > 0) {
      summary += ` Found ${issues.length} issue(s): ${errorCount} error(s), ${warningCount} warning(s), ${infoCount} info.`;
    } else {
      summary += ' No issues found.';
    }

    return summary;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let globalReviewAgent: ReviewAgent | null = null;

/**
 * Get the global ReviewAgent instance
 */
export function getReviewAgent(config?: ReviewConfig): ReviewAgent {
  if (!globalReviewAgent) {
    globalReviewAgent = new ReviewAgent(config);
  }
  return globalReviewAgent;
}

/**
 * Reset the global review agent (for testing)
 */
export function resetReviewAgent(): void {
  globalReviewAgent = null;
}

console.log('[155.4][AGENTS][REVIEW] ReviewAgent module loaded');
