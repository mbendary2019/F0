// desktop/src/lib/analysis/livePatterns.ts
// Phase 127.2: Live Pattern Detection (Regex-based, no LLM)

/**
 * Live patterns detect code issues while typing.
 * They're fast regex patterns that run on the current file content.
 */

export type LivePatternId =
  | 'debug_logging'
  | 'todo_comment'
  | 'fixme_comment'
  | 'possible_secret'
  | 'any_type'
  | 'ts_ignore'
  | 'eslint_disable'
  | 'empty_catch'
  | 'hardcoded_url';

export type LivePatternSeverity = 'info' | 'warning' | 'critical';

export interface LivePattern {
  id: LivePatternId;
  regex: RegExp;
  severity: LivePatternSeverity;
  message: string;
  messageAr: string;
  icon: string;
}

export const LIVE_PATTERNS: LivePattern[] = [
  {
    id: 'debug_logging',
    regex: /\bconsole\.(log|debug|warn|error|info|trace)\s*\(/g,
    severity: 'info',
    message: 'Debug logging detected. Consider removing before production.',
    messageAr: 'تم اكتشاف console.log. يُفضل إزالته قبل الإنتاج.',
    icon: '🔍',
  },
  {
    id: 'todo_comment',
    regex: /\/\/\s*TODO\b/gi,
    severity: 'info',
    message: 'TODO comments found. Track and resolve them.',
    messageAr: 'تم العثور على تعليقات TODO. تابعها وحلها.',
    icon: '📝',
  },
  {
    id: 'fixme_comment',
    regex: /\/\/\s*FIXME\b/gi,
    severity: 'warning',
    message: 'FIXME comments indicate broken code that needs attention.',
    messageAr: 'تعليقات FIXME تشير إلى كود معطل يحتاج انتباه.',
    icon: '🔧',
  },
  {
    id: 'possible_secret',
    regex: /(api[_-]?key|secret|password|token|credential)\s*[:=]\s*['"][A-Za-z0-9_\-]{8,}['"]/gi,
    severity: 'critical',
    message: 'Possible secret or API key in code. Use environment variables!',
    messageAr: 'احتمال وجود مفتاح API أو سر في الكود. استخدم متغيرات البيئة!',
    icon: '🔒',
  },
  {
    id: 'any_type',
    regex: /:\s*any\b/g,
    severity: 'warning',
    message: 'TypeScript "any" type used. Consider stricter typing.',
    messageAr: 'تم استخدام نوع "any" في TypeScript. استخدم أنواع أدق.',
    icon: '⚠️',
  },
  {
    id: 'ts_ignore',
    regex: /@ts-ignore|@ts-nocheck/g,
    severity: 'warning',
    message: 'TypeScript checks disabled. Fix the underlying issue.',
    messageAr: 'تم تعطيل فحوصات TypeScript. أصلح المشكلة الأساسية.',
    icon: '🚫',
  },
  {
    id: 'eslint_disable',
    regex: /eslint-disable(?:-next-line)?/g,
    severity: 'info',
    message: 'ESLint rules disabled. Review if necessary.',
    messageAr: 'تم تعطيل قواعد ESLint. راجع إذا كان ضرورياً.',
    icon: '⏸️',
  },
  {
    id: 'empty_catch',
    regex: /catch\s*\([^)]*\)\s*\{\s*\}/g,
    severity: 'warning',
    message: 'Empty catch block swallows errors silently.',
    messageAr: 'كتلة catch فارغة تبتلع الأخطاء بصمت.',
    icon: '🕳️',
  },
  {
    id: 'hardcoded_url',
    regex: /['"]https?:\/\/(?!localhost|127\.0\.0\.1)[^'"]+['"]/g,
    severity: 'info',
    message: 'Hardcoded URL detected. Consider using config/env.',
    messageAr: 'تم اكتشاف URL مضمّن. فكر في استخدام ملف إعدادات.',
    icon: '🔗',
  },
];

/**
 * Get pattern message based on locale
 */
export function getPatternMessage(pattern: LivePattern, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? pattern.messageAr : pattern.message;
}
