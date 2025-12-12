'use client';

import Link from 'next/link';

type AgentPanelProps = {
  locale: string;
  projectId: string;
  project: any;
};

export default function AgentPanel({ locale, projectId, project }: AgentPanelProps) {
  const isRTL = locale === 'ar';
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);

  const baseAgentUrl = `/${locale}/agent?projectId=${encodeURIComponent(projectId)}`;

  return (
    <section className="mt-4 rounded-2xl border border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-700/35 via-purple-800/40 to-sky-600/35 p-1 shadow-[0_0_45px_rgba(236,72,153,0.7)]">
      <div
        className={`rounded-2xl bg-slate-950/85 px-4 md:px-6 py-4 md:py-5 ${
          isRTL ? 'text-right' : 'text-left'
        }`}
      >
        {/* Header */}
        <div
          className={`flex flex-col gap-3 md:flex-row md:items-center md:justify-between ${
            isRTL ? 'md:flex-row-reverse' : ''
          }`}
        >
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.22em] text-fuchsia-200/80">
              {t('Work with F0 Agent', 'العمل مع وكيل F0')}
            </p>
            <p className="text-xs text-slate-300 max-w-xl">
              {t(
                'Let the agent plan, generate, review code, and manage this project automatically.',
                'اسمح للوكيل بالتخطيط، وتوليد الكود، ومراجعته، وإدارة هذا المشروع بشكل تلقائي.'
              )}
            </p>

            <div
              className={`mt-1 flex flex-wrap items-center gap-2 text-[11px] ${
                isRTL ? 'flex-row-reverse' : ''
              }`}
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t('Agent workspace: ready', 'مساحة عمل الوكيل: جاهزة')}
              </span>
              <span className="text-slate-400">
                {t(
                  'Project context is linked and can be used in prompts.',
                  'سياق المشروع مرتبط ويمكن استخدامه داخل طلباتك للوكيل.'
                )}
              </span>
            </div>
          </div>

          <div className={isRTL ? 'md:self-start' : 'md:self-start'}>
            <Link
              href={`${baseAgentUrl}&intent=continue`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_0_26px_rgba(56,189,248,0.9)] hover:brightness-110 transition"
            >
              {t('Continue with Agent', 'المتابعة مع الوكيل')}
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-4 h-px w-full bg-gradient-to-r from-fuchsia-500/30 via-slate-600/40 to-sky-400/30" />

        {/* Agent shortcuts */}
        <div className="mt-4">
          <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-slate-400">
            {t('Quick agent actions', 'إجراءات سريعة للوكيل')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Generate PRD */}
            <Link
              href={`${baseAgentUrl}&intent=generate-prd`}
              className="group rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3 text-xs text-slate-200 hover:border-fuchsia-400/70 hover:bg-slate-900/90 hover:shadow-[0_0_26px_rgba(236,72,153,0.6)] transition"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">
                  {t('Generate PRD', 'توليد مستند المتطلبات PRD')}
                </span>
                <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] text-fuchsia-100">
                  {t('Docs', 'مستند')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 group-hover:text-slate-200">
                {t(
                  'Ask the agent to create a complete product requirements document for this project.',
                  'اطلب من الوكيل إنشاء مستند متكامل لمتطلبات هذا المشروع.'
                )}
              </p>
            </Link>

            {/* Plan Task Board */}
            <Link
              href={`${baseAgentUrl}&intent=plan-board`}
              className="group rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3 text-xs text-slate-200 hover:border-sky-400/70 hover:bg-slate-900/90 hover:shadow-[0_0_26px_rgba(56,189,248,0.6)] transition"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">
                  {t('Plan task board', 'تخطيط لوحة مهام')}
                </span>
                <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-100">
                  {t('Tasks', 'مهام')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 group-hover:text-slate-200">
                {t(
                  'Let the agent break the project into phases and tasks ready for execution.',
                  'دع الوكيل يقسم المشروع إلى مراحل ومهام جاهزة للتنفيذ.'
                )}
              </p>
            </Link>

            {/* Design API & DB */}
            <Link
              href={`${baseAgentUrl}&intent=design-api-db`}
              className="group rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3 text-xs text-slate-200 hover:border-violet-400/70 hover:bg-slate-900/90 hover:shadow-[0_0_26px_rgba(129,140,248,0.7)] transition"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">
                  {t('Design API & DB', 'تصميم الـ API وقاعدة البيانات')}
                </span>
                <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] text-violet-100">
                  {t('Schema', 'مخطط')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 group-hover:text-slate-200">
                {t(
                  'Ask the agent to propose REST/Firestore schema and main endpoints for this app.',
                  'اطلب من الوكيل اقتراح مخطط Firestore/REST ونقاط النهاية الأساسية للتطبيق.'
                )}
              </p>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
