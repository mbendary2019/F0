'use client';

import { useEffect } from 'react';

/**
 * Locale-specific Global Error Boundary
 * Catches errors that occur before locale params are resolved
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to our incident tracking system
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        service: 'web',
        code: 500,
        message: error?.message || 'Locale global error',
        stack: error?.stack,
        context: {
          digest: error?.digest,
          route: '[locale]',
          timestamp: Date.now(),
        },
        fingerprint: `locale-global-error-${error?.digest || 'unknown'}`,
      }),
    }).catch((err) => {
      console.error('Failed to log error:', err);
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-lg shadow-xl p-8 text-center">
          <div className="mb-6">
            <div className="text-6xl mb-4">😞</div>
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-slate-400">
              We apologize for this error. The issue has been logged and will be resolved soon.
            </p>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 text-left bg-slate-900 p-4 rounded text-sm">
              <p className="text-red-400 font-mono break-all">
                {error?.message}
              </p>
              {error?.digest && (
                <p className="text-slate-500 text-xs mt-2">
                  Digest: {error.digest}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition font-medium"
            >
              Try again
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition font-medium"
            >
              Go home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
