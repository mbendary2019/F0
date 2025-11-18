'use client';

/**
 * Error boundary for Collab page
 * Catches errors in the collaborative editing features
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('[collab:error]', error);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Collab Crashed
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              The collaborative editor encountered an error
            </p>
          </div>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
            <p className="text-xs font-mono text-red-600 dark:text-red-400 break-words">
              {error?.message}
            </p>
            {error?.digest && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                Digest: {error.digest}
              </p>
            )}
            {error?.stack && (
              <details className="mt-3">
                <summary className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  Stack Trace
                </summary>
                <pre className="text-xs text-gray-700 dark:text-gray-300 mt-2 overflow-x-auto whitespace-pre-wrap">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => reset()}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            aria-label="Try again"
          >
            Retry
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 font-medium transition-colors"
            aria-label="Go home"
          >
            Go Home
          </button>
        </div>

        <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
          If this problem persists, please contact support
        </p>
      </div>
    </div>
  );
}
