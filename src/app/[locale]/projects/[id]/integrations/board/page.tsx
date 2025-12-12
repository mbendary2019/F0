// src/app/[locale]/projects/[id]/integrations/board/page.tsx
"use client";

import { useParams } from "next/navigation";
import { NeonPageShell, NeonCard, NeonBadge } from "@/components/neon";

export default function ProjectBoardPage() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <NeonPageShell
      title="Project Board"
      subtitle="Kanban-style task management board"
      breadcrumbs={[
        { label: "Projects", href: "/projects" },
        { label: projectId, href: `/projects/${projectId}` },
        { label: "Integrations", href: `/projects/${projectId}/integrations` },
        { label: "Board" },
      ]}
    >
      <div className="space-y-6">
        {/* Board Placeholder */}
        <NeonCard
          title="Task Board"
          subtitle="Visual kanban board for project tasks"
          tone="neutral"
        >
          <div className="grid gap-4 md:grid-cols-3">
            {/* TODO Column */}
            <div className="rounded-lg border border-white/10 bg-[#030314] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-50">To Do</h3>
                <NeonBadge tone="neutral">3</NeonBadge>
              </div>
              <div className="space-y-2">
                <TaskCard
                  title="Setup authentication"
                  status="pending"
                  priority="high"
                />
                <TaskCard
                  title="Create database schema"
                  status="pending"
                  priority="medium"
                />
                <TaskCard
                  title="Design landing page"
                  status="pending"
                  priority="low"
                />
              </div>
            </div>

            {/* In Progress Column */}
            <div className="rounded-lg border border-white/10 bg-[#030314] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-50">
                  In Progress
                </h3>
                <NeonBadge tone="accent">2</NeonBadge>
              </div>
              <div className="space-y-2">
                <TaskCard
                  title="Implement API routes"
                  status="in_progress"
                  priority="high"
                />
                <TaskCard
                  title="Add error handling"
                  status="in_progress"
                  priority="medium"
                />
              </div>
            </div>

            {/* Done Column */}
            <div className="rounded-lg border border-white/10 bg-[#030314] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-50">Done</h3>
                <NeonBadge tone="success">1</NeonBadge>
              </div>
              <div className="space-y-2">
                <TaskCard
                  title="Project setup complete"
                  status="completed"
                  priority="high"
                />
              </div>
            </div>
          </div>
        </NeonCard>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <NeonCard title="Total Tasks" tone="neutral">
            <p className="text-2xl font-bold text-white">6</p>
          </NeonCard>
          <NeonCard title="In Progress" tone="accent">
            <p className="text-2xl font-bold text-white">2</p>
          </NeonCard>
          <NeonCard title="Completed" tone="success">
            <p className="text-2xl font-bold text-white">1</p>
          </NeonCard>
          <NeonCard title="Pending" tone="warning">
            <p className="text-2xl font-bold text-white">3</p>
          </NeonCard>
        </div>
      </div>
    </NeonPageShell>
  );
}

function TaskCard({
  title,
  status,
  priority,
}: {
  title: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
}) {
  const priorityColors = {
    low: "text-slate-400",
    medium: "text-yellow-400",
    high: "text-red-400",
  };

  return (
    <div className="rounded-lg border border-white/10 bg-[#050519] p-3 transition-colors hover:border-white/20">
      <h4 className="text-sm font-medium text-slate-50">{title}</h4>
      <div className="mt-2 flex items-center gap-2">
        <span className={`text-xs ${priorityColors[priority]}`}>
          {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
        </span>
      </div>
    </div>
  );
}
