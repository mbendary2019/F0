// desktop/src/lib/security/securityRecipes.ts
// Phase 136.3: Security Recipes - Centralized prompt builder for security actions
// All security-related agent prompts are defined here for consistency

import type { SecurityAlert, SecuritySeverity } from './securityEngine';

/**
 * Available security recipe IDs
 */
export type SecurityRecipeId =
  | 'FIX_FILE_VULNS'
  | 'FULL_PROJECT_AUDIT'
  | 'GENERATE_SECURITY_TESTS'
  | 'EXPLAIN_ALERTS'
  | 'SCAN_DEPENDENCIES'
  | 'HARDEN_CONFIG';

/**
 * Supported locales
 */
export type Locale = 'ar' | 'en';

/**
 * Options for building security prompts
 */
export interface SecurityPromptOptions {
  /** File path for file-specific recipes */
  filePath?: string;
  /** Security alerts to include in prompt */
  alerts?: SecurityAlert[];
  /** Project name for context */
  projectName?: string;
  /** Additional context to include */
  additionalContext?: string;
}

/**
 * Recipe templates in both languages
 */
const RECIPE_TEMPLATES: Record<
  SecurityRecipeId,
  { ar: string; en: string; requiresAlerts?: boolean; requiresFile?: boolean }
> = {
  FIX_FILE_VULNS: {
    ar: `🛡️ **مهمة إصلاح الأمان**

من فضلك أصلح مشاكل الأمان في الملف:
📁 \`{{FILE_PATH}}\`

**المشاكل المكتشفة:**
{{ALERTS_LIST}}

**التعليمات:**
1. راجع كل مشكلة وافهم السبب
2. طبق الإصلاح الآمن
3. تأكد من عدم كسر الوظائف الحالية
4. أضف تعليقات توضيحية للإصلاحات الهامة`,
    en: `🛡️ **Security Fix Task**

Please fix the security issues in file:
📁 \`{{FILE_PATH}}\`

**Detected Issues:**
{{ALERTS_LIST}}

**Instructions:**
1. Review each issue and understand the cause
2. Apply the secure fix
3. Ensure existing functionality is not broken
4. Add comments for important fixes`,
    requiresAlerts: true,
    requiresFile: true,
  },

  FULL_PROJECT_AUDIT: {
    ar: `🔍 **فحص أمني شامل للمشروع**

{{PROJECT_CONTEXT}}

**ملخص التنبيهات:**
{{ALERTS_SUMMARY}}

**المطلوب:**
1. ابدأ بالمشاكل الحرجة (Critical) أولاً
2. ثم المشاكل العالية (High)
3. أصلح ملف واحد في كل مرة
4. قدم تقرير بالإصلاحات

{{ADDITIONAL_CONTEXT}}`,
    en: `🔍 **Full Project Security Audit**

{{PROJECT_CONTEXT}}

**Alerts Summary:**
{{ALERTS_SUMMARY}}

**Required:**
1. Start with Critical issues first
2. Then High severity issues
3. Fix one file at a time
4. Provide a report of fixes

{{ADDITIONAL_CONTEXT}}`,
    requiresAlerts: true,
  },

  GENERATE_SECURITY_TESTS: {
    ar: `🧪 **إنشاء اختبارات أمنية**

{{FILE_CONTEXT}}

**المشاكل المكتشفة:**
{{ALERTS_LIST}}

**المطلوب:**
1. أنشئ اختبارات unit tests للتحقق من الإصلاحات
2. اختبر edge cases الأمنية
3. تأكد من تغطية كل الثغرات المكتشفة
4. استخدم أسماء واضحة للاختبارات`,
    en: `🧪 **Generate Security Tests**

{{FILE_CONTEXT}}

**Detected Issues:**
{{ALERTS_LIST}}

**Required:**
1. Create unit tests to verify fixes
2. Test security edge cases
3. Ensure coverage for all detected vulnerabilities
4. Use clear test names`,
    requiresAlerts: true,
  },

  EXPLAIN_ALERTS: {
    ar: `📚 **شرح التنبيهات الأمنية**

{{ALERTS_LIST}}

**المطلوب:**
1. اشرح كل تنبيه بالتفصيل
2. وضح لماذا هذا يعتبر مشكلة أمنية
3. اقترح طريقة الإصلاح
4. قدم أمثلة على الاستغلال المحتمل (إن وجد)`,
    en: `📚 **Explain Security Alerts**

{{ALERTS_LIST}}

**Required:**
1. Explain each alert in detail
2. Clarify why this is a security issue
3. Suggest the fix approach
4. Provide examples of potential exploitation (if applicable)`,
    requiresAlerts: true,
  },

  SCAN_DEPENDENCIES: {
    ar: `📦 **فحص أمان التبعيات**

{{PROJECT_CONTEXT}}

**المطلوب:**
1. راجع package.json و lock files
2. ابحث عن تبعيات معروفة بثغرات
3. اقترح تحديثات آمنة
4. حدد التبعيات غير المستخدمة`,
    en: `📦 **Dependency Security Scan**

{{PROJECT_CONTEXT}}

**Required:**
1. Review package.json and lock files
2. Search for dependencies with known vulnerabilities
3. Suggest safe updates
4. Identify unused dependencies`,
  },

  HARDEN_CONFIG: {
    ar: `🔒 **تقوية إعدادات الأمان**

{{PROJECT_CONTEXT}}

**المطلوب:**
1. راجع إعدادات الأمان الحالية
2. أضف CSP headers إن لم تكن موجودة
3. تأكد من إعدادات CORS
4. راجع environment variables`,
    en: `🔒 **Harden Security Configuration**

{{PROJECT_CONTEXT}}

**Required:**
1. Review current security settings
2. Add CSP headers if missing
3. Verify CORS configuration
4. Review environment variables`,
  },
};

/**
 * Format severity for display
 */
const SEVERITY_LABELS: Record<SecuritySeverity, { ar: string; en: string; icon: string }> = {
  critical: { ar: 'حرج', en: 'Critical', icon: '🔴' },
  high: { ar: 'عالي', en: 'High', icon: '🟠' },
  medium: { ar: 'متوسط', en: 'Medium', icon: '🟡' },
  low: { ar: 'منخفض', en: 'Low', icon: '🔵' },
  info: { ar: 'معلومات', en: 'Info', icon: 'ℹ️' },
};

/**
 * Format a single alert for inclusion in prompt
 */
function formatAlert(alert: SecurityAlert, locale: Locale): string {
  const sevLabel = SEVERITY_LABELS[alert.severity];
  const lineInfo = alert.line ? ` (${locale === 'ar' ? 'سطر' : 'line'} ${alert.line})` : '';
  const ruleInfo = alert.ruleId ? ` [${alert.ruleId}]` : '';

  return `- ${sevLabel.icon} **${locale === 'ar' ? sevLabel.ar : sevLabel.en}**: ${alert.message}${lineInfo}${ruleInfo}`;
}

/**
 * Format alerts list for prompt
 */
function formatAlertsList(alerts: SecurityAlert[], locale: Locale): string {
  if (!alerts || alerts.length === 0) {
    return locale === 'ar' ? '_لا توجد تنبيهات_' : '_No alerts_';
  }

  // Sort by severity
  const sorted = [...alerts].sort((a, b) => {
    const order: SecuritySeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
    return order.indexOf(a.severity) - order.indexOf(b.severity);
  });

  return sorted.map((a) => formatAlert(a, locale)).join('\n');
}

/**
 * Format alerts summary (counts by severity)
 */
function formatAlertsSummary(alerts: SecurityAlert[], locale: Locale): string {
  const counts: Record<SecuritySeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  alerts.forEach((a) => counts[a.severity]++);

  const parts: string[] = [];
  const severities: SecuritySeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

  severities.forEach((sev) => {
    if (counts[sev] > 0) {
      const label = SEVERITY_LABELS[sev];
      parts.push(`${label.icon} ${counts[sev]} ${locale === 'ar' ? label.ar : label.en}`);
    }
  });

  // Get unique files
  const uniqueFiles = new Set(alerts.map((a) => a.filePath));
  const filesLabel = locale === 'ar' ? 'ملفات' : 'files';

  return `${parts.join(' | ')}\n📁 ${uniqueFiles.size} ${filesLabel}`;
}

/**
 * Build a security prompt using a recipe
 *
 * @param recipe - Recipe ID to use
 * @param locale - Language locale
 * @param options - Additional options
 * @returns Formatted prompt string
 *
 * @example
 * ```ts
 * const prompt = buildSecurityPrompt('FIX_FILE_VULNS', 'ar', {
 *   filePath: 'src/api/auth.ts',
 *   alerts: fileAlerts,
 * });
 * sendToAgent(prompt);
 * ```
 */
export function buildSecurityPrompt(
  recipe: SecurityRecipeId,
  locale: Locale,
  options: SecurityPromptOptions = {}
): string {
  const template = RECIPE_TEMPLATES[recipe];
  if (!template) {
    console.warn(`[securityRecipes] Unknown recipe: ${recipe}`);
    return '';
  }

  // Validation
  if (template.requiresAlerts && (!options.alerts || options.alerts.length === 0)) {
    console.warn(`[securityRecipes] Recipe ${recipe} requires alerts`);
  }
  if (template.requiresFile && !options.filePath) {
    console.warn(`[securityRecipes] Recipe ${recipe} requires filePath`);
  }

  let prompt = locale === 'ar' ? template.ar : template.en;

  // Replace placeholders
  prompt = prompt.replace('{{FILE_PATH}}', options.filePath || '');
  prompt = prompt.replace('{{ALERTS_LIST}}', formatAlertsList(options.alerts || [], locale));
  prompt = prompt.replace('{{ALERTS_SUMMARY}}', formatAlertsSummary(options.alerts || [], locale));
  prompt = prompt.replace('{{ADDITIONAL_CONTEXT}}', options.additionalContext || '');

  // Project context
  const projectContext = options.projectName
    ? locale === 'ar'
      ? `📂 المشروع: ${options.projectName}`
      : `📂 Project: ${options.projectName}`
    : '';
  prompt = prompt.replace('{{PROJECT_CONTEXT}}', projectContext);

  // File context
  const fileContext = options.filePath
    ? locale === 'ar'
      ? `📁 الملف: \`${options.filePath}\``
      : `📁 File: \`${options.filePath}\``
    : '';
  prompt = prompt.replace('{{FILE_CONTEXT}}', fileContext);

  return prompt.trim();
}

/**
 * Get all available recipes with their metadata
 */
export function getAvailableRecipes(locale: Locale): Array<{
  id: SecurityRecipeId;
  label: string;
  description: string;
  icon: string;
}> {
  return [
    {
      id: 'FIX_FILE_VULNS',
      label: locale === 'ar' ? 'إصلاح ملف' : 'Fix File',
      description: locale === 'ar' ? 'إصلاح ثغرات ملف معين' : 'Fix vulnerabilities in a specific file',
      icon: '🔧',
    },
    {
      id: 'FULL_PROJECT_AUDIT',
      label: locale === 'ar' ? 'فحص شامل' : 'Full Audit',
      description: locale === 'ar' ? 'فحص أمني شامل للمشروع' : 'Comprehensive project security audit',
      icon: '🔍',
    },
    {
      id: 'GENERATE_SECURITY_TESTS',
      label: locale === 'ar' ? 'إنشاء اختبارات' : 'Generate Tests',
      description: locale === 'ar' ? 'إنشاء اختبارات أمنية' : 'Generate security tests',
      icon: '🧪',
    },
    {
      id: 'EXPLAIN_ALERTS',
      label: locale === 'ar' ? 'شرح التنبيهات' : 'Explain Alerts',
      description: locale === 'ar' ? 'شرح التنبيهات بالتفصيل' : 'Explain alerts in detail',
      icon: '📚',
    },
    {
      id: 'SCAN_DEPENDENCIES',
      label: locale === 'ar' ? 'فحص التبعيات' : 'Scan Dependencies',
      description: locale === 'ar' ? 'فحص أمان التبعيات' : 'Scan dependency security',
      icon: '📦',
    },
    {
      id: 'HARDEN_CONFIG',
      label: locale === 'ar' ? 'تقوية الإعدادات' : 'Harden Config',
      description: locale === 'ar' ? 'تقوية إعدادات الأمان' : 'Harden security configuration',
      icon: '🔒',
    },
  ];
}

export default buildSecurityPrompt;
