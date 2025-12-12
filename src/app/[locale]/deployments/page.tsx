'use client';

import { useParams } from 'next/navigation';
import { useDeployments } from '@/hooks/useDeployments';
import F0Shell from '@/components/f0/F0Shell';

export default function DeploymentsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const isRTL = locale === 'ar';

  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);

  const { deployments, loading } = useDeployments();

  if (loading) {
    return (
      <F0Shell>
        <div className={`space-y-3 mb-4 ${isRTL ? 'text-right' : ''}`}>
          <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
          <div className="h-7 w-64 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-96 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 w-full bg-white/5 rounded-xl border border-white/10 animate-pulse"
            />
          ))}
        </div>
      </F0Shell>
    );
  }

  const hasDeployments = deployments.length > 0;

  return (
    <F0Shell>
      <div className={`space-y-3 mb-4 ${isRTL ? 'text-right' : ''}`}>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
          {t('F0 Deployments', 'إصدارات F0')}
        </p>
        <h1 className="text-2xl font-semibold text-white">
          {t('Deployment History', 'سجل الإصدارات')}
        </h1>
        <p className="text-sm text-slate-400">
          {t(
            'View all deployments across your projects — production, preview, and failed builds.',
            'شاهد كل الإصدارات عبر مشاريعك — Production، Preview، والإصدارات الفاشلة.'
          )}
        </p>
      </div>

      {/* لو مافيش داتا */}
      {!hasDeployments && (
        <div className="mt-6 rounded-xl border border-dashed border-white/10 bg-slate-900/40 px-6 py-10 text-center text-sm text-slate-400">
          {t(
            'No deployments found yet. Connect your project to Vercel or GitHub Actions to see history here.',
            'لا توجد إصدارات حتى الآن. اربط مشروعك بـ Vercel أو GitHub Actions لعرض السجل هنا.'
          )}
        </div>
      )}

      {/* لو فيه داتا */}
      {hasDeployments && (
        <div className="mt-4 space-y-3">
          {deployments.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/70 hover:bg-slate-900/90 px-4 py-4 transition cursor-pointer"
            >
              <div className={isRTL ? 'text-right' : ''}>
                <p className="text-sm font-semibold text-white">
                  {d.projectName}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {t('Branch', 'الفرع')}: <span className="font-mono">{d.branch}</span> · {t('Env', 'البيئة')}:{' '}
                  {d.env} · {t('Provider', 'المزود')}: {d.provider}
                </p>
                {d.createdAt && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {d.createdAt.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                )}
              </div>

              <div className={`flex flex-col items-end gap-2 ${isRTL ? 'items-start' : ''}`}>
                <span
                  className={[
                    'px-3 py-1 rounded-full text-[11px] font-medium capitalize',
                    d.status === 'success'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : d.status === 'failed'
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-yellow-500/20 text-yellow-300',
                  ].join(' ')}
                >
                  {d.status}
                </span>
                <button className="text-[11px] text-pink-300 underline underline-offset-2 hover:text-pink-400 transition">
                  {t('View details', 'عرض التفاصيل')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </F0Shell>
  );
}
