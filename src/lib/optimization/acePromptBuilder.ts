// src/lib/optimization/acePromptBuilder.ts
// Phase 138.5.1: ACE (Autonomous Code Evolution) Prompt Builder
// Generates structured prompts for AI-assisted code improvements based on optimization data

import type { OptimizationRun, AceTriggerMeta, OptimizationScores, OptimizationSignals } from './types';

/**
 * ACE context containing all optimization data needed for prompt generation
 */
export interface AceContext {
  run: OptimizationRun;
  projectName?: string;
  locale?: string;
}

/**
 * Generated ACE prompt with metadata
 */
export interface AcePrompt {
  systemPrompt: string;
  userPrompt: string;
  suggestedActions: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Phase 138.5.1: Build a structured prompt for ACE based on optimization run data
 *
 * @param context - ACE context containing run data and project info
 * @returns AcePrompt with system prompt, user prompt, and suggested actions
 */
export function buildAceEvolutionPrompt(context: AceContext): AcePrompt {
  const { run, projectName = 'Project', locale = 'en' } = context;
  const { scores, signals, ace, summary, recommendations } = run;

  // Determine priority based on ACE level
  const priority = mapAceLevelToPriority(ace?.level);

  // Build system prompt
  const systemPrompt = buildSystemPrompt(locale);

  // Build user prompt with all context
  const userPrompt = buildUserPrompt({
    projectName,
    scores,
    signals,
    ace,
    summary,
    recommendations,
    locale,
  });

  // Generate suggested actions based on signals
  const suggestedActions = generateSuggestedActions(signals, scores, locale);

  return {
    systemPrompt,
    userPrompt,
    suggestedActions,
    priority,
  };
}

/**
 * Map ACE trigger level to priority
 */
function mapAceLevelToPriority(level?: AceTriggerMeta['level']): AcePrompt['priority'] {
  switch (level) {
    case 'high':
      return 'critical';
    case 'medium':
      return 'high';
    case 'low':
      return 'medium';
    default:
      return 'low';
  }
}

/**
 * Build the system prompt for ACE
 */
function buildSystemPrompt(locale: string): string {
  if (locale === 'ar') {
    return `أنت مساعد تطوير متخصص في تحسين جودة الكود وصحة المشروع.
مهمتك هي تحليل بيانات التحسين المقدمة واقتراح تحسينات عملية للكود.

إرشادات:
1. ركز على المشاكل الحرجة أولاً (الأمان، الاختبارات الفاشلة)
2. قدم حلولاً محددة وقابلة للتنفيذ
3. اشرح سبب كل تحسين مقترح
4. حافظ على التوافق مع الكود الحالي
5. قدم الأولويات بوضوح`;
  }

  return `You are a specialized development assistant focused on improving code quality and project health.
Your task is to analyze the provided optimization data and suggest actionable code improvements.

Guidelines:
1. Focus on critical issues first (security, failing tests)
2. Provide specific, actionable solutions
3. Explain the reasoning behind each improvement
4. Maintain compatibility with existing code
5. Clearly prioritize recommendations`;
}

/**
 * Build the user prompt with all context
 */
function buildUserPrompt(params: {
  projectName: string;
  scores?: OptimizationScores | null;
  signals?: OptimizationSignals | null;
  ace?: AceTriggerMeta | null;
  summary?: string | null;
  recommendations?: string[] | null;
  locale: string;
}): string {
  const { projectName, scores, signals, ace, summary, recommendations, locale } = params;

  const isArabic = locale === 'ar';

  let prompt = isArabic
    ? `## تحليل صحة المشروع: ${projectName}\n\n`
    : `## Project Health Analysis: ${projectName}\n\n`;

  // Add summary if available
  if (summary) {
    prompt += isArabic
      ? `### الملخص\n${summary}\n\n`
      : `### Summary\n${summary}\n\n`;
  }

  // Add scores section
  if (scores) {
    prompt += isArabic
      ? `### النتائج الحالية\n`
      : `### Current Scores\n`;

    prompt += isArabic
      ? `- النتيجة الإجمالية: ${scores.overallScore}/100
- مستوى الخطر: ${translateRiskLevel(scores.riskLevel, locale)}
- الأمان: ${scores.securityScore}/100
- الموثوقية: ${scores.reliabilityScore}/100
- التغطية: ${scores.coverageScore}/100
- قابلية الصيانة: ${scores.maintainabilityScore}/100\n\n`
      : `- Overall Score: ${scores.overallScore}/100
- Risk Level: ${scores.riskLevel}
- Security: ${scores.securityScore}/100
- Reliability: ${scores.reliabilityScore}/100
- Coverage: ${scores.coverageScore}/100
- Maintainability: ${scores.maintainabilityScore}/100\n\n`;
  }

  // Add signals section
  if (signals) {
    prompt += isArabic
      ? `### الإشارات المكتشفة\n`
      : `### Detected Signals\n`;

    // Tests
    prompt += isArabic
      ? `**الاختبارات:**
- الإجمالي: ${signals.tests.total}
- ناجحة: ${signals.tests.passed}
- فاشلة: ${signals.tests.failed}
- غير مستقرة: ${signals.tests.flaky}\n\n`
      : `**Tests:**
- Total: ${signals.tests.total}
- Passed: ${signals.tests.passed}
- Failed: ${signals.tests.failed}
- Flaky: ${signals.tests.flaky}\n\n`;

    // Coverage
    prompt += isArabic
      ? `**التغطية:**
- تغطية الأسطر: ${signals.coverage.line}%
- الملفات المقاسة: ${signals.coverage.filesMeasured}\n\n`
      : `**Coverage:**
- Line Coverage: ${signals.coverage.line}%
- Files Measured: ${signals.coverage.filesMeasured}\n\n`;

    // Security
    prompt += isArabic
      ? `**الأمان:**
- إجمالي التنبيهات: ${signals.security.totalAlerts}
- تنبيهات حاجزة: ${signals.security.blockingAlerts}
- عالية الخطورة: ${signals.security.highSeverity}\n\n`
      : `**Security:**
- Total Alerts: ${signals.security.totalAlerts}
- Blocking Alerts: ${signals.security.blockingAlerts}
- High Severity: ${signals.security.highSeverity}\n\n`;

    // Issues
    prompt += isArabic
      ? `**مشاكل الكود:**
- الإجمالي: ${signals.issues.totalIssues}
- حرجة: ${signals.issues.critical}
- عالية: ${signals.issues.high}
- متوسطة: ${signals.issues.medium}
- منخفضة: ${signals.issues.low}\n\n`
      : `**Code Issues:**
- Total: ${signals.issues.totalIssues}
- Critical: ${signals.issues.critical}
- High: ${signals.issues.high}
- Medium: ${signals.issues.medium}
- Low: ${signals.issues.low}\n\n`;
  }

  // Add ACE trigger reasons
  if (ace && ace.reasons.length > 0) {
    prompt += isArabic
      ? `### أسباب تفعيل ACE (مستوى: ${translateAceLevel(ace.level, locale)})\n`
      : `### ACE Trigger Reasons (Level: ${ace.level})\n`;

    ace.reasons.forEach((reason, idx) => {
      prompt += `${idx + 1}. ${reason}\n`;
    });
    prompt += '\n';
  }

  // Add existing recommendations
  if (recommendations && recommendations.length > 0) {
    prompt += isArabic
      ? `### التوصيات الحالية\n`
      : `### Current Recommendations\n`;

    recommendations.forEach((rec, idx) => {
      prompt += `${idx + 1}. ${rec}\n`;
    });
    prompt += '\n';
  }

  // Add request
  prompt += isArabic
    ? `---\n\nبناءً على التحليل أعلاه، يرجى تقديم:\n1. قائمة مرتبة بالأولوية للتحسينات المقترحة\n2. خطوات تنفيذ محددة لكل تحسين\n3. تأثير متوقع لكل تغيير على صحة المشروع`
    : `---\n\nBased on the analysis above, please provide:\n1. A prioritized list of suggested improvements\n2. Specific implementation steps for each improvement\n3. Expected impact of each change on project health`;

  return prompt;
}

/**
 * Generate suggested actions based on signals and scores
 */
function generateSuggestedActions(
  signals?: OptimizationSignals | null,
  scores?: OptimizationScores | null,
  locale?: string
): string[] {
  const actions: string[] = [];
  const isArabic = locale === 'ar';

  if (!signals || !scores) {
    return isArabic
      ? ['تشغيل فحص شامل للمشروع']
      : ['Run a comprehensive project scan'];
  }

  // Critical actions first
  if (signals.tests.failed > 0) {
    actions.push(
      isArabic
        ? `إصلاح ${signals.tests.failed} اختبار فاشل`
        : `Fix ${signals.tests.failed} failing test(s)`
    );
  }

  if (signals.security.blockingAlerts > 0) {
    actions.push(
      isArabic
        ? `معالجة ${signals.security.blockingAlerts} تنبيه أمني حاجز`
        : `Address ${signals.security.blockingAlerts} blocking security alert(s)`
    );
  }

  if (signals.issues.critical > 0) {
    actions.push(
      isArabic
        ? `إصلاح ${signals.issues.critical} مشكلة حرجة في الكود`
        : `Fix ${signals.issues.critical} critical code issue(s)`
    );
  }

  // High priority actions
  if (signals.security.highSeverity > 0) {
    actions.push(
      isArabic
        ? `مراجعة ${signals.security.highSeverity} تنبيه أمني عالي الخطورة`
        : `Review ${signals.security.highSeverity} high-severity security alert(s)`
    );
  }

  if (signals.issues.high > 0) {
    actions.push(
      isArabic
        ? `معالجة ${signals.issues.high} مشكلة عالية الأولوية`
        : `Address ${signals.issues.high} high-priority code issue(s)`
    );
  }

  // Coverage improvements
  if (signals.coverage.line < 50) {
    actions.push(
      isArabic
        ? `تحسين تغطية الاختبارات (حالياً ${signals.coverage.line}%)`
        : `Improve test coverage (currently ${signals.coverage.line}%)`
    );
  }

  // Flaky tests
  if (signals.tests.flaky > 0) {
    actions.push(
      isArabic
        ? `إصلاح ${signals.tests.flaky} اختبار غير مستقر`
        : `Fix ${signals.tests.flaky} flaky test(s)`
    );
  }

  // Medium priority issues
  if (signals.issues.medium > 3) {
    actions.push(
      isArabic
        ? `مراجعة ${signals.issues.medium} مشكلة متوسطة الأولوية`
        : `Review ${signals.issues.medium} medium-priority issue(s)`
    );
  }

  // If no specific actions, add general improvement
  if (actions.length === 0) {
    actions.push(
      isArabic
        ? 'المشروع في حالة جيدة - راجع التوصيات العامة'
        : 'Project is in good health - review general recommendations'
    );
  }

  return actions;
}

/**
 * Translate risk level to Arabic
 */
function translateRiskLevel(level: string, locale: string): string {
  if (locale !== 'ar') return level;

  const translations: Record<string, string> = {
    low: 'منخفض',
    medium: 'متوسط',
    high: 'عالي',
    critical: 'حرج',
  };

  return translations[level] || level;
}

/**
 * Translate ACE level to Arabic
 */
function translateAceLevel(level: string, locale: string): string {
  if (locale !== 'ar') return level;

  const translations: Record<string, string> = {
    none: 'لا شيء',
    low: 'منخفض',
    medium: 'متوسط',
    high: 'عالي',
  };

  return translations[level] || level;
}
