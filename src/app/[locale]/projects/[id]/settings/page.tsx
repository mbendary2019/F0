'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import F0Shell from '@/components/f0/F0Shell';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ProjectPreviewSettingsCard } from '@/features/projects/ProjectPreviewSettingsCard';

type AppType = 'web' | 'mobile' | 'desktop';
type InfraType = 'firebase' | 'supabase' | 'custom';
type MobileTarget = 'ios' | 'android';
type DesktopTarget = 'mac' | 'windows' | 'linux';

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';
  const projectId = params?.id as string;
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [appTypes, setAppTypes] = useState<AppType[]>(['web']);
  const [mobileTargets, setMobileTargets] = useState<MobileTarget[]>([]);
  const [desktopTargets, setDesktopTargets] = useState<DesktopTarget[]>([]);
  const [infraType, setInfraType] = useState<InfraType>('firebase');

  const t = {
    title: isRTL ? 'إعدادات المشروع' : 'Project settings',
    subtitle: isRTL
      ? 'عدّل اسم المشروع، نوع التطبيق، والمنصّات المستهدفة.'
      : 'Edit project name, app types, and target platforms.',
    basicInfoTitle: isRTL ? '١ — بيانات أساسية' : '1 — Basic information',
    nameLabel: isRTL ? 'اسم المشروع' : 'Project name',
    appTypeTitle: isRTL ? '٢ — نوع التطبيق' : '2 — App type',
    appTypeHint: isRTL
      ? 'يُفضَّل أن يعكس نوع التطبيق ما سيتم نشره فعليًا.'
      : 'App types should reflect what you actually plan to ship.',
    infraTitle: isRTL ? '٣ — البنية التحتية' : '3 — Infrastructure',
    infraHint: isRTL
      ? 'هذه القيمة تُستخدم من الوكيل لاختيار إعدادات النشر الافتراضية.'
      : 'This value is used by the agent to pick default deployment settings.',
    saveButton: isRTL ? 'حفظ التغييرات' : 'Save changes',
    savingButton: isRTL ? 'جارٍ الحفظ...' : 'Saving...',
    backButton: isRTL ? 'رجوع للمشروع' : 'Back to project',
  };

  // ⬇️ تحميل بيانات المشروع من Firestore
  useEffect(() => {
    async function load() {
      try {
        const ref = doc(db, 'ops_projects', projectId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError(
            isRTL
              ? 'لم يتم العثور على المشروع.'
              : 'Project not found.'
          );
          setLoading(false);
          return;
        }

        const data = snap.data() as any;

        setName(data.name ?? '');
        const primaryType: AppType | undefined =
          data.type ||
          data.appType ||
          (Array.isArray(data.appTypes) ? data.appTypes[0] : undefined);

        // appTypes
        if (Array.isArray(data.appTypes) && data.appTypes.length > 0) {
          setAppTypes(data.appTypes as AppType[]);
        } else if (primaryType) {
          setAppTypes([primaryType]);
        } else {
          setAppTypes(['web']);
        }

        // mobile / desktop targets
        setMobileTargets(
          Array.isArray(data.mobileTargets)
            ? (data.mobileTargets as MobileTarget[])
            : []
        );
        setDesktopTargets(
          Array.isArray(data.desktopTargets)
            ? (data.desktopTargets as DesktopTarget[])
            : []
        );

        // infra
        setInfraType(
          (data.infraType as InfraType) ||
            (data.infrastructure as InfraType) ||
            'firebase'
        );
      } catch (err) {
        console.error('Failed to load project settings', err);
        setError(
          isRTL
            ? 'حدث خطأ أثناء تحميل بيانات المشروع.'
            : 'Failed to load project data.'
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [projectId, isRTL]);

  const toggleAppType = (value: AppType) => {
    setAppTypes((prev) => {
      const exists = prev.includes(value);
      let next: AppType[];

      if (exists) {
        next = prev.filter((v) => v !== value);
      } else {
        next = [...prev, value];
      }

      // ما نخليش الليست فاضية
      if (next.length === 0) next = ['web'];

      // تنظيف المنصات لو نوع التطبيق اتشال
      if (!next.includes('mobile')) setMobileTargets([]);
      if (!next.includes('desktop')) setDesktopTargets([]);

      return next;
    });
  };

  const toggleMobileTarget = (value: MobileTarget) => {
    setMobileTargets((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  const toggleDesktopTarget = (value: DesktopTarget) => {
    setDesktopTargets((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(
        isRTL
          ? 'من فضلك أدخل اسم المشروع.'
          : 'Please enter a project name.'
      );
      return;
    }

    if (!appTypes || appTypes.length === 0) {
      setError(
        isRTL
          ? 'من فضلك اختر نوع تطبيق واحد على الأقل.'
          : 'Please select at least one app type.'
      );
      return;
    }

    if (appTypes.includes('mobile') && mobileTargets.length === 0) {
      setError(
        isRTL
          ? 'من فضلك اختر منصة واحدة على الأقل للموبايل.'
          : 'Please select at least one mobile platform.'
      );
      return;
    }

    if (appTypes.includes('desktop') && desktopTargets.length === 0) {
      setError(
        isRTL
          ? 'من فضلك اختر منصة واحدة على الأقل للديسكتوب.'
          : 'Please select at least one desktop platform.'
      );
      return;
    }

    setSaving(true);

    try {
      const primaryAppType: AppType = appTypes[0] ?? 'web';

      await updateDoc(doc(db, 'ops_projects', projectId), {
        name: name.trim(),
        appTypes,
        appType: primaryAppType, // backward-compat
        type: primaryAppType,    // backward-compat
        mobileTargets: appTypes.includes('mobile') ? mobileTargets : [],
        desktopTargets: appTypes.includes('desktop') ? desktopTargets : [],
        infraType,
        infrastructure: infraType,
        updatedAt: Date.now(),
        lastUpdatedAt: Date.now(),
      });

      router.push(`/${locale}/projects/${projectId}`);
    } catch (err) {
      console.error('Failed to save project settings', err);
      setError(
        isRTL
          ? 'حدث خطأ أثناء حفظ التغييرات. حاول مرة أخرى.'
          : 'Failed to save changes. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <F0Shell>
        <div className={isRTL ? 'text-right text-sm text-slate-400' : 'text-sm text-slate-400'}>
          {isRTL ? 'جاري تحميل إعدادات المشروع...' : 'Loading project settings...'}
        </div>
      </F0Shell>
    );
  }

  return (
    <F0Shell>
      <div
        className={`max-w-3xl mx-auto ${isRTL ? 'text-right' : 'text-left'}`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="space-y-3 mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
            F0 Panel · {isRTL ? 'إعدادات المشروع' : 'Project Settings'}
          </p>
          <h1 className="text-2xl font-semibold text-white">{t.title}</h1>
          <p className="text-sm text-slate-400">{t.subtitle}</p>

          <button
            type="button"
            onClick={() => router.push(`/${locale}/projects/${projectId}`)}
            className="mt-2 inline-flex items-center rounded-full border border-white/20 px-3 py-1 text-[11px] text-slate-100 hover:bg-slate-900/60 transition"
          >
            {t.backButton}
          </button>
        </div>

        {error && (
          <div className="mb-4 text-xs text-red-400 bg-red-950/40 border border-red-500/40 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Basic info */}
          <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-6 backdrop-blur">
            <h2 className="text-sm font-semibold text-slate-100 mb-4">
              {t.basicInfoTitle}
            </h2>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">
                {t.nameLabel}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-slate-950/40 border border-slate-700/70 px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/80 focus:border-transparent"
              />
            </div>
          </section>

          {/* Step 2: App type */}
          <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-6 backdrop-blur">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-sm font-semibold text-slate-100">
                {t.appTypeTitle}
              </h2>
              <p className="text-xs text-slate-400">{t.appTypeHint}</p>
            </div>

            <div
              className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${
                isRTL ? 'text-right' : 'text-left'
              }`}
            >
              {(
                [
                  ['web', isRTL ? 'ويب' : 'Web'],
                  ['mobile', isRTL ? 'موبايل' : 'Mobile'],
                  ['desktop', isRTL ? 'ديسكتوب' : 'Desktop'],
                ] as [AppType, string][]
              ).map(([value, label]) => {
                const isActive = appTypes.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleAppType(value)}
                    data-active={isActive}
                    className={[
                      'rounded-xl border px-4 py-3 text-sm font-medium transition',
                      'bg-slate-950/40',
                      isActive
                        ? 'border-fuchsia-500/80 text-slate-50 shadow-[0_0_25px_rgba(236,72,153,0.55)]'
                        : 'border-slate-600/80 text-slate-300 hover:border-fuchsia-400/70 hover:text-slate-50 hover:bg-slate-900/80',
                    ].join(' ')}
                  >
                    <div className={isActive ? 'text-slate-50' : 'text-slate-100'}>{label}</div>
                    <div className={`text-[11px] mt-1 ${isActive ? 'text-slate-200 opacity-90' : 'text-slate-400'}`}>
                      {value === 'web' &&
                        (isRTL ? 'Next.js / React / SaaS' : 'Next.js / React / SaaS')}
                      {value === 'mobile' &&
                        (isRTL
                          ? 'تطبيقات جوال (مثلاً Flutter)'
                          : 'Mobile apps (e.g. Flutter)')}
                      {value === 'desktop' &&
                        (isRTL
                          ? 'تطبيقات ديسكتوب (Electron وغيرها)'
                          : 'Desktop apps (Electron, etc.)')}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Mobile sub-options */}
            {appTypes.includes('mobile') && (
              <div className="mt-4 border-t border-slate-700/60 pt-4">
                <p className="text-xs text-slate-400 mb-2">
                  {isRTL ? 'منصات الموبايل:' : 'Mobile platforms:'}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {(
                    [
                      ['ios', 'iOS'],
                      ['android', 'Android'],
                    ] as [MobileTarget, string][]
                  ).map(([value, label]) => {
                    const active = mobileTargets.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleMobileTarget(value)}
                        className={[
                          'rounded-full px-3 py-1 border transition',
                          active
                            ? 'border-emerald-400/80 text-emerald-100 bg-emerald-900/40 shadow-[0_0_15px_rgba(52,211,153,0.6)]'
                            : 'border-slate-600/70 text-slate-200 bg-slate-950/40 hover:border-emerald-400/70',
                        ].join(' ')}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Desktop sub-options */}
            {appTypes.includes('desktop') && (
              <div className="mt-4 border-t border-slate-700/60 pt-4">
                <p className="text-xs text-slate-400 mb-2">
                  {isRTL ? 'منصات الديسكتوب:' : 'Desktop platforms:'}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {(
                    [
                      ['mac', 'Mac'],
                      ['windows', 'Windows'],
                      ['linux', 'Linux'],
                    ] as [DesktopTarget, string][]
                  ).map(([value, label]) => {
                    const active = desktopTargets.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleDesktopTarget(value)}
                        className={[
                          'rounded-full px-3 py-1 border transition',
                          active
                            ? 'border-sky-400/80 text-sky-100 bg-sky-900/40 shadow-[0_0_15px_rgba(56,189,248,0.6)]'
                            : 'border-slate-600/70 text-slate-200 bg-slate-950/40 hover:border-sky-400/70',
                        ].join(' ')}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Step 3: Infra */}
          <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-6 backdrop-blur">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-sm font-semibold text-slate-100">
                {t.infraTitle}
              </h2>
              <p className="text-xs text-slate-400">{t.infraHint}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              {(
                [
                  ['firebase', 'Firebase'],
                  ['supabase', 'Supabase'],
                  ['custom', isRTL ? 'مخصص لاحقًا' : 'Custom later'],
                ] as [InfraType, string][]
              ).map(([value, label]) => {
                const isActive = infraType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setInfraType(value)}
                    className={[
                      'rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide transition',
                      'text-slate-50 shadow-[0_0_12px_rgba(255,255,255,0.15)]',
                      'bg-slate-950/40',
                      isActive
                        ? 'border-sky-400/80 shadow-[0_0_20px_rgba(56,189,248,0.5)]'
                        : 'border-slate-500/70 hover:border-sky-400/80 hover:shadow-[0_0_18px_rgba(56,189,248,0.3)]',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Step 4: Preview URL (Phase 97.1) */}
          <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-6 backdrop-blur">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-slate-100 mb-1">
                {isRTL ? '٤ — رابط المعاينة' : '4 — Preview URL'}
              </h2>
              <p className="text-xs text-slate-400">
                {isRTL
                  ? 'رابط المعاينة المباشرة للتطبيق (يظهر في لوحة الأجهزة).'
                  : 'Live preview URL for the app (shown in Device Preview pane).'}
              </p>
            </div>
            <ProjectPreviewSettingsCard
              projectId={projectId}
              locale={isRTL ? 'ar' : 'en'}
            />
          </section>

          {/* Submit */}
          <div className={isRTL ? 'text-left' : 'text-right'}>
            <button
              type="submit"
              disabled={saving}
              className={[
                'inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium',
                'bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-60 disabled:cursor-not-allowed',
                'text-white shadow-[0_0_25px_rgba(236,72,153,0.7)]',
              ].join(' ')}
            >
              {saving ? t.savingButton : t.saveButton}
            </button>
          </div>
        </form>
      </div>
    </F0Shell>
  );
}
