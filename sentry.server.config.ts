import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Filter out sensitive data
  beforeSend(event, hint) {
    // Don't send events if DSN is not configured
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
      return null;
    }

    // Remove sensitive environment variables
    if (event.contexts?.runtime?.env) {
      const env = event.contexts.runtime.env as Record<string, any>;
      Object.keys(env).forEach(key => {
        if (
          key.includes('KEY') ||
          key.includes('SECRET') ||
          key.includes('TOKEN') ||
          key.includes('PASSWORD') ||
          key.includes('PRIVATE')
        ) {
          env[key] = '[Filtered]';
        }
      });
    }

    return event;
  },

  environment: process.env.NODE_ENV,

  // Enable automatic error tracking
  enabled: process.env.NODE_ENV === 'production',
});
