'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';
import F0Shell from '@/components/f0/F0Shell';
import { useUserProjects } from '@/hooks/useUserProjects';
import { buildAppTypeLabel } from '@/lib/helpers/appTypeLabel';

export default function ProjectsPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';
  const isRTL = locale === 'ar';

  // Using real Firestore data
  const { projects, loading } = useUserProjects();

  const [filter, setFilter] = useState<'all' | 'web' | 'mobile' | 'desktop'>('all');

  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);

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

  const filteredProjects = projects.filter((p) => {
    if (filter === 'all') return true;

    const appTypes: string[] = Array.isArray(p.appTypes)
      ? p.appTypes
      : p.type
      ? [p.type]
      : p.appType
      ? [p.appType]
      : [];

    return appTypes.includes(filter);
  });

  return (
    <F0Shell>
      <div className="w-full">
        <div className={`space-y-3 mb-4 ${isRTL ? 'text-right' : ''}`}>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
          {t('F0 Panel · Projects', 'F0 Panel · المشاريع')}
        </p>
        <h1 className="text-2xl font-semibold text-white">
          {t('Projects', 'المشاريع')}
        </h1>
        <p className="text-sm text-slate-400">
          {t(
            'Manage all AI-generated apps linked to your F0 account.',
            'إدارة كل التطبيقات التي أنشأها F0 والمرتبطة بحسابك.'
          )}
        </p>
      </div>

      <div className={`flex flex-wrap gap-3 justify-between items-center mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <p className="text-xs text-slate-400">
          {t(
            'Select a project to open its control panel, or start a new one.',
            'اختر مشروعًا لفتح لوحة التحكم أو ابدأ مشروعًا جديدًا.'
          )}
        </p>
        <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Link
            href={`/${locale}/projects/new`}
            className="inline-flex items-center rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_0_20px_rgba(236,72,153,0.6)] hover:brightness-110 transition"
          >
            {t('Start new project', 'بدء مشروع جديد')}
          </Link>
          <Link
            href={`/${locale}/live`}
            className="inline-flex items-center rounded-full border border-white/15 bg-slate-900/70 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 transition"
          >
            {t('Go to Live Coding', 'الذهاب إلى Live Coding')}
          </Link>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm">
            {t('Loading projects...', 'جاري تحميل المشاريع...')}
          </p>
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="text-center py-12 bg-slate-950/30 backdrop-blur border border-white/5 rounded-2xl">
          <div className="text-6xl mb-4">📦</div>
          <p className="text-slate-400 mb-4 text-sm">
            {t(
              'No projects yet. Start your first AI-powered project!',
              'لا توجد مشاريع بعد. ابدأ أول مشروع مدعوم بالذكاء الاصطناعي!'
            )}
          </p>
          <Link
            href={`/${locale}/projects/new`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 text-white font-medium hover:brightness-110 transition shadow-[0_0_20px_rgba(236,72,153,0.6)]"
          >
            {t('Create your first project', 'إنشاء أول مشروع')}
          </Link>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className={`mb-4 flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {[
            ['all', t('All types', 'كل الأنواع')],
            ['web', t('Web', 'ويب')],
            ['mobile', t('Mobile', 'موبايل')],
            ['desktop', t('Desktop', 'ديسكتوب')],
          ].map(([value, label]) => {
            const v = value as 'all' | 'web' | 'mobile' | 'desktop';
            const active = filter === v;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(v)}
                className={[
                  'text-[11px] rounded-full px-3 py-1 border transition',
                  active
                    ? 'border-fuchsia-400 text-fuchsia-100 bg-fuchsia-500/20'
                    : 'border-slate-600 text-slate-300 bg-slate-950/40 hover:border-fuchsia-400/60 hover:text-slate-50',
                ].join(' ')}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className="space-y-3">
          {filteredProjects.map((p) => {
            const status = p.status || 'active';
            const statusLabel = status === 'active' ? t('Active', 'فعّال') : t('Draft', 'مسودة');

            // Get app type label with sub-options
            const typeLabel = buildAppTypeLabel(locale, p);

            return (
              <div
                key={p.id}
                className="rounded-2xl border border-white/10 bg-slate-950/75 px-5 py-4 flex items-center justify-between hover:border-violet-300/60 hover:bg-slate-900/85 transition"
              >
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <h2 className="text-sm font-semibold text-white">
                      {p.name || t('Untitled Project', 'مشروع بدون عنوان')}
                    </h2>
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-black/40 text-slate-200">
                      {typeLabel}
                    </span>
                    <span
                      className={`text-[10px] rounded-full px-2 py-0.5 ${
                        status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-200'
                          : 'bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  {/* Icons row */}
                  {(() => {
                    const appTypesArr: string[] = Array.isArray(p.appTypes)
                      ? p.appTypes
                      : p.type
                      ? [p.type]
                      : p.appType
                      ? [p.appType]
                      : [];

                    const mobileTargetsArr: string[] = Array.isArray(p.mobileTargets)
                      ? p.mobileTargets
                      : [];
                    const desktopTargetsArr: string[] = Array.isArray(p.desktopTargets)
                      ? p.desktopTargets
                      : [];

                    return (
                      <div className={`mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-300 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        {appTypesArr.includes('web') && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5">
                            <span>🌐</span>
                            <span>{t('Web', 'ويب')}</span>
                          </span>
                        )}
                        {appTypesArr.includes('mobile') && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5">
                            <span>📱</span>
                            <span>{t('Mobile', 'موبايل')}</span>
                          </span>
                        )}
                        {appTypesArr.includes('desktop') && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5">
                            <span>💻</span>
                            <span>{t('Desktop', 'ديسكتوب')}</span>
                          </span>
                        )}

                        {/* منصات الموبايل */}
                        {mobileTargetsArr.map((m) => (
                          <span
                            key={`m-${m}`}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-900/60 px-2 py-0.5"
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

                        {/* منصات الديسكتوب */}
                        {desktopTargetsArr.map((d) => (
                          <span
                            key={`d-${d}`}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-900/60 px-2 py-0.5"
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
                    );
                  })()}

                  <p className="text-[11px] text-slate-400 mt-1">
                    {t('Last updated:', 'آخر تحديث:')}{' '}
                    {formatDate(p.lastUpdatedAt)}
                  </p>
                </div>

                <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={() => router.push(`/${locale}/projects/${p.id}`)}
                    className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-slate-100 hover:bg-slate-900/60 transition"
                  >
                    {t('View details', 'عرض التفاصيل')}
                  </button>
                  <button
                    onClick={() => router.push(`/${locale}/live?project=${p.id}`)}
                    className="rounded-full bg-gradient-to-r from-violet-500 to-sky-500 px-3 py-1 text-[11px] font-semibold text-white shadow-[0_0_15px_rgba(56,189,248,0.8)] hover:brightness-110 transition"
                  >
                    Live Coding
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </F0Shell>
  );
}
