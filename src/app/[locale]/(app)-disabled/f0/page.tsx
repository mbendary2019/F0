/**
 * Phase 80: Neon UI - Dashboard Page (Refactored)
 * F0 Home with Neon component library
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { NeonPageShell } from "@/components/neon/NeonPageShell";
import { NeonButton } from "@/components/neon/NeonButton";
import { NeonCard } from "@/components/neon/NeonCard";
import { NeonBadge } from "@/components/neon/NeonBadge";

type ProjectSummary = {
  id: string;
  name: string;
  shortDescription?: string;
  status?: "active" | "archived";
};

type Props = {
  params: { locale: string };
};

export default function F0DashboardPage({ params }: Props) {
  const { locale } = params;
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/projects", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load projects");
        const data = await res.json();
        setProjects((data.projects || []).slice(0, 3));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  const projectsHref = `/${locale}/projects`;
  const billingHref = `/${locale}/billing`;
  const integrationsHref = `/${locale}/integrations`;

  return (
    <NeonPageShell
      title="Welcome back to F0"
      subtitle="Manage your AI-driven projects, open the Web IDE, launch live coding sessions, and connect integrations — all from one place."
    >
      {/* Top actions + mascot */}
      <section className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link href={projectsHref}>
              <NeonButton size="lg">Start New Project</NeonButton>
            </Link>
            <Link href={billingHref}>
              <NeonButton variant="secondary" size="lg">
                View plan &amp; usage
              </NeonButton>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <NeonBadge tone="success">AI workspace</NeonBadge>
            <span>Desktop IDE • Web IDE • Mobile</span>
          </div>
        </div>

        {/* Mascot card على اليمين */}
        <div className="mt-4 w-full max-w-xs md:mt-0">
          <NeonCard
            tone="accent"
            title="F0 Assistant"
            subtitle="Your multi-agent co-developer."
          >
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 flex-shrink-0 rounded-xl bg-gradient-to-br from-[#7F5CFF] to-[#5CA8FF] flex items-center justify-center text-2xl drop-shadow-[0_0_18px_rgba(127,92,255,0.8)]">
                🤖
              </div>
              <p className="text-xs text-slate-200">
                Ask the agent to plan phases, generate tasks, or refactor your
                current project. The same brain works in Desktop, Web, and
                Mobile.
              </p>
            </div>
          </NeonCard>
        </div>
      </section>

      {/* Quick actions */}
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <Link href={projectsHref}>
          <NeonCard
            badge="IDE"
            title="Open Web IDE"
            subtitle="Jump into the cloud IDE for your active project."
          >
            Start coding with full project context and AI patches.
          </NeonCard>
        </Link>

        <Link href={projectsHref /* لاحقاً /projects/[id]/live */}>
          <NeonCard
            badge="Live"
            title="Live coding session"
            subtitle="Cursor-style live chat with the agent."
          >
            Run guided sessions where the agent plans, patches, and explains
            changes step by step.
          </NeonCard>
        </Link>

        <Link href={integrationsHref}>
          <NeonCard
            badge="Integrations"
            title="Connect GitHub &amp; Vercel"
            subtitle="Enable auto-push and one-click deployments."
          >
            Uses Phase 70.2 + 74 backend for GitHub, Vercel, and GoDaddy DNS.
          </NeonCard>
        </Link>
      </section>

      {/* Recent projects */}
      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-50 sm:text-base">
            Recent projects
          </h2>
          <Link
            href={projectsHref}
            className="text-xs font-medium text-slate-400 hover:text-slate-200"
          >
            View all
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading projects…</p>
        ) : projects.length === 0 ? (
          <NeonCard tone="default">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 opacity-80 text-2xl">😴</div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-200">
                  No projects yet.
                </p>
                <p className="text-[11px] text-slate-400">
                  Start your first project using "Start New Project" above.
                </p>
              </div>
            </div>
          </NeonCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/${locale}/projects/${p.id}`}
                className="block"
              >
                <NeonCard
                  title={p.name}
                  subtitle={p.shortDescription}
                  footer={
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-300">
                        {p.status === "archived" ? "Archived" : "Active"}
                      </span>
                      <span className="text-slate-500">Open →</span>
                    </div>
                  }
                >
                  {/* يمكن إضافة بيانات إضافية هنا لاحقاً */}
                </NeonCard>
              </Link>
            ))}
          </div>
        )}
      </section>
    </NeonPageShell>
  );
}
