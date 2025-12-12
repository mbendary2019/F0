'use client';

import Link from "next/link";
import { useParams } from "next/navigation";
import Image from "next/image";

export default function LandingPage() {
  const params = useParams();
  const locale = params?.locale as string || 'en';

  return (
    <main className="min-h-screen f0-lightning-bg relative overflow-hidden">
      {/* Overlay خفيف عشان يبان النص */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 pointer-events-none" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 lg:flex-row lg:justify-between lg:px-10">
        {/* الماسكوت */}
        <div className="mb-10 flex flex-1 items-center justify-center lg:mb-0">
          <div className="rounded-full bg-purple-500/10 p-6 backdrop-blur">
            <Image
              src="/mascots/f0-mascot-login.gif"
              alt="F0 Mascot"
              width={420}
              height={420}
              className="max-w-[60vw] animate-[float_6s_ease-in-out_infinite] drop-shadow-[0_0_45px_rgba(129,140,248,0.7)]"
            />
          </div>
        </div>

        {/* الـ Hero Text + الأزرار */}
        <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left space-y-6">
          <div className="inline-flex items-center rounded-full bg-black/40 px-4 py-1 text-xs font-medium text-slate-200 shadow-lg shadow-purple-800/30 border border-white/5 mb-2">
            From Zero → Production • AI Coding Workspace
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white tracking-tight">
            Build <span className="text-fuchsia-300">full apps</span>
            <br className="hidden sm:block" />
            with <span className="text-sky-300">F0 Agent</span> in minutes.
          </h1>

          <p className="max-w-xl text-sm sm:text-base text-slate-200/80 leading-relaxed">
            Start a new project, chat with your AI agent, and deploy to the cloud —
            all from one unified dashboard with live coding sessions.
          </p>

          {/* الأزرار الأساسية */}
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/${locale}/auth`}
              className="inline-flex items-center justify-center rounded-full px-7 py-3 text-sm font-semibold text-white shadow-[0_0_25px_rgba(168,85,247,0.7)]
                         bg-gradient-to-r from-fuchsia-500 via-purple-500 to-sky-400 hover:opacity-95 hover:-translate-y-[1px]
                         transition-transform transition-opacity duration-200"
            >
              🚀 Start New Project
            </Link>

            <Link
              href={`/${locale}/pricing`}
              className="inline-flex items-center justify-center rounded-full px-7 py-3 text-sm font-semibold
                         border border-white/15 bg-black/40 text-slate-100 hover:border-white/30 hover:bg-black/60
                         transition-colors duration-200"
            >
              💎 View Plans & Pricing
            </Link>
          </div>

          {/* Info صغيرة تحت الأزرار */}
          <p className="text-xs text-slate-300/70 mt-3">
            No credit card required • Free tier available • Arabic & English support
          </p>
        </div>
      </div>

      {/* Floating animation */}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
      `}</style>
    </main>
  );
}
