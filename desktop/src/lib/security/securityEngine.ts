// desktop/src/lib/security/securityEngine.ts
// Phase 136.0: Security Engine - Unified security alert system
// Provides types and scanning capabilities for security issues

export type SecuritySeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type SecuritySource =
  | 'lint'          // ESLint / TS security rules
  | 'secrets'       // secrets detector
  | 'static'        // static analyzer
  | 'runtime'       // runtime logs / SAST
  | 'policy';       // policy-derived alerts (e.g., no tests on auth)

/**
 * Unified representation of any security alert in the project
 */
export type SecurityAlert = {
  id: string;
  ruleId?: string;           // e.g., "no-eval", "no-secrets"
  message: string;
  messageAr?: string;
  filePath?: string;
  line?: number;
  column?: number;
  severity: SecuritySeverity;
  source: SecuritySource;
  category?: string;         // "injection", "secrets", "auth", "crypto", ...
  createdAt: string;         // ISO string
  isBlocking?: boolean;      // Should this block deployment?
};

export type SecurityScanInput = {
  // In the future: add raw data from lints / external tools
  existingIssues?: Array<{
    id?: string;
    filePath?: string;
    line?: number;
    column?: number;
    message: string;
    severity?: 'low' | 'medium' | 'high';
    tags?: string[];         // e.g., ["security", "auth"]
  }>;
};

export type SecurityScanResult = {
  alerts: SecurityAlert[];
  total: number;
  bySeverity: Record<SecuritySeverity, number>;
  hasBlocking: boolean;
};

/**
 * Security keywords to detect in issue messages
 */
const SECURITY_KEYWORDS = [
  'security',
  'vuln',
  'vulnerab',
  'xss',
  'csrf',
  'injection',
  'secret',
  'password',
  'credential',
  'auth',
  'token',
  'api.?key',
  'private.?key',
  'sql.?inject',
  'eval',
  'exec',
  'unsafe',
  'sanitize',
  'encrypt',
  'decrypt',
  'hash',
];

const SECURITY_REGEX = new RegExp(SECURITY_KEYWORDS.join('|'), 'i');

/**
 * Detect security category from message
 */
function detectCategory(message: string): string | undefined {
  const lowerMsg = message.toLowerCase();

  if (/inject|sql|eval|exec/.test(lowerMsg)) return 'injection';
  if (/secret|password|credential|api.?key|private.?key|token/.test(lowerMsg)) return 'secrets';
  if (/auth|login|session|jwt/.test(lowerMsg)) return 'auth';
  if (/xss|cross.?site|script/.test(lowerMsg)) return 'xss';
  if (/csrf|cross.?site.?request/.test(lowerMsg)) return 'csrf';
  if (/encrypt|decrypt|hash|crypto/.test(lowerMsg)) return 'crypto';
  if (/unsafe|sanitize/.test(lowerMsg)) return 'sanitization';

  return undefined;
}

/**
 * v1 simple scanner: converts issues with "security" tag to SecurityAlert
 * Later can be extended with specialized tools.
 */
export function runSecurityScan(input: SecurityScanInput): SecurityScanResult {
  const alerts: SecurityAlert[] = [];
  const now = new Date().toISOString();

  (input.existingIssues ?? []).forEach((issue, idx) => {
    // Check if this is a security-related issue
    const hasSecurityTag = issue.tags?.includes('security');
    const hasSecurityKeyword = SECURITY_REGEX.test(issue.message);

    if (!hasSecurityTag && !hasSecurityKeyword) return;

    // Map severity
    const severity: SecuritySeverity =
      issue.severity === 'high'
        ? 'high'
        : issue.severity === 'medium'
        ? 'medium'
        : 'low';

    const id = issue.id ?? `sec_${idx}_${Date.now()}`;

    // Generate Arabic message
    const messageAr = generateArabicMessage(issue.message, severity);

    // Detect category
    const category = detectCategory(issue.message);

    alerts.push({
      id,
      ruleId: undefined,
      message: issue.message,
      messageAr,
      filePath: issue.filePath,
      line: issue.line,
      column: issue.column,
      severity,
      source: 'lint',
      category,
      createdAt: now,
      isBlocking: severity === 'high' || severity === 'critical',
    });
  });

  // Count by severity
  const bySeverity: Record<SecuritySeverity, number> = {
    info: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  for (const a of alerts) {
    bySeverity[a.severity] += 1;
  }

  const hasBlocking = alerts.some((a) => a.isBlocking);

  return {
    alerts,
    total: alerts.length,
    bySeverity,
    hasBlocking,
  };
}

/**
 * Generate Arabic message based on category/severity
 */
function generateArabicMessage(message: string, severity: SecuritySeverity): string {
  const lowerMsg = message.toLowerCase();

  if (/secret|password|credential|api.?key/.test(lowerMsg)) {
    return 'تم اكتشاف معلومات سرية محتملة في الكود. يجب إزالتها واستخدام متغيرات البيئة.';
  }
  if (/inject|sql|eval|exec/.test(lowerMsg)) {
    return 'تم رصد ثغرة حقن محتملة. راجع الكود واستخدم أساليب آمنة.';
  }
  if (/xss|cross.?site|script/.test(lowerMsg)) {
    return 'تم رصد ثغرة XSS محتملة. تأكد من تعقيم المدخلات والمخرجات.';
  }
  if (/auth|login|session/.test(lowerMsg)) {
    return 'تم رصد مشكلة أمنية في نظام المصادقة. راجع الكود بعناية.';
  }

  // Default message based on severity
  if (severity === 'high' || severity === 'critical') {
    return 'تم رصد تحذير أمني خطير. يجب إصلاحه فوراً قبل النشر.';
  }
  return 'تم رصد تحذير أمني. يُنصح بمراجعته وإصلاحه قبل النشر.';
}

/**
 * Create a mock security alert for testing
 */
export function createMockSecurityAlert(
  overrides: Partial<SecurityAlert> = {}
): SecurityAlert {
  return {
    id: `mock_${Date.now()}`,
    message: 'Potential security vulnerability detected',
    messageAr: 'تم اكتشاف ثغرة أمنية محتملة',
    severity: 'medium',
    source: 'lint',
    createdAt: new Date().toISOString(),
    isBlocking: false,
    ...overrides,
  };
}

/**
 * Get severity icon
 */
export function getSeverityIcon(severity: SecuritySeverity): string {
  switch (severity) {
    case 'critical': return '🚨';
    case 'high': return '⛔️';
    case 'medium': return '⚠️';
    case 'low': return '💡';
    case 'info': return 'ℹ️';
  }
}

/**
 * Get severity label
 */
export function getSeverityLabel(
  severity: SecuritySeverity,
  locale: 'en' | 'ar'
): string {
  const labels: Record<SecuritySeverity, { en: string; ar: string }> = {
    critical: { en: 'Critical', ar: 'حرج' },
    high: { en: 'High', ar: 'عالي' },
    medium: { en: 'Medium', ar: 'متوسط' },
    low: { en: 'Low', ar: 'منخفض' },
    info: { en: 'Info', ar: 'معلومة' },
  };
  return labels[severity][locale];
}
