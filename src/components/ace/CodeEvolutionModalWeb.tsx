// src/components/ace/CodeEvolutionModalWeb.tsx
// =============================================================================
// Phase 150.1 – Web Code Evolution Modal (synced with Desktop Design)
// Phase 150.3 – Wired to ACE API
// Phase 150.3.8 – Job-based flow with polling
// =============================================================================
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { AceRun, AceJob } from '@/types/ace';
import { fetchAceRuns, triggerAceJob, pollJobUntilComplete } from '@/lib/aceWebClient';

type TabId = 'overview' | 'plan' | 'suggestions';

interface CodeEvolutionModalWebProps {
  onClose: () => void;
  projectId?: string;
  locale?: 'en' | 'ar';
}

const tabs: { id: TabId; label: string; labelAr: string }[] = [
  { id: 'overview', label: 'Overview', labelAr: 'نظرة عامة' },
  { id: 'plan', label: 'Evolution Plan', labelAr: 'خطة التطور' },
  { id: 'suggestions', label: 'Suggestions', labelAr: 'اقتراحات' },
];

export function CodeEvolutionModalWeb({ onClose, projectId, locale = 'en' }: CodeEvolutionModalWebProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [runs, setRuns] = useState<AceRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [currentJob, setCurrentJob] = useState<AceJob | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const isArabic = locale === 'ar';

  // Load ACE runs on mount
  useEffect(() => {
    if (!projectId) return;

    const loadRuns = async () => {
      try {
        setLoading(true);
        const data = await fetchAceRuns(projectId);
        setRuns(data);
      } catch (e) {
        console.error('[150.3][ACE_MODAL] Failed to load runs:', e);
      } finally {
        setLoading(false);
      }
    };

    loadRuns();
  }, [projectId]);

  // Handle Recompute - Job-based flow with polling
  const handleRecompute = useCallback(async () => {
    if (!projectId) {
      console.warn('[150.3.8][ACE_MODAL] No projectId for recompute');
      return;
    }

    try {
      setRecomputing(true);
      setJobStatus('pending');

      // Step 1: Create job in Firestore
      console.log('[150.3.8][ACE_MODAL] Creating ACE job...');
      const { jobId } = await triggerAceJob(projectId, { mode: 'guided' });

      // Step 2: Poll until Desktop picks it up and completes
      console.log('[150.3.8][ACE_MODAL] Polling job...', { jobId });
      const completedJob = await pollJobUntilComplete(projectId, jobId, {
        timeoutMs: 180_000, // 3 minutes
        intervalMs: 2000,   // 2 seconds
        onStatusChange: (job: AceJob) => {
          console.log('[150.3.8][ACE_MODAL] Job status changed', {
            status: job.status,
            runId: job.runId
          });
          setCurrentJob(job);
          setJobStatus(job.status);
        },
      });

      // Step 3: If completed with runId, refresh runs list
      if (completedJob.status === 'completed' && completedJob.runId) {
        console.log('[150.3.8][ACE_MODAL] Job completed, refreshing runs...', {
          runId: completedJob.runId
        });
        const updatedRuns = await fetchAceRuns(projectId);
        setRuns(updatedRuns);
      } else if (completedJob.status === 'failed') {
        console.error('[150.3.8][ACE_MODAL] Job failed:', completedJob.error);
      }

      setCurrentJob(completedJob);
    } catch (e) {
      console.error('[150.3.8][ACE_MODAL] Failed to trigger/poll job:', e);
      setJobStatus('failed');
    } finally {
      setRecomputing(false);
    }
  }, [projectId]);

  const lastRun = runs[0] ?? null;
  const totalPatches = runs.reduce((sum, r) => sum + r.totalApplied, 0);
  const totalIssuesFixed = runs.reduce((sum, r) => sum + (r.targetedIssues ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-3xl rounded-2xl bg-[#0b0616] border border-white/10 shadow-2xl shadow-purple-900/60 overflow-hidden"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-gradient-to-r from-purple-900/20 to-transparent">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span className="text-lg">🧬</span>
              {isArabic ? 'محرك تطور الكود' : 'Code Evolution Engine'}
            </h2>
            <p className="text-[11px] text-white/50 mt-0.5">
              {isArabic
                ? 'ACE – التطور التلقائي للكود (Web IDE)'
                : 'ACE – Auto Code Evolution (Web IDE)'
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/5 transition"
          >
            {isArabic ? 'إغلاق' : 'Close'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 text-xs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 transition ${
                activeTab === tab.id
                  ? 'text-white bg-white/5 border-b-2 border-purple-500'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              {isArabic ? tab.labelAr : tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5 min-h-[320px]">
          {activeTab === 'overview' && (
            <OverviewTab
              isArabic={isArabic}
              loading={loading}
              runs={runs}
              lastRun={lastRun}
              totalPatches={totalPatches}
              totalIssuesFixed={totalIssuesFixed}
            />
          )}
          {activeTab === 'plan' && (
            <PlanTab isArabic={isArabic} />
          )}
          {activeTab === 'suggestions' && (
            <SuggestionsTab isArabic={isArabic} hasRuns={runs.length > 0} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40">
              {projectId
                ? (isArabic ? `المشروع: ${projectId.slice(0, 8)}...` : `Project: ${projectId.slice(0, 8)}...`)
                : (isArabic ? 'لا يوجد مشروع نشط' : 'No active project')
              }
            </span>
            {/* Job Status Indicator */}
            {jobStatus && recomputing && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                jobStatus === 'pending' ? 'bg-amber-500/15 text-amber-300' :
                jobStatus === 'running' ? 'bg-blue-500/15 text-blue-300' :
                jobStatus === 'completed' ? 'bg-emerald-500/15 text-emerald-300' :
                'bg-red-500/15 text-red-300'
              }`}>
                {jobStatus === 'pending' && (isArabic ? '⏳ في الانتظار' : '⏳ Pending')}
                {jobStatus === 'running' && (isArabic ? '🔄 Desktop يعمل...' : '🔄 Desktop processing...')}
                {jobStatus === 'completed' && (isArabic ? '✅ تم' : '✅ Done')}
                {jobStatus === 'failed' && (isArabic ? '❌ فشل' : '❌ Failed')}
              </span>
            )}
          </div>
          <button
            onClick={handleRecompute}
            disabled={recomputing || !projectId}
            className="rounded-lg bg-purple-600/80 px-4 py-1.5 text-xs font-medium text-white shadow-md shadow-purple-700/40 hover:bg-purple-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {recomputing
              ? (isArabic ? 'جاري التشغيل...' : 'Running...')
              : (isArabic ? 'إعادة حساب' : 'Recompute')
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// Sub-components for tabs

interface OverviewTabProps {
  isArabic: boolean;
  loading: boolean;
  runs: AceRun[];
  lastRun: AceRun | null;
  totalPatches: number;
  totalIssuesFixed: number;
}

function OverviewTab({ isArabic, loading, runs, lastRun, totalPatches, totalIssuesFixed }: OverviewTabProps) {
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-white/60">
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          {isArabic ? 'جاري التحميل...' : 'Loading...'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white/5 border border-white/5 p-4 text-center">
          <p className="text-2xl font-bold text-white">{runs.length}</p>
          <p className="text-[10px] text-white/50 mt-1">
            {isArabic ? 'إجمالي التشغيلات' : 'Total Runs'}
          </p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/5 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{totalPatches}</p>
          <p className="text-[10px] text-white/50 mt-1">
            {isArabic ? 'التصحيحات المطبقة' : 'Patches Applied'}
          </p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/5 p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">{totalIssuesFixed}</p>
          <p className="text-[10px] text-white/50 mt-1">
            {isArabic ? 'المشاكل المستهدفة' : 'Issues Targeted'}
          </p>
        </div>
      </div>

      {/* Last Run */}
      <div className="rounded-xl bg-white/5 border border-white/5 p-4">
        <p className="text-xs text-white/60 mb-2">
          {isArabic ? 'آخر تشغيل' : 'Last Run'}
        </p>
        {lastRun ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">
                {new Date(lastRun.finishedAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}
              </p>
              <p className="text-xs text-white/50 mt-0.5">
                {lastRun.filesProcessed} {isArabic ? 'ملف' : 'files'} · {lastRun.totalApplied} {isArabic ? 'تصحيح' : 'patches'}
              </p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              lastRun.totalApplied > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white/50'
            }`}>
              {lastRun.totalApplied > 0
                ? (isArabic ? 'تم التحسين' : 'Improved')
                : (isArabic ? 'لا تغييرات' : 'No changes')
              }
            </span>
          </div>
        ) : (
          <p className="text-sm text-white/80">
            {isArabic
              ? 'لم يتم تشغيل ACE بعد. اضغط "إعادة حساب" للبدء.'
              : 'ACE has not run yet. Click "Recompute" to start.'
            }
          </p>
        )}
      </div>

      {/* Recent Runs List */}
      {runs.length > 1 && (
        <div className="rounded-xl bg-white/5 border border-white/5 p-4">
          <p className="text-xs text-white/60 mb-2">
            {isArabic ? 'التشغيلات الأخيرة' : 'Recent Runs'}
          </p>
          <div className="space-y-2 max-h-32 overflow-auto">
            {runs.slice(0, 5).map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-1.5 bg-white/[0.02] text-[11px]"
              >
                <span className="text-white/70">
                  {new Date(run.finishedAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}
                </span>
                <span className="text-white/50">
                  {run.totalApplied} {isArabic ? 'تصحيح' : 'patches'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanTab({ isArabic }: { isArabic: boolean }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70">
        {isArabic
          ? 'خطة التطور التلقائي للمشروع:'
          : 'Automated evolution plan for the project:'
        }
      </p>

      {/* Phase Steps */}
      <div className="space-y-3">
        {[1, 2, 3].map((phase) => (
          <div
            key={phase}
            className="rounded-lg bg-white/5 border border-white/5 p-4 flex items-start gap-3"
          >
            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-300 font-bold">
              {phase}
            </div>
            <div className="flex-1">
              <p className="text-sm text-white/80">
                {isArabic ? `المرحلة ${phase}` : `Phase ${phase}`}
              </p>
              <p className="text-xs text-white/50 mt-0.5">
                {isArabic
                  ? 'سيتم تحديد الخطوات بناءً على تحليل المشروع'
                  : 'Steps will be determined based on project analysis'
                }
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40">
              {isArabic ? 'قادم' : 'Upcoming'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuggestionsTab({ isArabic, hasRuns }: { isArabic: boolean; hasRuns: boolean }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70">
        {isArabic
          ? 'اقتراحات لتحسين جودة الكود:'
          : 'Suggestions to improve code quality:'
        }
      </p>

      {/* Suggestion Cards */}
      <div className="space-y-3">
        {!hasRuns ? (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
            <div className="flex items-start gap-3">
              <span className="text-lg">💡</span>
              <div>
                <p className="text-sm text-amber-200">
                  {isArabic
                    ? 'قم بتشغيل ACE أولاً'
                    : 'Run ACE first'
                  }
                </p>
                <p className="text-xs text-white/50 mt-1">
                  {isArabic
                    ? 'اضغط "إعادة حساب" لتحليل المشروع وتوليد اقتراحات مخصصة'
                    : 'Click "Recompute" to analyze the project and generate custom suggestions'
                  }
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
            <div className="flex items-start gap-3">
              <span className="text-lg">✅</span>
              <div>
                <p className="text-sm text-emerald-200">
                  {isArabic
                    ? 'تم تحليل المشروع'
                    : 'Project analyzed'
                  }
                </p>
                <p className="text-xs text-white/50 mt-1">
                  {isArabic
                    ? 'استمر في تشغيل ACE لتحسين جودة الكود بشكل مستمر'
                    : 'Continue running ACE to improve code quality continuously'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg bg-white/5 border border-white/5 p-4 flex items-center justify-center">
          <span className="text-xs text-white/40">
            {isArabic
              ? 'ستظهر اقتراحات إضافية بناءً على تحليل ACE'
              : 'More suggestions will appear based on ACE analysis'
            }
          </span>
        </div>
      </div>
    </div>
  );
}
