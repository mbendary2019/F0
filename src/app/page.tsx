// src/app/page.tsx
export default function Home() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-8">
      <div className="max-w-3xl w-full space-y-6">
        <h1 className="text-3xl font-semibold">From Zero — F0</h1>
        <p className="text-muted-foreground">
          أهلاً! هذه هي الصفحة الرئيسية. اختر إلى أين تريد الذهاب:
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <a href="/developers" className="rounded-2xl border p-4 hover:shadow">
            <h3 className="font-medium">Developers</h3>
            <p className="text-sm text-muted-foreground">لوحة المطورين وواجهات API</p>
          </a>

          <a href="/developers/billing" className="rounded-2xl border p-4 hover:shadow">
            <h3 className="font-medium">Billing</h3>
            <p className="text-sm text-muted-foreground">الاشتراك والدفع</p>
          </a>

          <a href="/ops/analytics" className="rounded-2xl border p-4 hover:shadow">
            <h3 className="font-medium">Ops Analytics</h3>
            <p className="text-sm text-muted-foreground">لوحة مؤشرات التشغيل</p>
          </a>

          <a href="/ops/audit" className="rounded-2xl border p-4 hover:shadow">
            <h3 className="font-medium">Audit Trail</h3>
            <p className="text-sm text-muted-foreground">سجل الأحداث</p>
          </a>
        </div>
      </div>
    </main>
  );
}
