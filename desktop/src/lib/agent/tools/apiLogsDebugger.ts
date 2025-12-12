// desktop/src/lib/agent/tools/apiLogsDebugger.ts
// Phase 124.5: Log-Aware API Debugger
// Combines code analysis with runtime logs for debugging API endpoints

import type { RoutesIndex } from '../../../../indexer/types';
import { inspectApiEndpoint, type ApiInspectorOutput } from './apiInspector';
import { resolveApiIntentFromQuery } from '../prompts/routeAwarePrompt';

/**
 * Log levels for API runtime logs
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * API Log Entry structure
 * Expected format in .f0/logs/api-runtime.jsonl
 */
export interface ApiLogEntry {
  timestamp: string;        // ISO format
  level: LogLevel;
  endpoint: string;         // URL path like /api/auth/login
  statusCode?: number;
  message: string;
  stack?: string;
  requestId?: string;
  method?: string;          // HTTP method
  meta?: Record<string, unknown>;
}

/**
 * Query options for fetching API logs
 */
export interface ApiLogsQueryInput {
  urlPath: string;
  minutesBack?: number;     // Logs from last X minutes
  levelAtLeast?: LogLevel;
  limit?: number;
}

/**
 * Summary of API logs for an endpoint
 */
export interface ApiLogsSummary {
  entries: ApiLogEntry[];
  mostCommonStatus?: number;
  errorCount: number;
  warnCount: number;
  infoCount: number;
  latestAt?: string;
  commonErrors: { message: string; count: number }[];
}

/**
 * Input for debugApiEndpoint
 */
export interface DebugApiEndpointInput {
  urlPath?: string;
  query?: string;
  minutesBack?: number;
  routesIndex: RoutesIndex;
  projectRoot: string;
  readFile: (path: string) => Promise<string>;
}

/**
 * Output from debugApiEndpoint
 */
export interface DebugApiEndpointOutput {
  success: boolean;
  reason?: string;
  urlPath?: string;
  inspector?: ApiInspectorOutput;
  logs?: ApiLogsSummary;
  rootCause?: string;
  suggestions?: string[];
}

/**
 * Log level priority for filtering
 */
function levelPriority(level: LogLevel): number {
  switch (level) {
    case 'debug': return 0;
    case 'info': return 1;
    case 'warn': return 2;
    case 'error': return 3;
    default: return 0;
  }
}

/**
 * Read and parse API logs from .f0/logs/api-runtime.jsonl
 * Runs in Electron main process via IPC
 */
export async function getApiLogsSummary(
  input: ApiLogsQueryInput,
  readFile: (path: string) => Promise<string>,
  projectRoot: string
): Promise<ApiLogsSummary> {
  const {
    urlPath,
    minutesBack = 60,
    levelAtLeast = 'info',
    limit = 50,
  } = input;

  const logPath = `${projectRoot}/.f0/logs/api-runtime.jsonl`;

  let content: string;
  try {
    content = await readFile(logPath);
  } catch {
    // No log file found
    return {
      entries: [],
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      commonErrors: [],
    };
  }

  const threshold = levelPriority(levelAtLeast);
  const since = new Date(Date.now() - minutesBack * 60_000);

  const lines = content.split('\n').filter(Boolean);
  const entries: ApiLogEntry[] = [];
  const errorMessages: Record<string, number> = {};

  // Read from end (most recent first)
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]) as ApiLogEntry;

      // Filter by endpoint
      if (obj.endpoint !== urlPath) continue;

      // Filter by time
      const ts = new Date(obj.timestamp);
      if (ts < since) break; // Logs are chronological, stop if too old

      // Filter by level
      if (levelPriority(obj.level) < threshold) continue;

      entries.push(obj);

      // Track error messages
      if (obj.level === 'error' && obj.message) {
        const key = obj.message.slice(0, 100); // Truncate for grouping
        errorMessages[key] = (errorMessages[key] ?? 0) + 1;
      }

      if (entries.length >= limit) break;
    } catch {
      // Ignore malformed lines
    }
  }

  // Calculate stats
  let errorCount = 0;
  let warnCount = 0;
  let infoCount = 0;
  const statusCounts: Record<string, number> = {};
  let latestAt: string | undefined;

  for (const e of entries) {
    if (!latestAt || e.timestamp > latestAt) latestAt = e.timestamp;

    if (e.level === 'error') errorCount++;
    else if (e.level === 'warn') warnCount++;
    else if (e.level === 'info') infoCount++;

    if (e.statusCode) {
      const key = String(e.statusCode);
      statusCounts[key] = (statusCounts[key] ?? 0) + 1;
    }
  }

  // Most common status
  let mostCommonStatus: number | undefined;
  let bestCount = 0;
  for (const [code, count] of Object.entries(statusCounts)) {
    if (count > bestCount) {
      bestCount = count;
      mostCommonStatus = Number(code);
    }
  }

  // Common errors sorted by count
  const commonErrors = Object.entries(errorMessages)
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    entries,
    mostCommonStatus,
    errorCount,
    warnCount,
    infoCount,
    latestAt,
    commonErrors,
  };
}

/**
 * Analyze root cause based on logs and code
 */
function analyzeRootCause(
  inspector: ApiInspectorOutput,
  logs: ApiLogsSummary,
  language: 'ar' | 'en' = 'ar'
): { rootCause: string; suggestions: string[] } {
  const isArabic = language === 'ar';
  const suggestions: string[] = [];
  let rootCause = '';

  const metadata = inspector.metadata;
  if (!metadata) {
    return {
      rootCause: isArabic ? 'لم يتم العثور على معلومات الـ API' : 'API metadata not found',
      suggestions: [],
    };
  }

  // Analyze based on error patterns
  if (logs.commonErrors.length > 0) {
    const topError = logs.commonErrors[0].message;

    // Undefined/null property access
    if (topError.includes('Cannot read properties of undefined') ||
        topError.includes('Cannot read property')) {
      const propMatch = topError.match(/reading '(\w+)'/);
      const prop = propMatch?.[1] || 'unknown';

      rootCause = isArabic
        ? `❌ خطأ في قراءة الخاصية '${prop}' من قيمة undefined`
        : `❌ Trying to read property '${prop}' from undefined value`;

      if (metadata.validationHints.length === 0) {
        suggestions.push(
          isArabic
            ? `⚠️ أضف validation للـ request body قبل قراءة '${prop}'`
            : `⚠️ Add validation for request body before accessing '${prop}'`
        );
      }

      suggestions.push(
        isArabic
          ? `💡 أضف check: if (!req.body?.${prop}) return Response.json({ error: 'Missing ${prop}' }, { status: 400 })`
          : `💡 Add check: if (!req.body?.${prop}) return Response.json({ error: 'Missing ${prop}' }, { status: 400 })`
      );
    }

    // Authentication errors
    else if (topError.includes('Unauthorized') || topError.includes('auth')) {
      rootCause = isArabic
        ? '🔐 فشل في المصادقة - المستخدم غير مصرح له'
        : '🔐 Authentication failed - user not authorized';

      if (metadata.authHint === 'none') {
        suggestions.push(
          isArabic
            ? '⚠️ الـ endpoint ده مفيهوش auth - أضف verifyIdToken'
            : '⚠️ This endpoint has no auth - add verifyIdToken'
        );
      }
    }

    // Database errors
    else if (topError.includes('ECONNREFUSED') || topError.includes('database')) {
      rootCause = isArabic
        ? '🔌 فشل الاتصال بقاعدة البيانات'
        : '🔌 Database connection failed';

      suggestions.push(
        isArabic
          ? '💡 تأكد من أن قاعدة البيانات شغالة ومتاحة'
          : '💡 Verify database is running and accessible'
      );
    }

    // Timeout
    else if (topError.includes('timeout') || topError.includes('ETIMEDOUT')) {
      rootCause = isArabic
        ? '⏱️ انتهت مهلة الطلب (Timeout)'
        : '⏱️ Request timed out';

      suggestions.push(
        isArabic
          ? '💡 راجع الـ queries البطيئة أو زوّد الـ timeout'
          : '💡 Check for slow queries or increase timeout'
      );
    }

    // Generic error
    else {
      rootCause = isArabic
        ? `❌ خطأ: ${topError.slice(0, 80)}`
        : `❌ Error: ${topError.slice(0, 80)}`;
    }
  }

  // Analyze based on status codes
  else if (logs.mostCommonStatus) {
    const status = logs.mostCommonStatus;

    if (status === 500) {
      rootCause = isArabic
        ? '💥 خطأ داخلي في السيرفر (500)'
        : '💥 Internal server error (500)';

      if (!metadata.errorCodes.includes(500)) {
        suggestions.push(
          isArabic
            ? '⚠️ أضف try/catch حول الكود الأساسي'
            : '⚠️ Add try/catch around main code'
        );
      }
    } else if (status === 404) {
      rootCause = isArabic
        ? '🔍 الـ resource المطلوب غير موجود (404)'
        : '🔍 Requested resource not found (404)';
    } else if (status === 401) {
      rootCause = isArabic
        ? '🔐 المستخدم غير مصرح له (401)'
        : '🔐 User not authenticated (401)';
    } else if (status === 403) {
      rootCause = isArabic
        ? '🚫 المستخدم ليس لديه صلاحية (403)'
        : '🚫 User not authorized (403)';
    }
  }

  // No logs - suggest common fixes
  if (!rootCause && logs.entries.length === 0) {
    rootCause = isArabic
      ? '📭 لا توجد logs مسجلة لهذا الـ endpoint'
      : '📭 No logs recorded for this endpoint';

    suggestions.push(
      isArabic
        ? '💡 أضف logging للـ endpoint: console.error(error)'
        : '💡 Add logging to endpoint: console.error(error)'
    );
  }

  // Add general suggestions based on code analysis
  if (metadata.validationHints.length === 0 && metadata.methods.includes('POST')) {
    suggestions.push(
      isArabic
        ? '🔧 أضف zod validation للـ POST body'
        : '🔧 Add zod validation for POST body'
    );
  }

  if (metadata.authHint === 'none' && metadata.methods.some(m => ['POST', 'PUT', 'DELETE'].includes(m))) {
    suggestions.push(
      isArabic
        ? '🔐 فكر في إضافة authentication لهذا الـ endpoint'
        : '🔐 Consider adding authentication to this endpoint'
    );
  }

  return { rootCause, suggestions };
}

/**
 * Debug an API endpoint by combining code inspection and runtime logs
 * Main function for Phase 124.5
 */
export async function debugApiEndpoint(
  input: DebugApiEndpointInput
): Promise<DebugApiEndpointOutput> {
  const {
    urlPath,
    query,
    minutesBack = 60,
    routesIndex,
    projectRoot,
    readFile,
  } = input;

  // 1) Resolve the URL path
  const message = query ?? urlPath ?? '';
  const intent = resolveApiIntentFromQuery(message, routesIndex);

  if (intent.kind !== 'debug_api' && intent.kind !== 'inspect_existing') {
    return {
      success: false,
      reason: 'لم يتم العثور على endpoint محدد للتصحيح',
    };
  }

  const resolvedUrl = 'urlPath' in intent ? intent.urlPath : urlPath;
  if (!resolvedUrl) {
    return {
      success: false,
      reason: 'No URL path specified',
    };
  }

  // 2) Run API inspector
  const inspector = await inspectApiEndpoint({
    urlPath: resolvedUrl,
    routesIndex,
    projectRoot,
    readFile,
    includeConsumers: false,
  });

  if (!inspector.success) {
    return {
      success: false,
      reason: inspector.message,
      urlPath: resolvedUrl,
    };
  }

  // 3) Get runtime logs
  const logs = await getApiLogsSummary(
    {
      urlPath: resolvedUrl,
      minutesBack,
      levelAtLeast: 'warn',
    },
    readFile,
    projectRoot
  );

  // 4) Analyze root cause
  const { rootCause, suggestions } = analyzeRootCause(inspector, logs);

  return {
    success: true,
    urlPath: resolvedUrl,
    inspector,
    logs,
    rootCause,
    suggestions,
  };
}

/**
 * Format debug output for display (Arabic/English)
 */
export function formatDebugOutput(
  output: DebugApiEndpointOutput,
  language: 'ar' | 'en' = 'ar'
): string {
  const isArabic = language === 'ar';

  if (!output.success) {
    return output.reason || (isArabic ? 'فشل التصحيح' : 'Debug failed');
  }

  const lines: string[] = [];

  // Header
  lines.push(isArabic ? `🔍 تصحيح ${output.urlPath}` : `🔍 Debugging ${output.urlPath}`);
  lines.push('');

  // Code Analysis
  if (output.inspector?.metadata) {
    const m = output.inspector.metadata;
    lines.push(isArabic ? '📋 تحليل الكود:' : '📋 Code Analysis:');
    lines.push(`  📁 ${m.fsPath}`);
    lines.push(`  🔧 Methods: ${m.methods.join(', ')}`);
    lines.push(`  🔐 Auth: ${m.authHint === 'none' ? (isArabic ? 'لا يوجد' : 'None') : m.authDetails || m.authHint}`);
    lines.push(`  ✅ Validation: ${m.validationHints.length > 0 ? m.validationHints.join(', ') : (isArabic ? 'لا يوجد' : 'None')}`);
    lines.push('');
  }

  // Logs Summary
  if (output.logs) {
    const l = output.logs;
    lines.push(isArabic ? '📊 ملخص الـ Logs:' : '📊 Logs Summary:');
    lines.push(`  ❌ Errors: ${l.errorCount}`);
    lines.push(`  ⚠️ Warnings: ${l.warnCount}`);
    lines.push(`  ℹ️ Info: ${l.infoCount}`);

    if (l.mostCommonStatus) {
      lines.push(`  📈 Most common status: ${l.mostCommonStatus}`);
    }

    if (l.latestAt) {
      lines.push(`  🕐 Latest: ${new Date(l.latestAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}`);
    }

    if (l.commonErrors.length > 0) {
      lines.push('');
      lines.push(isArabic ? '🔴 الأخطاء الشائعة:' : '🔴 Common Errors:');
      for (const err of l.commonErrors.slice(0, 3)) {
        lines.push(`  ${err.count}x: ${err.message.slice(0, 60)}...`);
      }
    }
    lines.push('');
  }

  // Root Cause
  if (output.rootCause) {
    lines.push(isArabic ? '🎯 السبب المحتمل:' : '🎯 Probable Root Cause:');
    lines.push(`  ${output.rootCause}`);
    lines.push('');
  }

  // Suggestions
  if (output.suggestions && output.suggestions.length > 0) {
    lines.push(isArabic ? '💡 اقتراحات الإصلاح:' : '💡 Fix Suggestions:');
    for (const s of output.suggestions) {
      lines.push(`  ${s}`);
    }
  }

  return lines.join('\n');
}

export default {
  getApiLogsSummary,
  debugApiEndpoint,
  formatDebugOutput,
};
