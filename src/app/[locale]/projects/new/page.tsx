'use client';

import { useState, FormEvent, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import F0Shell from '@/components/f0/F0Shell';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import type { MarketplaceApp } from '@/types/marketplace';

type AppType = 'web' | 'mobile' | 'desktop';
type InfraType = 'firebase' | 'supabase' | 'custom';
type MobileTarget = 'ios' | 'android';
type DesktopTarget = 'mac' | 'windows' | 'linux';

function NewProjectContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'en';
  const isRTL = locale === 'ar';

  // Phase 98.2: Get template slug from query param
  const templateSlug = searchParams?.get('template') || null;

  const [name, setName] = useState('');
  const [appTypes, setAppTypes] = useState<AppType[]>(['web']);
  const [mobileTargets, setMobileTargets] = useState<MobileTarget[]>([]);
  const [desktopTargets, setDesktopTargets] = useState<DesktopTarget[]>([]);
  const [infraType, setInfraType] = useState<InfraType>('firebase');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 98.2: Template state
  const [templateData, setTemplateData] = useState<MarketplaceApp | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(!!templateSlug);

  // Phase 98.2: Load template data from Firestore
  useEffect(() => {
    if (!templateSlug) return;

    async function loadTemplate() {
      try {
        console.log('[NewProject] Loading template:', templateSlug);
        const docRef = doc(db, 'ops_marketplace_apps', templateSlug);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
          const data = { slug: snapshot.id, ...snapshot.data() } as MarketplaceApp;
          console.log('[NewProject] Template loaded:', data.title);
          setTemplateData(data);

          // Pre-fill form with template data
          setName(isRTL ? data.titleAr : data.title);

          // Map platforms to app types (MarketplacePlatform: web, mobile, desktop, api)
          const newAppTypes: AppType[] = [];
          if (data.platforms.includes('web') || data.platforms.includes('api')) newAppTypes.push('web');
          if (data.platforms.includes('mobile')) {
            newAppTypes.push('mobile');
            // Default to both iOS and Android for mobile templates
            setMobileTargets(['ios', 'android']);
          }
          if (data.platforms.includes('desktop')) {
            newAppTypes.push('desktop');
            // Default to Mac for desktop templates
            setDesktopTargets(['mac']);
          }
          if (newAppTypes.length === 0) newAppTypes.push('web');
          setAppTypes(newAppTypes);
        } else {
          console.warn('[NewProject] Template not found:', templateSlug);
        }
      } catch (err) {
        console.error('[NewProject] Error loading template:', err);
      } finally {
        setLoadingTemplate(false);
      }
    }

    loadTemplate();
  }, [templateSlug, isRTL]);

  const toggleAppType = (value: AppType) => {
    setAppTypes((prev) => {
      const exists = prev.includes(value);
      let next: AppType[];

      if (exists) {
        next = prev.filter((v) => v !== value);
      } else {
        next = [...prev, value];
      }

      // ما نخليش الليست فاضية خالص
      if (next.length === 0) next = ['web'];

      // لو شيلنا mobile / desktop نمسح التارجتس بتاعتها
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

  const t = {
    title: isRTL ? 'بدء مشروع جديد' : 'Start New Project',
    subtitle: isRTL
      ? 'أنشئ مساحة عمل جديدة مع F0 Agent، ثم اربطها بالبنية التحتية المفضّلة لديك.'
      : 'Create a fresh F0 workspace, then link it to your preferred infrastructure.',
    basicInfoTitle: isRTL ? '١ — بيانات أساسية' : '1 — Basic information',
    nameLabel: isRTL ? 'اسم المشروع' : 'Project name',
    namePlaceholder: isRTL ? 'مثال: منصة توصيل، متجر إلكتروني...' : 'e.g. Delivery App, Marketplace...',
    appTypeTitle: isRTL ? '٢ — نوع التطبيق' : '2 — App type',
    appTypeHint: isRTL
      ? 'يمكنك تغيير نوع التطبيق لاحقًا من إعدادات المشروع.'
      : 'You can change the app type later from project settings.',
    infraTitle: isRTL ? '٣ — البنية التحتية' : '3 — Infrastructure',
    infraHint: isRTL
      ? 'في النسخة الحالية سيتم استخدام الإعدادات الافتراضية لـ Firebase.'
      : 'For now we will use default Firebase settings.',
    createButton: isRTL ? 'إنشاء المشروع' : 'Create project',
    creatingButton: isRTL ? 'جارٍ إنشاء المشروع...' : 'Creating project...',
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

    // Validate mobile targets
    if (appTypes.includes('mobile') && mobileTargets.length === 0) {
      setError(
        isRTL
          ? 'من فضلك اختر منصة واحدة على الأقل للموبايل (iOS أو Android).'
          : 'Please select at least one mobile platform (iOS or Android).'
      );
      return;
    }

    // Validate desktop targets
    if (appTypes.includes('desktop') && desktopTargets.length === 0) {
      setError(
        isRTL
          ? 'من فضلك اختر منصة واحدة على الأقل للديسكتوب (Mac، Windows، أو Linux).'
          : 'Please select at least one desktop platform (Mac, Windows, or Linux).'
      );
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setError(
        isRTL
          ? 'يجب تسجيل الدخول أولاً قبل إنشاء مشروع.'
          : 'You must be signed in before creating a project.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const now = Date.now();
      const primaryAppType: AppType = appTypes[0] ?? 'web';

      // Phase 98.2: Include template data if coming from marketplace
      const templateInfo = templateData ? {
        templateSlug: templateData.slug,
        templateTitle: templateData.title,
        templateCategory: templateData.category,
        templateTechStack: templateData.techStack,
        templateDescription: templateData.shortDescription,
        // Store the full template plan for the AI agent
        templatePlan: templateData.fullDescription || templateData.shortDescription,
      } : {};

      const docRef = await addDoc(collection(db, 'ops_projects'), {
        ownerUid: user.uid,
        name: name.trim(),
        slug,
        appTypes,                          // array: ['web','mobile']
        appType: primaryAppType,           // backward-compat
        type: primaryAppType,              // backward-compat
        mobileTargets: appTypes.includes('mobile') ? mobileTargets : [],
        desktopTargets: appTypes.includes('desktop') ? desktopTargets : [],
        infraType,
        // Phase 98.2: Template data
        ...templateInfo,
        infrastructure: infraType,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        lastUpdatedAt: now,
        lastSessionAt: null,
        deployCount: 0,
        liveSessionsCount: 0,
        agentTasksCount: 0,
      });

      console.log('✅ Project created:', docRef.id);

      // بعد الإنشاء نروح على صفحة المشروع مباشرة
      router.push(`/${locale}/projects/${docRef.id}`);
    } catch (err) {
      console.error('❌ Failed to create project:', err);
      setError(
        isRTL
          ? 'حدث خطأ أثناء إنشاء المشروع. تأكد من تشغيل Firebase Emulators وحاول مرة أخرى.'
          : 'Failed to create project. Make sure Firebase Emulators are running and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // Phase 98.2: Show loading while fetching template
  if (loadingTemplate) {
    return (
      <F0Shell>
        <div className="max-w-3xl mx-auto py-20 text-center">
          <div className="animate-pulse">
            <div className="h-8 w-48 mx-auto bg-slate-700 rounded mb-4" />
            <div className="h-4 w-64 mx-auto bg-slate-800 rounded" />
          </div>
          <p className="text-slate-400 mt-4">
            {isRTL ? 'جارٍ تحميل قالب المشروع...' : 'Loading project template...'}
          </p>
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
        {/* Phase 98.2: Template Banner */}
        {templateData && (
          <div className="mb-6 bg-gradient-to-r from-fuchsia-900/50 to-purple-900/50 border border-fuchsia-500/40 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <span className="text-3xl">{templateData.icon}</span>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wider text-fuchsia-300 mb-1">
                  {isRTL ? 'إنشاء من قالب Marketplace' : 'Creating from Marketplace Template'}
                </p>
                <h2 className="text-lg font-semibold text-white">
                  {isRTL ? templateData.titleAr : templateData.title}
                </h2>
                <p className="text-sm text-slate-300 mt-1">
                  {isRTL ? templateData.shortDescriptionAr : templateData.shortDescription}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {templateData.techStack.slice(0, 5).map((tech) => (
                    <span key={tech} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="space-y-3 mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
            F0 Panel · {isRTL ? 'مشروع جديد' : 'New Project'}
          </p>
          <h1 className="text-2xl font-semibold text-white">{t.title}</h1>
          <p className="text-sm text-slate-400">{t.subtitle}</p>
        </div>

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
                placeholder={t.namePlaceholder}
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

          {/* Error */}
          {error && (
            <div className="text-xs text-red-400 bg-red-950/40 border border-red-500/40 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className={isRTL ? 'text-left' : 'text-right'}>
            <button
              type="submit"
              disabled={isSubmitting}
              className={[
                'inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium',
                'bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-60 disabled:cursor-not-allowed',
                'text-white shadow-[0_0_25px_rgba(236,72,153,0.7)]',
              ].join(' ')}
            >
              {isSubmitting ? t.creatingButton : t.createButton}
            </button>
          </div>
        </form>
      </div>
    </F0Shell>
  );
}

// Loading fallback for Suspense boundary
function NewProjectLoading() {
  return (
    <F0Shell>
      <div className="max-w-3xl mx-auto py-20 text-center">
        <div className="animate-pulse">
          <div className="h-8 w-48 mx-auto bg-slate-700 rounded mb-4" />
          <div className="h-4 w-64 mx-auto bg-slate-800 rounded" />
        </div>
        <p className="text-slate-400 mt-4">Loading...</p>
      </div>
    </F0Shell>
  );
}

// Main page component with Suspense boundary
export default function NewProjectPage() {
  return (
    <Suspense fallback={<NewProjectLoading />}>
      <NewProjectContent />
    </Suspense>
  );
}
