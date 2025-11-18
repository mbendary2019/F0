'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { ProjectDomainsCard } from '@/features/domains/ProjectDomainsCard';
import { ProjectGithubActions } from '@/features/projects/ProjectGithubActions';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Settings, Globe, Zap, Code } from 'lucide-react';
import { useState } from 'react';

// Disable SSR for ChatPanel and TasksPanel to prevent hydration errors
const ChatPanel = dynamic(() => import('@/features/chat/ChatPanel'), { ssr: false });
const TasksPanel = dynamic(() => import('@/features/tasks/TasksPanel'), { ssr: false });

// Quick Links Card Component
function QuickLinksCard({ projectId }: { projectId: string }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Zap className="w-4 h-4" />
          روابط سريعة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link
          href={`/ar/projects/${projectId}/integrations`}
          className="flex items-center gap-2 text-sm hover:underline text-primary"
        >
          <Settings className="w-3 h-3" />
          إعدادات التكاملات (Firebase / Vercel / GitHub)
        </Link>

        <Link
          href={`/ar/projects/${projectId}/domains`}
          className="flex items-center gap-2 text-sm hover:underline text-primary"
        >
          <Globe className="w-3 h-3" />
          إدارة الدومينات &amp; DNS
        </Link>

        <Link
          href={`/ar/projects/${projectId}/settings`}
          className="flex items-center gap-2 text-sm hover:underline text-primary"
        >
          <Settings className="w-3 h-3" />
          إعدادات المشروع العامة
        </Link>

        <Link
          href={`/ar/projects/${projectId}/live`}
          className="flex items-center gap-2 text-sm hover:underline text-primary"
        >
          <Code className="w-3 h-3" />
          Live Coding Screen (Cursor / Claude Style)
        </Link>
      </CardContent>
    </Card>
  );
}

// Integrations Card with GitHub Actions
function ProjectIntegrationsCard({ projectId, locale }: { projectId: string; locale: string }) {
  const isArabic = locale === 'ar';
  // Assume GitHub is connected for now - in production, fetch from Firestore
  const hasGithub = true;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Settings className="w-4 h-4" />
          {isArabic ? 'التكاملات' : 'Integrations'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span>Vercel</span>
            <span className="text-muted-foreground">{isArabic ? 'متصل' : 'Connected'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Firebase</span>
            <span className="text-muted-foreground">{isArabic ? 'متصل' : 'Connected'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>GitHub</span>
            <span className="text-muted-foreground">{isArabic ? 'متصل' : 'Connected'}</span>
          </div>

          {/* GitHub Actions Component */}
          <ProjectGithubActions
            projectId={projectId}
            isArabic={isArabic}
            hasGithub={hasGithub}
          />

          <Link
            href={`/${locale}/projects/${projectId}/settings`}
            className="text-[11px] underline text-primary block mt-2"
          >
            {isArabic
              ? 'إعدادات المشروع (GitHub Repo Link) →'
              : 'Project Settings (GitHub Repo Link) →'}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProjectDetailsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const locale = (params.locale as string) || 'en';

  return (
    <div className="flex flex-col gap-6 p-6 h-full min-h-[calc(100vh-64px)]">
      {/* Project Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Project: <span className="font-mono text-primary">{projectId}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Agent-Driven Development • Tasks • Domains • Integrations
          </p>
        </div>
      </div>

      {/* Overview Cards Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        <QuickLinksCard projectId={projectId} />
        <ProjectIntegrationsCard projectId={projectId} locale={locale} />
        <ProjectDomainsCard projectId={projectId} />
      </div>

      {/* Main Workspace: Tasks + Chat */}
      <div className="grid gap-4 flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Tasks Panel - Left Side */}
        <section
          className="rounded-2xl border p-4 overflow-auto"
          style={{ borderColor: 'var(--card-bdr)', background: 'var(--card-bg)' }}
        >
          <TasksPanel projectId={projectId} />
        </section>

        {/* Agent Chat Panel - Right Side */}
        <aside
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: 'var(--card-bdr)', background: 'var(--card-bg)' }}
        >
          {/* Neon Header */}
          <div className="h-1 rounded-t-2xl" style={{ background: 'var(--neon)' }} />
          <ChatPanel projectId={projectId} />
        </aside>
      </div>
    </div>
  );
}
