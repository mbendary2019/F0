'use client';

import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useLiveSessionsStats } from '@/hooks/useLiveSessionsStats';
import { useAiActivity } from '@/hooks/useAiActivity';

export default function DashboardPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'en';

  const { loading, user, totalProjects, projectsDelta, deployments, tokens, plan } = useDashboardStats();
  const { activeCount: liveSessions, delta: liveSessionsDelta } = useLiveSessionsStats();
  const aiActivityText = useAiActivity();

  // 🎚️ Token limits based on plan
  const tokenLimits = {
    starter: 1000,
    pro: 10000,
    ultimate: 100000,
  };
  const tokenLimit = tokenLimits[plan] || 1000;
  const tokenProgress = Math.min(100, (tokens / tokenLimit) * 100);

  // Redirect if not authenticated
  if (!loading && !user) {
    router.push(`/${locale}/auth`);
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="h-full w-full overflow-y-auto bg-gradient-to-b from-[#0b0118] to-[#040c2c] text-white px-4 sm:px-8 lg:px-10 xl:px-14 py-10">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="bg-gradient-to-r from-purple-700/80 to-indigo-700/80 rounded-2xl px-8 py-5 shadow-xl border border-white/10 animate-pulse">
            <div className="h-6 w-48 bg-white/20 rounded mb-2" />
            <div className="h-4 w-96 bg-white/10 rounded" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white/5 rounded-2xl px-6 py-4 border border-white/10 shadow-lg animate-pulse"
              >
                <div className="h-3 w-32 bg-white/15 rounded mb-3" />
                <div className="h-8 w-16 bg-white/25 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-gradient-to-b from-[#0b0118] to-[#040c2c] text-white px-4 sm:px-8 lg:px-10 xl:px-14 py-10">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* شريط الترحيب - نسخة ٢٤ الفجر */}
        <div className="bg-gradient-to-r from-purple-700/80 to-indigo-700/80 rounded-2xl px-8 py-5 shadow-xl border border-white/10">
          <h1 className="text-lg md:text-xl font-semibold flex items-center gap-2 text-white">
            👋 Welcome back, <span className="font-bold">Developer</span>
          </h1>
          <p className="text-xs md:text-sm text-white/80 mt-1">
            Manage your projects, AI sessions, tokens, and deployments — all from one unified F0 workspace.
          </p>
        </div>

        {/* كروت الإحصائيات الرئيسية */}
        <div className="space-y-4">
          {/* إجمالي المشاريع */}
          <div className="bg-white/5 rounded-2xl px-6 py-4 border border-white/10 shadow-lg text-white">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/60">
                  TOTAL PROJECTS
                </p>
                <p className="text-3xl font-bold mt-1 text-white">
                  {totalProjects}
                </p>

                <p className="text-xs mt-1 text-emerald-300/90">
                  +{projectsDelta} this week
                </p>
              </div>
            </div>
          </div>

          {/* جلسات Live Coding */}
          <div className="bg-white/5 rounded-2xl px-6 py-4 border border-white/10 shadow-lg text-white">
            <p className="text-[11px] uppercase tracking-wide text-white/60">
              LIVE CODING SESSIONS
            </p>
            <p className="text-3xl font-bold mt-1 text-white">{liveSessions}</p>
            <p className="text-xs mt-1 text-emerald-300/90">
              +{liveSessionsDelta} this week
            </p>
          </div>

          {/* الديبلويمِنتس */}
          <div className="bg-white/5 rounded-2xl px-6 py-4 border border-white/10 shadow-lg text-white">
            <p className="text-[11px] uppercase tracking-wide text-white/60">
              DEPLOYMENTS
            </p>
            <p className="text-3xl font-bold mt-1 text-white">
              {deployments}
            </p>
            <p className="text-xs mt-1 text-white/70">
              Across all projects
            </p>
          </div>

          {/* FZ Tokens + البار */}
          <div className="bg-white/5 rounded-2xl px-6 py-5 border border-white/10 shadow-lg text-white">
            <p className="text-[11px] uppercase tracking-wide text-white/60">
              FZ TOKENS
            </p>

            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold text-white">{tokens}</p>
                <p className="text-xs text-white/70 mt-1">
                  Balance snapshot · Free tier
                </p>
                {user && (
                  <p className="text-[11px] text-white/50">
                    Email: {user.email}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                {/* progress bar ديناميكي حسب رصيد التوكنز الفعلي */}
                <div className="w-56 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500"
                    style={{
                      width: `${tokenProgress}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-white/60">
                  Current plan:{' '}
                  <span className="font-semibold capitalize">
                    {plan === "starter" ? "Starter - Free" : plan === "pro" ? "Pro - $29 / mo" : "Ultimate - $99 / mo"}
                  </span>
                  {' '}
                  <span className="text-white/50">
                    ({tokens.toLocaleString()}/{tokenLimit.toLocaleString()} FZ)
                  </span>
                </p>
                <div className="flex gap-2">
                  <Link
                    href="/f0/wallet"
                    className="px-4 py-1.5 rounded-full text-xs font-medium bg-pink-500 text-white hover:opacity-90 transition"
                  >
                    Open wallet
                  </Link>

                  <Link
                    href={`/${locale}/pricing`}
                    className="px-4 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white hover:bg-white/20 transition"
                  >
                    View plans
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* نشاط الـ AI */}
        <div className="bg-gradient-to-r from-purple-500/40 to-blue-500/40 rounded-2xl px-6 py-5 border border-white/10 shadow-xl text-white">
          <h2 className="text-sm font-semibold mb-1 text-white">
            AI Activity &amp; Suggestions
          </h2>
          <p className="text-sm text-white/85 mb-4 leading-relaxed">
            {aiActivityText || 'Your AI Agent is ready to help with your next task.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/f0/live"
              className="px-5 py-2 rounded-full bg-pink-500 text-sm font-medium text-white hover:opacity-90 transition"
            >
              Start Live Session
            </Link>
            <Link
              href="/f0/tools/logs"
              className="px-5 py-2 rounded-full bg-white/10 text-sm font-medium text-white hover:bg-white/20 transition"
            >
              View AI Logs
            </Link>
          </div>
        </div>

        {/* الكويك أكشنز تحت */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-white/5 rounded-2xl px-5 py-4 border border-white/10 text-white/90">
            <p className="text-xs font-semibold mb-1">
              Create a fresh workspace
            </p>
            <p className="text-[11px] text-white/65 mb-2">
              Start a brand-new project with F0 Agent from scratch.
            </p>
            <Link
              href="/f0/projects/new"
              className="text-[11px] text-pink-300 underline underline-offset-2"
            >
              Start new project →
            </Link>
          </div>

          <div className="bg-white/5 rounded-2xl px-5 py-4 border border-white/10 text-white/90">
            <p className="text-xs font-semibold mb-1">
              Continue where you left off
            </p>
            <p className="text-[11px] text-white/65 mb-2">
              Jump back into your existing apps and sessions.
            </p>
            <Link
              href="/f0/projects"
              className="text-[11px] text-pink-300 underline underline-offset-2"
            >
              Open existing project →
            </Link>
          </div>

          <div className="bg-white/5 rounded-2xl px-5 py-4 border border-white/10 text-white/90">
            <p className="text-xs font-semibold mb-1">
              Start live coding session
            </p>
            <p className="text-[11px] text-white/65 mb-2">
              Pair with F0 Agent inside your IDE in real time.
            </p>
            <Link
              href="/f0/live"
              className="text-[11px] text-pink-300 underline underline-offset-2"
            >
              Start live session →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
