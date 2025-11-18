/**
 * Next.js Instrumentation Hook
 * Sets up Sentry and other observability tools
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side instrumentation
    // TODO: Install @sentry/nextjs to enable monitoring
    console.log('[Instrumentation] Sentry not configured');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime instrumentation (if needed)
    console.log('[Instrumentation] Edge runtime detected');
  }
}
