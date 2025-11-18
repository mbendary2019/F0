// F0 Phase 36 - Sentry Integration for Cloud Functions

import * as Sentry from '@sentry/node';

// Initialize Sentry
const SENTRY_DSN = process.env.SENTRY_DSN;
const ENV = process.env.NODE_ENV || 'development';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENV,
    tracesSampleRate: ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      // Performance monitoring
      new Sentry.Integrations.Http({ tracing: true }),
    ],
  });

  console.log('✅ Sentry initialized for Cloud Functions');
} else {
  console.warn('⚠️  SENTRY_DSN not set - Sentry disabled');
}

export { Sentry };

/**
 * Wrap function with Sentry error tracking
 */
export function withSentry<T extends (...args: any[]) => any>(
  fn: T,
  name?: string
): T {
  return ((...args: any[]) => {
    const transaction = Sentry.startTransaction({
      op: 'function',
      name: name || fn.name || 'anonymous',
    });

    return Promise.resolve(fn(...args))
      .then(result => {
        transaction.setStatus('ok');
        return result;
      })
      .catch(error => {
        Sentry.captureException(error);
        transaction.setStatus('internal_error');
        throw error;
      })
      .finally(() => {
        transaction.finish();
      });
  }) as T;
}

/**
 * Capture exception with context
 */
export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.withScope(scope => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

/**
 * Capture message with context
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) {
  Sentry.withScope(scope => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
    }
    Sentry.captureMessage(message, level);
  });
}


