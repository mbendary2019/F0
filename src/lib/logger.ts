// src/lib/logger.ts
/**
 * Phase 49: Client-side Logger
 * Simple logging interface from web to Cloud Functions
 * Tries /api/log first, falls back to NEXT_PUBLIC_CF_LOG_URL if not found
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

type LogPayload = {
  level: LogLevel;
  service?: string;
  code?: number;
  message: string;
  context?: Record<string, any>;
  fingerprint?: string;
  stack?: string | null;
};

const ENDPOINT =
  process.env.NEXT_PUBLIC_LOG_ENDPOINT ||
  '/api/log'; // proxy route (recommended locally)

const CF_FALLBACK =
  process.env.NEXT_PUBLIC_CF_LOG_URL ||
  ''; // fallback to Cloud Function directly

async function postLog(url: string, payload: LogPayload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // You can add App Check header here if enabled
    body: JSON.stringify(payload),
  });
  // Don't throw error on UI; just log
  // (important so logger doesn't crash the page)
  try {
    return await res.json();
  } catch {
    return { ok: false };
  }
}

export async function log(
  level: LogLevel,
  message: string,
  opts: {
    service?: string;
    code?: number;
    context?: Record<string, any>;
    fingerprint?: string;
    includeStack?: boolean;
  } = {},
) {
  const stack =
    opts.includeStack !== false
      ? new Error().stack?.toString() ?? null
      : null;

  const payload: LogPayload = {
    level,
    message,
    service: opts.service ?? 'web',
    code: typeof opts.code === 'number' ? opts.code : undefined,
    context: opts.context,
    fingerprint: opts.fingerprint,
    stack,
  };

  // Try proxy first
  try {
    const res = await postLog(ENDPOINT, payload);
    if (res?.ok) return res;
  } catch {
    // Ignore and try fallback
  }

  // Try CF URL directly
  if (CF_FALLBACK) {
    try {
      return await postLog(CF_FALLBACK, payload);
    } catch {
      // Ignore
    }
  }

  return { ok: false };
}

export const logInfo = (msg: string, opts?: Parameters<typeof log>[2]) =>
  log('info', msg, opts);

export const logWarn = (msg: string, opts?: Parameters<typeof log>[2]) =>
  log('warn', msg, opts);

export const logError = (
  msg: string,
  opts?: Omit<Parameters<typeof log>[2], 'code'> & { code?: number },
) => log('error', msg, opts);

export const logFatal = (
  msg: string,
  opts?: Omit<Parameters<typeof log>[2], 'code'> & { code?: number },
) => log('fatal', msg, { ...opts, code: opts?.code ?? 500 });
