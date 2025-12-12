/**
 * Phase 80: Neon UI - Project Overview Page (Refactored)
 * Uses Neon component library with existing Phase 79 features
 */

'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import Link from 'next/link';

import { NeonPageShell } from '@/components/neon/NeonPageShell';
import { NeonTabBar } from '@/components/neon/NeonTabBar';
import { NeonCard } from '@/components/neon/NeonCard';
import { NeonButton } from '@/components/neon/NeonButton';
import { NeonBadge } from '@/components/neon/NeonBadge';

// Existing feature components
import { ProjectDomainsCard } from '@/features/domains/ProjectDomainsCard';
import { ProjectGithubActions } from '@/features/projects/ProjectGithubActions';
import { ProjectTechStackCard } from '@/features/projects/ProjectTechStackCard';
import { ProjectMemoryCard } from '@/features/projects/ProjectMemoryCard';

// Disable SSR for dynamic panels
const ChatPanel = dynamic(() => import('@/features/chat/ChatPanel'), { ssr: false });
const TasksPanel = dynamic(() => import('@/features/tasks/TasksPanel'), { ssr: false });

export default function ProjectDetailsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const locale = (params.locale as string) || 'en';
  const isArabic = locale === 'ar';

  const basePath = `/${locale}/projects/${projectId}`;

  // Tab configuration
  const tabs = [
    { key: 'overview', label: isArabic ? 'نظرة عامة' : 'Overview', href: basePath },
    { key: 'ide', label: 'Web IDE', href: `${basePath}/ide` },
    { key: 'live', label: isArabic ? 'Live Coding' : 'Live', href: `${basePath}/live` },
    { key: 'board', label: isArabic ? 'لوحة الفريق' : 'Board', href: `${basePath}/board` },
    { key: 'integrations', label: isArabic ? 'تكاملات' : 'Integrations', href: `${basePath}/integrations` },
  ];

  return (
    <NeonPageShell
      breadcrumbs={[
        { label: isArabic ? 'المشاريع' : 'Projects', href: `/${locale}/projects` },
        { label: projectId.substring(0, 12) + '...' },
      ]}
      title={`Project: ${projectId.substring(0, 16)}...`}
      subtitle={isArabic
        ? 'فضاء عمل مدار بالوكيل - المهام، الدومينات، التكاملات'
        : 'Agent-Driven Development • Tasks • Domains • Integrations'}
      rightActions={
        <>
          <Link href={`${basePath}/ide`}>
            <NeonButton size="sm">Open IDE</NeonButton>
          </Link>
          <Link href={`${basePath}/live`}>
            <NeonButton variant="secondary" size="sm">
              Live Session
            </NeonButton>
          </Link>
        </>
      }
    >
      {/* Tabs */}
      <NeonTabBar tabs={tabs} activeKey="overview" className="mb-8" />

      {/* Overview Cards Grid */}
      <div className="grid gap-4 lg:grid-cols-4 mb-6">
        {/* Quick Links */}
        <NeonCard
          title={isArabic ? 'روابط سريعة' : 'Quick Links'}
          icon={<span>⚡</span>}
        >
          <div className="space-y-2 text-xs">
            <Link
              href={`${basePath}/integrations`}
              className="flex items-center gap-2 hover:underline text-[#9FA7FF]"
            >
              <span>⚙️</span>
              {isArabic ? 'إعدادات التكاملات' : 'Integrations'}
            </Link>
            <Link
              href={`${basePath}/domains`}
              className="flex items-center gap-2 hover:underline text-[#9FA7FF]"
            >
              <span>🌐</span>
              {isArabic ? 'إدارة الدومينات' : 'Manage Domains'}
            </Link>
            <Link
              href={`${basePath}/settings`}
              className="flex items-center gap-2 hover:underline text-[#9FA7FF]"
            >
              <span>🔧</span>
              {isArabic ? 'إعدادات المشروع' : 'Project Settings'}
            </Link>
            <Link
              href={`${basePath}/live`}
              className="flex items-center gap-2 hover:underline text-[#9FA7FF]"
            >
              <span>💻</span>
              {isArabic ? 'شاشة Live Coding' : 'Live Coding Screen'}
            </Link>
          </div>
        </NeonCard>

        {/* Tech Stack */}
        <ProjectTechStackCard projectId={projectId} locale={locale} />

        {/* Integrations Status */}
        <NeonCard
          title={isArabic ? 'التكاملات' : 'Integrations'}
          icon={<span>🔗</span>}
        >
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span>Vercel</span>
              <NeonBadge tone="success">{isArabic ? 'متصل' : 'Connected'}</NeonBadge>
            </div>
            <div className="flex items-center justify-between">
              <span>Firebase</span>
              <NeonBadge tone="success">{isArabic ? 'متصل' : 'Connected'}</NeonBadge>
            </div>
            <div className="flex items-center justify-between">
              <span>GitHub</span>
              <NeonBadge tone="success">{isArabic ? 'متصل' : 'Connected'}</NeonBadge>
            </div>

            <ProjectGithubActions
              projectId={projectId}
              isArabic={isArabic}
              hasGithub={true}
            />
          </div>
        </NeonCard>

        {/* Domains */}
        <ProjectDomainsCard projectId={projectId} />
      </div>

      {/* Project Memory - Full Width */}
      <div className="mb-6">
        <ProjectMemoryCard projectId={projectId} locale={locale} />
      </div>

      {/* Main Workspace: Tasks + Chat */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Tasks Panel */}
        <NeonCard
          title={isArabic ? 'المهام' : 'Tasks'}
          tone="default"
        >
          <TasksPanel projectId={projectId} />
        </NeonCard>

        {/* Agent Chat Panel */}
        <NeonCard
          title={isArabic ? 'الوكيل' : 'Agent Chat'}
          tone="accent"
          badge="AI"
        >
          <ChatPanel projectId={projectId} />
        </NeonCard>
      </div>
    </NeonPageShell>
  );
}
