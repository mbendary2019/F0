// src/app/[locale]/developers/error.tsx
'use client';

import { useEffect } from 'react';

/**
 * Developers Page Error Boundary
 * Catches errors specific to the /developers route
 */
export default function DevelopersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error with developers context
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        service: 'web',
        code: 500,
        message: error?.message || 'Developers page error',
        stack: error?.stack,
        context: {
          route: '/developers',
          digest: error?.digest,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
        },
        fingerprint: `developers-error-${error?.name || 'unknown'}`,
      }),
    }).catch((err) => {
      console.error('Failed to log error:', err);
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-slate-800 rounded-lg shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">خطأ في صفحة المطورين</h2>
          <p className="text-slate-400">
            حدث خطأ أثناء تحميل صفحة المطورين
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && error && (
          <div className="mb-6 bg-slate-900 p-4 rounded text-sm">
            <p className="font-semibold text-red-400 mb-2">Error Details:</p>
            <p className="text-red-300 font-mono text-xs break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-slate-500 text-xs mt-2">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={reset}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
          >
            إعادة المحاولة
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded transition"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    </div>
  );
}
