// src/app/global-error.tsx
'use client';

import { useEffect } from 'react';

/**
 * Global Error Boundary
 * Catches unhandled errors in the app and logs them to /api/log
 * This creates incidents automatically for critical errors
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
        message: error?.message || 'Global unhandled error',
        stack: error?.stack,
        context: {
          digest: error?.digest,
          route: 'global',
          timestamp: Date.now(),
        },
        fingerprint: `global-error-${error?.digest || 'unknown'}`,
      }),
    }).catch((err) => {
      console.error('Failed to log error:', err);
    });
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-lg shadow-xl p-8 text-center">
          <div className="mb-6">
            <div className="text-6xl mb-4">😞</div>
            <h2 className="text-2xl font-bold mb-2">حدث خطأ غير متوقع</h2>
            <p className="text-slate-400">
              نعتذر عن هذا الخلل. تم تسجيل المشكلة وسيتم حلها قريباً.
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

          <button
            onClick={reset}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition"
          >
            حاول مرة أخرى
          </button>
        </div>
      </body>
    </html>
  );
}
