// src/components/optimization/OptimizeProjectButton.tsx
// Phase 138.0.6: Optimize Project Button
// Triggers a new optimization run for the current project

'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { runProjectOptimization } from '@/lib/optimization/client';

interface OptimizeProjectButtonProps {
  projectId: string;
  /** Locale for labels */
  locale?: 'en' | 'ar';
  /** Optional class names */
  className?: string;
  /** Called when optimization starts successfully */
  onOptimizationStarted?: (runId: string) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

/**
 * Button to start project optimization
 * Creates an OptimizationRun in Firestore via Cloud Function
 */
export const OptimizeProjectButton: React.FC<OptimizeProjectButtonProps> = ({
  projectId,
  locale = 'en',
  className = '',
  onOptimizationStarted,
  onError,
}) => {
  const { user } = useAuth();
  const [isOptimizing, setIsOptimizing] = useState(false);

  const isArabic = locale === 'ar';

  const labels = {
    optimize: isArabic ? 'تحسين المشروع الآن' : 'Optimize project now',
    optimizing: isArabic ? 'جاري التحسين...' : 'Optimizing...',
    signInRequired: isArabic ? 'سجّل دخولك أولاً' : 'Sign in first',
    success: isArabic ? 'بدأ التحسين!' : 'Optimization started!',
    error: isArabic ? 'فشل بدء التحسين' : 'Failed to start optimization',
  };

  const handleClick = async () => {
    if (!user || !projectId || isOptimizing) return;

    setIsOptimizing(true);
    try {
      // Firebase SDK httpsCallable automatically handles auth via the SDK
      const result = await runProjectOptimization(projectId);

      console.log('[Optimization] Started run', result);

      onOptimizationStarted?.(result.runId);

      // TODO Phase 138.2/138.3: Open OptimizationProgressModal
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      console.error('[Optimization] Failed to start run', err);
      onError?.(err);
    } finally {
      setIsOptimizing(false);
    }
  };

  if (!user) {
    return (
      <button
        disabled
        className={`inline-flex items-center rounded-lg bg-gray-400 px-4 py-2 text-sm font-medium text-white opacity-60 cursor-not-allowed ${className}`}
      >
        {labels.signInRequired}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isOptimizing}
      className={`inline-flex items-center rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-[#6D28D9] disabled:opacity-60 disabled:cursor-wait transition-colors ${className}`}
    >
      {isOptimizing ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {labels.optimizing}
        </>
      ) : (
        labels.optimize
      )}
    </button>
  );
};

export default OptimizeProjectButton;
