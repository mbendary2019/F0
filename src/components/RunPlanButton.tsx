/**
 * RunPlanButton Component
 * Executes plan without duplication using deterministic IDs
 * Features: debounce, inFlight guard, skip detection
 */

'use client';

import { useState, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { usePathname } from 'next/navigation';

interface RunPlanButtonProps {
  projectId: string;
  plan: any;
  onSuccess?: () => void;
  className?: string;
}

export default function RunPlanButton({
  projectId,
  plan,
  onSuccess,
  className = '',
}: RunPlanButtonProps) {
  const pathname = usePathname();
  const locale = pathname?.startsWith('/en') ? 'en' : 'ar';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Prevent multiple simultaneous requests
  const inFlight = useRef(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleRun = async () => {
    // Guard: prevent multiple simultaneous requests
    if (inFlight.current) {
      console.log('⏸️ Request already in flight, skipping');
      return;
    }

    // Validation
    if (!plan || !plan.phases || plan.phases.length === 0) {
      setError(locale === 'ar' ? 'لا توجد خطة للتنفيذ' : 'No plan to execute');
      return;
    }

    inFlight.current = true;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    // Clear any existing debounce timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    try {
      const runPlan = httpsCallable(functions, 'onRunPlan');
      const result = await runPlan({ projectId, plan, locale });
      const data = result.data as {
        ok: boolean;
        skipped?: boolean;
        message: string;
        stats?: any
      };

      if (data.ok) {
        console.log('✅ Plan executed:', data);

        // Show appropriate message
        const message = data.skipped
          ? (locale === 'ar'
              ? '⏭️ تم تجاهل التنفيذ (الخطة نفسها)'
              : '⏭️ Skipped (same plan)')
          : data.message;

        setSuccessMessage(message);

        // Only call onSuccess if plan was actually executed (not skipped)
        if (!data.skipped) {
          onSuccess?.();
        }
      } else {
        throw new Error(data.message || 'Execution failed');
      }
    } catch (e: any) {
      console.error('❌ Run plan failed:', e);
      setError(
        locale === 'ar'
          ? `خطأ: ${e.message || 'فشل التنفيذ'}`
          : `Error: ${e.message || 'Execution failed'}`
      );
    } finally {
      setLoading(false);

      // Reset inFlight guard after debounce period (1.5s)
      debounceTimeout.current = setTimeout(() => {
        inFlight.current = false;
      }, 1500);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleRun}
        disabled={loading}
        className={`
          px-6 py-3 rounded-lg font-medium
          bg-gradient-to-r from-purple-600 to-blue-600
          hover:from-purple-700 hover:to-blue-700
          text-white transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-purple-500/60
          ${className}
        `}
        aria-label={locale === 'ar' ? 'تنفيذ الخطة' : 'Execute plan'}
      >
        {loading
          ? locale === 'ar'
            ? '⏳ جارٍ التنفيذ...'
            : '⏳ Running...'
          : locale === 'ar'
          ? '🚀 نفّذ الخطة'
          : '🚀 Run Plan'}
      </button>

      {successMessage && (
        <div className="text-sm text-green-400 bg-green-950/30 px-4 py-2 rounded-lg border border-green-800/50">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-400 bg-red-950/30 px-4 py-2 rounded-lg border border-red-800/50">
          {error}
        </div>
      )}
    </div>
  );
}
