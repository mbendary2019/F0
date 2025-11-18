/**
 * Observability Utilities
 * Performance monitoring, tracing, and timing helpers
 */

// TODO: Install @sentry/nextjs to enable monitoring
// import * as Sentry from '@sentry/nextjs';

/**
 * Time an async operation and log performance
 */
export async function timeIt<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const t0 = Date.now();

  try {
    const result = await fn();
    const ms = Date.now() - t0;
    console.log(`[⏱️ Performance] ${label}: ${ms}ms`);
    return result;
  } catch (error) {
    const ms = Date.now() - t0;
    console.error(`[⏱️ Performance] ${label}: ${ms}ms (FAILED)`);
    throw error;
  }
}

/**
 * Create a Sentry transaction/span for tracing
 */
export async function trace<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  // TODO: Install @sentry/nextjs to enable tracing
  console.log(`[Trace] ${operation}`, metadata);
  return await fn();
}

/**
 * Create a child span within a transaction
 */
export async function span<T>(
  parentTransaction: any,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  // TODO: Install @sentry/nextjs to enable spans
  console.log(`[Span] ${operation}`);
  return await fn();
}

/**
 * Simple performance timer (returns duration)
 */
export class Timer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  elapsed(): number {
    return Date.now() - this.startTime;
  }

  log(label: string): void {
    console.log(`[⏱️ ${label}] ${this.elapsed()}ms`);
  }

  reset(): void {
    this.startTime = Date.now();
  }
}

/**
 * Log a metric (for future integration with monitoring systems)
 */
export function metric(
  name: string,
  value: number,
  tags?: Record<string, string>
): void {
  // For now, just log. Can be extended to send to Datadog, Prometheus, etc.
  const tagsStr = tags ? ` ${JSON.stringify(tags)}` : '';
  console.log(`[📊 Metric] ${name}=${value}${tagsStr}`);
}

/**
 * Capture error to Sentry with context
 */
export function captureError(
  error: Error,
  context?: {
    level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
    tags?: Record<string, string>;
    user?: { id: string; email?: string };
    extra?: Record<string, any>;
  }
): string {
  // TODO: Install @sentry/nextjs to enable error tracking
  console.error(`[captureError] ${error.message}`, context);
  return 'stub-event-id';
}

/**
 * Set user context for Sentry
 */
export function setUser(user: { id: string; email?: string; username?: string }): void {
  // TODO: Install @sentry/nextjs to enable user tracking
  console.log('[setUser]', user);
}

/**
 * Clear user context
 */
export function clearUser(): void {
  // TODO: Install @sentry/nextjs to enable user tracking
  console.log('[clearUser]');
}

/**
 * Add breadcrumb for debugging
 */
export function breadcrumb(
  message: string,
  data?: Record<string, any>,
  level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug'
): void {
  // TODO: Install @sentry/nextjs to enable breadcrumbs
  console.log(`[Breadcrumb] ${message}`, { level: level || 'info', data });
}
