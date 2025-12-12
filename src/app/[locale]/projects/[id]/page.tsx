'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import F0Shell from '@/components/f0/F0Shell';
import { buildAppTypeLabel } from '@/lib/helpers/appTypeLabel';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import AgentPanel from './components/AgentPanel';
import { OptimizeProjectButton } from '@/components/optimization/OptimizeProjectButton';
import { OptimizationStatusCard } from '@/components/optimization/OptimizationStatusCard';
import { OptimizationHistoryList } from '@/components/optimization/OptimizationHistoryList';
import { useOptimizationHistory } from '@/hooks/useOptimizationHistory';
import { useRouter } from 'next/navigation';
// Phase 155.7: Autonomy components
import { RunAutonomyButton } from '@/components/agents/RunAutonomyButton';
import { PendingActionsPanel } from '@/components/agents/PendingActionsPanel';
import { AgentPlanPanel } from '@/components/agents/AgentPlanPanel';

// Mock project data (لـ f0-fullstack فقط كـ fallback)
const MOCK_PROJECT_DATA: Record<string, any> = {
  'f0-fullstack': {
    name: 'F0 Full-stack',
    appTypes: ['web', 'mobile', 'desktop'],
    mobileTargets: ['ios', 'android'],
    desktopTargets: ['mac', 'windows'],
    status: 'active',
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
};

export default function ProjectDetails() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';
  const isRTL = locale === 'ar';
  const { id } = params as { id: string };

  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);

  const [project, setProject] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Phase 138.2: Fetch optimization history
  const { runs: optimizationRuns, loading: historyLoading } = useOptimizationHistory(id, 5);

  const defaultProject =
    MOCK_PROJECT_DATA[id] || {
      name: id,
      appTypes: ['web'],
      status: 'active',
      updatedAt: new Date(),
    };

  // ✅ حمّل المشروع الحقيقي من Firestore: projects/{id}
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const ref = doc(db, 'projects', id);
        const snap = await getDoc(ref);

        if (cancelled) return;

        if (snap.exists()) {
          setProject({ id: snap.id, ...snap.data() });
        } else {
          setProject(defaultProject);
        }
      } catch (err) {
        console.error('Failed to load project', err);
        if (!cancelled) setProject(defaultProject);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const currentProject = project ?? defaultProject;

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return t('Unknown', 'غير معروف');

    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < 1) {
        return t('Just now', 'الآن');
      } else if (diffHours < 24) {
        const hours = Math.floor(diffHours);
        return locale === 'ar'
          ? `منذ ${hours} ساعة`
          : `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else if (diffHours < 48) {
        return t('Yesterday', 'أمس');
      } else {
        const days = Math.floor(diffHours / 24);
        return locale === 'ar'
          ? `منذ ${days} يوم`
          : `${days} day${days > 1 ? 's' : ''} ago`;
      }
    } catch (error) {
      return t('Unknown', 'غير معروف');
    }
  };

  const appTypesArr: string[] = Array.isArray(currentProject.appTypes)
    ? currentProject.appTypes
    : currentProject.type
    ? [currentProject.type]
    : currentProject.appType
    ? [currentProject.appType]
    : [];

  const mobileTargetsArr: string[] = Array.isArray(currentProject.mobileTargets)
    ? currentProject.mobileTargets
    : [];

  const desktopTargetsArr: string[] = Array.isArray(currentProject.desktopTargets)
    ? currentProject.desktopTargets
    : [];

  // ✅ استخدم الهيلبر بالتوقيع الجديد
  const typeLabel = buildAppTypeLabel(locale, currentProject);

  const statusLabel =
    currentProject.status === 'active' ? t('Active', 'فعّال') : t('Draft', 'مسودة');

  if (isLoading) {
    return (
      <F0Shell>
        <div className={`text-sm text-slate-400 ${isRTL ? 'text-right' : ''}`}>
          {t('Loading project…', 'جاري تحميل المشروع…')}
        </div>
      </F0Shell>
    );
  }

  return (
    <F0Shell>
      <div className={`space-y-3 mb-4 ${isRTL ? 'text-right' : ''}`}>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
          {t('F0 Panel · Project Details', 'F0 Panel · تفاصيل المشروع')}
        </p>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Brand Logo (if exists) - Phase 100.2 Improved: nested branding object */}
          {currentProject.branding?.logoUrl && (
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
              <img
                src={currentProject.branding.logoUrl}
                alt={currentProject.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <h1 className="text-2xl font-semibold text-white">{currentProject.name}</h1>
          <span
            className={`text-[10px] rounded-full px-2 py-0.5 ${
              currentProject.status === 'active'
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'bg-slate-800/60 text-slate-300'
            }`}
          >
            {statusLabel}
          </span>
        </div>
        <p className="text-sm text-slate-400">
          {t(
            'Overview, actions, and live controls for this project.',
            'نظرة عامة وإجراءات ولوحة تحكم Live لهذا المشروع.'
          )}
        </p>
      </div>

      <div className={`flex flex-col gap-4 ${isRTL ? 'text-right' : ''}`}>
        {/* Quick Actions */}
        <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Link
            href={`/${locale}/live?project=${id}`}
            className="inline-flex items-center rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_0_20px_rgba(236,72,153,0.6)] hover:brightness-110 transition"
          >
            {t('Open Live Coding', 'فتح Live Coding')}
          </Link>
          <Link
            href={`/${locale}/f0/projects/${id}/continue`}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.6)] hover:brightness-110 transition"
          >
            <span>🤖</span>
            <span>{t('Continue with Agent', 'استمرار مع الوكيل')}</span>
          </Link>
          <Link
            href={`/${locale}/f0/projects/${id}/media`}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.6)] hover:brightness-110 transition"
          >
            <span>🎨</span>
            <span>{t('AI Media Studio', 'استوديو الوسائط AI')}</span>
          </Link>
          <Link
            href={`/${locale}/projects/${id}/settings`}
            className="inline-flex items-center rounded-full border border-white/15 bg-slate-900/70 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 transition"
          >
            {t('Project Settings', 'إعدادات المشروع')}
          </Link>
          <Link
            href={`/${locale}/deployments?project=${id}`}
            className="inline-flex items-center rounded-full border border-white/15 bg-slate-900/70 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 transition"
          >
            {t('View Deployments', 'شوف الـ Deployments')}
          </Link>
          <Link
            href={`/${locale}/projects`}
            className="inline-flex items-center rounded-full border border-white/15 bg-slate-900/70 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 transition"
          >
            {t('Back to Projects', 'رجوع للمشاريع')}
          </Link>
          {/* Phase 138: Optimization Button */}
          <OptimizeProjectButton
            projectId={id}
            locale={locale}
            className="rounded-full"
            onOptimizationStarted={(runId) => {
              console.log('[ProjectDetails] Optimization started:', runId);
            }}
            onError={(error) => {
              console.error('[ProjectDetails] Optimization error:', error);
            }}
          />
          {/* Phase 155.7: Run Autonomy Button */}
          <RunAutonomyButton
            projectId={id}
            onStarted={(planId) => {
              console.log('[ProjectDetails] Autonomy started:', planId);
            }}
            onError={(error) => {
              console.error('[ProjectDetails] Autonomy error:', error);
            }}
            className="rounded-full"
          />
        </div>

        {/* Project Info Card */}
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">
              {t('Project Information', 'معلومات المشروع')}
            </h3>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">{t('Project ID:', 'معرف المشروع:')}</span>
                <span className="font-mono text-slate-200">{id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t('Type:', 'النوع:')}</span>
                <span className="text-slate-200">{typeLabel}</span>
              </div>

              {/* Platforms icons row */}
              <div className="flex justify-between">
                <span className="text-slate-400">
                  {t('Platforms:', 'المنصّات:')}
                </span>
                <div className={`flex flex-wrap gap-1 max-w-[70%] justify-end`}>
                  {/* App types */}
                  {appTypesArr.includes('web') && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-200">
                      <span>🌐</span>
                      <span>{t('Web', 'ويب')}</span>
                    </span>
                  )}
                  {appTypesArr.includes('mobile') && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-200">
                      <span>📱</span>
                      <span>{t('Mobile', 'موبايل')}</span>
                    </span>
                  )}
                  {appTypesArr.includes('desktop') && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-200">
                      <span>💻</span>
                      <span>{t('Desktop', 'ديسكتوب')}</span>
                    </span>
                  )}

                  {/* Mobile targets */}
                  {mobileTargetsArr.map((m) => (
                    <span
                      key={`m-${m}`}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-200"
                    >
                      {m === 'ios' ? (
                        <Image
                          src="/ios-icon.png"
                          alt="iOS"
                          width={12}
                          height={12}
                          className="inline-block"
                        />
                      ) : (
                        <Image
                          src="/android.png"
                          alt="Android"
                          width={12}
                          height={12}
                          className="inline-block"
                        />
                      )}
                      <span>{m === 'ios' ? 'iOS' : 'Android'}</span>
                    </span>
                  ))}

                  {/* Desktop targets */}
                  {desktopTargetsArr.map((d) => (
                    <span
                      key={`d-${d}`}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-200"
                    >
                      {d === 'mac' ? (
                        <Image
                          src="/mac-icon.png"
                          alt="Mac"
                          width={12}
                          height={12}
                          className="inline-block"
                        />
                      ) : d === 'windows' ? (
                        <Image
                          src="/windows-icon.png"
                          alt="Windows"
                          width={12}
                          height={12}
                          className="inline-block"
                        />
                      ) : (
                        <Image
                          src="/linux-icon.png"
                          alt="Linux"
                          width={12}
                          height={12}
                          className="inline-block"
                        />
                      )}
                      <span>
                        {d === 'mac'
                          ? 'Mac'
                          : d === 'windows'
                          ? 'Windows'
                          : 'Linux'}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">{t('Status:', 'الحالة:')}</span>
                <span className="text-slate-200">{statusLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t('Last updated:', 'آخر تحديث:')}</span>
                <span className="text-slate-200">{formatDate(currentProject.updatedAt)}</span>
              </div>
              {currentProject.createdAt && (
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('Created:', 'تاريخ الإنشاء:')}</span>
                  <span className="text-slate-200">{formatDate(currentProject.createdAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-1">
                {t('Deployments', 'الإصدارات')}
              </p>
              <p className="text-2xl font-semibold text-white">3</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {t('Last: 2 days ago', 'آخر: منذ يومين')}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-1">
                {t('Live Sessions', 'جلسات Live')}
              </p>
              <p className="text-2xl font-semibold text-white">12</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {t('Total hours: 8.5h', 'إجمالي الساعات: 8.5 س')}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-1">
                {t('Agent Tasks', 'مهام الوكيل')}
              </p>
              <p className="text-2xl font-semibold text-white">47</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {t('Completed', 'مكتملة')}
              </p>
            </div>
          </div>

          {/* Phase 138.1: Optimization Status Card */}
          <OptimizationStatusCard projectId={id} locale={locale} />

          {/* Phase 155.6: Pending Actions Panel */}
          <PendingActionsPanel
            projectId={id}
            onApprove={(actionId) => {
              console.log('[ProjectDetails] Action approved:', actionId);
            }}
            onReject={(actionId) => {
              console.log('[ProjectDetails] Action rejected:', actionId);
            }}
          />

          {/* Phase 155.4: Agent Plan Panel */}
          <AgentPlanPanel projectId={id} />

          {/* Phase 138.2: Optimization History */}
          {optimizationRuns.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">
                {t('Optimization History', 'سجل التحسينات')}
              </h3>
              <OptimizationHistoryList
                runs={optimizationRuns}
                locale={locale}
                onSelectRun={(runId) => {
                  router.push(`/${locale}/projects/${id}/optimization/${runId}`);
                }}
              />
            </div>
          )}

          {/* Agent Panel */}
          <AgentPanel locale={locale} projectId={id} project={currentProject} />
        </div>
      </div>
    </F0Shell>
  );
}
