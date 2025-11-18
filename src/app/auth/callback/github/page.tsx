'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function GithubCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    // لو مفيش code نرجع المستخدم لصفحة الإعدادات مع رسالة خطأ بسيطة
    if (!code) {
      router.replace('/settings/integrations?error=missing_github_code');
      return;
    }

    const run = async () => {
      try {
        // هنا نكلّم API عندك اللي بيكمّل الربط مع GitHub
        // عدّل الـ endpoint لو انت مسميه حاجة تانية
        const res = await fetch('/api/auth/github', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, state }),
        });

        if (!res.ok) {
          throw new Error('GitHub auth failed');
        }

        // لو كله تمام نرجّع المستخدم مثلاً لصفحة الإعدادات
        router.replace('/settings/integrations?connected=github');
      } catch (err) {
        console.error('[GitHub Callback] Error:', err);
        router.replace('/settings/integrations?error=github_callback_failed');
      }
    };

    run();
  }, [searchParams, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Connecting your GitHub…</h1>
        <p className="text-sm text-muted-foreground">
          Please wait while we complete the authentication.
        </p>
      </div>
    </main>
  );
}

export default function GithubCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Loading GitHub callback…
          </p>
        </main>
      }
    >
      <GithubCallbackInner />
    </Suspense>
  );
}
