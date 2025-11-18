// src/app/[locale]/f0/page.tsx
import Link from "next/link";
import {useTranslations} from 'next-intl';
import {getTranslations} from 'next-intl/server';
import F0QuickActions from "@/components/F0QuickActions";
import AuthStatus from "@/components/AuthStatus";
import SeedButton from "@/components/SeedButton";

const ORCH_URL = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || "http://localhost:9090";

async function getOrchestratorStatus() {
  try {
    const res = await fetch(`${ORCH_URL}/health`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return { ok: true, json };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Unknown error" };
  }
}

export default async function F0Home({
  params: {locale}
}: {
  params: {locale: 'ar' | 'en'};
}) {
  const status = await getOrchestratorStatus();
  const t = await getTranslations({locale});

  return (
    <main className="min-h-dvh p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">{t('f0.title')}</h1>
          <p className="text-muted-foreground">
            {t('f0.subtitle')}
          </p>
        </header>

        {/* Auth Status */}
        <AuthStatus />

        {/* Data Seeder (Admin Only) */}
        <SeedButton orchUrl={ORCH_URL} />

        {/* حالة الأوركستريتور */}
        <section className="rounded-2xl border p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">{t('f0.orchestrator')}</h2>
              <p className="text-sm text-muted-foreground">{ORCH_URL}</p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm ${
                status.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}
              title={status.ok ? t('f0.health.healthy') : t('f0.health.unreachable')}
            >
              {status.ok ? t('f0.health.healthy') : t('f0.health.unreachable')}
            </span>
          </div>

          <div className="mt-4 text-sm">
            {status.ok ? (
              <pre className="overflow-auto rounded-lg border bg-black/5 p-3">
                {JSON.stringify(status.json, null, 2)}
              </pre>
            ) : (
              <div className="rounded-lg border bg-red-50 p-3 text-red-800">
                {t('f0.health.failed')}: {status.error}
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <a className="underline" href={`${ORCH_URL}/health`} target="_blank" rel="noreferrer">
              {t('f0.openHealth')}
            </a>
            <a className="underline" href={`${ORCH_URL}/version`} target="_blank" rel="noreferrer">
              {t('f0.openVersion')}
            </a>
          </div>

          {/* زر اختبار اتصال فوري */}
          <F0QuickActions orchUrl={ORCH_URL} />
        </section>

        {/* روابط سريعة */}
        <section className="grid gap-4 md:grid-cols-2">
          <Link href={`/${locale}/ops/analytics`} className="rounded-2xl border p-5 hover:shadow">
            <h3 className="font-medium">{t('nav.opsAnalytics')}</h3>
            <p className="text-sm text-muted-foreground">{t('nav.opsAnalytics_desc')}</p>
          </Link>
          <Link href={`/${locale}/ops/audit`} className="rounded-2xl border p-5 hover:shadow">
            <h3 className="font-medium">{t('nav.audit')}</h3>
            <p className="text-sm text-muted-foreground">{t('nav.audit_desc')}</p>
          </Link>
          <Link href={`/${locale}/developers`} className="rounded-2xl border p-5 hover:shadow">
            <h3 className="font-medium">{t('nav.developers')}</h3>
            <p className="text-sm text-muted-foreground">{t('nav.developers_desc')}</p>
          </Link>
          <Link href={`/${locale}/developers/billing`} className="rounded-2xl border p-5 hover:shadow">
            <h3 className="font-medium">{t('nav.billing')}</h3>
            <p className="text-sm text-muted-foreground">{t('nav.billing_desc')}</p>
          </Link>
        </section>

        <div className="pt-4 border-t">
          <Link href={`/${locale}`} className="text-sm text-muted-foreground hover:text-foreground">
            {t('common.backToHome')}
          </Link>
        </div>
      </div>
    </main>
  );
}
