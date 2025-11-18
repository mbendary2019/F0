// src/app/[locale]/page.tsx
'use client';
import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';
import { useProjects } from '@/features/projects/useProjects';
import { ProjectCard } from '@/features/projects/ProjectCard';
import { isMockMode } from '@/lib/mock';

export default function Home() {
  const locale = useLocale();
  const t = useTranslations();
  const { projects, loading, error } = useProjects();

  return (
    <main className="min-h-dvh flex items-center justify-center p-8">
      <div className="max-w-3xl w-full space-y-6">
        <h1 className="text-3xl font-semibold">{t('home.title')}</h1>
        <p className="text-muted-foreground">
          {t('home.subtitle')}
        </p>
        {isMockMode() && (
          <p className="text-sm text-neutral-400 bg-neutral-900/50 rounded-lg px-3 py-2">
            Mock Mode is ON — البيانات الحالية تجريبية لحين ربط Firestore.
          </p>
        )}

        {/* زر تسجيل الدخول */}
        <div className="flex">
          <Link
            href={`/${locale}/login`}
            className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium hover:shadow transition-shadow"
          >
            {t('home.loginCta')}
          </Link>
        </div>

        {/* Projects Section */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Your Projects</h2>

          {loading && <div className="text-sm text-neutral-400">Loading…</div>}
          {error && (
            <div className="text-sm text-red-500">Failed to load projects.</div>
          )}

          <div className="grid gap-3 md:grid-cols-3 mb-6">
            {projects.map((p) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-4">
          <Link href={`/${locale}/developers`} className="rounded-2xl border p-4 hover:shadow">
            <h3 className="font-medium">{t('nav.developers')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('nav.developers_desc')}
            </p>
          </Link>

          <Link href={`/${locale}/developers/billing`} className="rounded-2xl border p-4 hover:shadow">
            <h3 className="font-medium">{t('nav.billing')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('nav.billing_desc')}
            </p>
          </Link>

          <Link href={`/${locale}/ops/analytics`} className="rounded-2xl border p-4 hover:shadow">
            <h3 className="font-medium">{t('nav.opsAnalytics')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('nav.opsAnalytics_desc')}
            </p>
          </Link>

          <Link href={`/${locale}/ops/audit`} className="rounded-2xl border p-4 hover:shadow">
            <h3 className="font-medium">{t('nav.audit')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('nav.audit_desc')}
            </p>
          </Link>

          <Link href={`/${locale}/f0`} className="rounded-2xl border p-4 hover:shadow col-span-full">
            <h3 className="font-medium">{t('f0.title')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('f0.subtitle')}
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
