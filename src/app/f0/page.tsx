// src/app/f0/page.tsx
import Link from "next/link";
import F0QuickActions from "@/components/F0QuickActions";
import AuthStatus from "@/components/AuthStatus";
import SeedButton from "@/components/SeedButton";

// Force dynamic rendering (uses fetch with no-store)
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export default async function F0Home() {
  const status = await getOrchestratorStatus();

  return (
    <main className="min-h-dvh p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">F0 — Orchestrator Control</h1>
          <p className="text-muted-foreground">
            نقطة البداية السريعة — حالة السيرفر وروابط التشغيل للمطورين والـ Ops.
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
              <h2 className="text-lg font-medium">Orchestrator</h2>
              <p className="text-sm text-muted-foreground">{ORCH_URL}</p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm ${
                status.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}
              title={status.ok ? "Healthy" : "Unreachable"}
            >
              {status.ok ? "Healthy" : "Unreachable"}
            </span>
          </div>

          <div className="mt-4 text-sm">
            {status.ok ? (
              <pre className="overflow-auto rounded-lg border bg-black/5 p-3">
                {JSON.stringify(status.json, null, 2)}
              </pre>
            ) : (
              <div className="rounded-lg border bg-red-50 p-3 text-red-800">
                فشل التحقق من الصحة: {status.error}
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <a className="underline" href={`${ORCH_URL}/health`} target="_blank" rel="noreferrer">
              افتح /health
            </a>
            <a className="underline" href={`${ORCH_URL}/version`} target="_blank" rel="noreferrer">
              افتح /version
            </a>
          </div>

          {/* زر اختبار اتصال فوري */}
          <F0QuickActions orchUrl={ORCH_URL} />
        </section>

        {/* روابط سريعة */}
        <section className="grid gap-4 md:grid-cols-2">
          <Link href="/ops/analytics" className="rounded-2xl border p-5 hover:shadow">
            <h3 className="font-medium">Ops Analytics</h3>
            <p className="text-sm text-muted-foreground">لوحة مؤشرات التشغيل و KPIs</p>
          </Link>
          <Link href="/ops/audit" className="rounded-2xl border p-5 hover:shadow">
            <h3 className="font-medium">Audit Trail</h3>
            <p className="text-sm text-muted-foreground">سجل الأحداث والفلترة والتصدير</p>
          </Link>
          <Link href="/developers" className="rounded-2xl border p-5 hover:shadow">
            <h3 className="font-medium">Developers</h3>
            <p className="text-sm text-muted-foreground">لوحة المطورين وواجهات API</p>
          </Link>
          <Link href="/developers/billing" className="rounded-2xl border p-5 hover:shadow">
            <h3 className="font-medium">Billing</h3>
            <p className="text-sm text-muted-foreground">الاشتراك والدفع وإدارة الخطة</p>
          </Link>
        </section>

        <div className="pt-4 border-t">
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← العودة للصفحة الرئيسية
          </a>
        </div>
      </div>
    </main>
  );
}
