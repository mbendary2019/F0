/**
 * Phase 80: Neon UI - Projects List Page (Refactored)
 * Uses Neon component library with Phase 79 API integration
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { NeonPageShell } from "@/components/neon/NeonPageShell";
import { NeonButton } from "@/components/neon/NeonButton";
import { NeonCard } from "@/components/neon/NeonCard";
import { NeonInput } from "@/components/neon/NeonInput";
import { NeonBadge } from "@/components/neon/NeonBadge";
import { useF0Auth } from "@/lib/useF0Auth";
import type { F0Project } from "@/types/project";

type Props = {
  params: { locale: string };
};

export default function ProjectsPage({ params }: Props) {
  const { locale } = params;
  const router = useRouter();
  const { user, initializing } = useF0Auth();

  const [projects, setProjects] = useState<F0Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isArabic = locale === "ar";

  // Auth redirect
  useEffect(() => {
    if (!initializing && !user) {
      router.push(`/${locale}/auth`);
    }
  }, [initializing, user, router, locale]);

  // Load projects
  useEffect(() => {
    async function fetchProjects() {
      if (!user) return;

      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/projects", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) throw new Error("Failed to load projects");
        const data = await res.json();
        setProjects(data.projects || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, [user]);

  // Create project
  async function handleCreateProject() {
    if (!user || !newName.trim()) {
      setError(isArabic ? "اكتب اسم المشروع" : "Please enter a project name");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const idToken = await user.getIdToken();
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: newName.trim(),
          shortDescription: newDesc.trim() || undefined,
          techStack: "Next.js, Firebase, Tailwind CSS",
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to create project");
      }

      const created: F0Project = await res.json();
      router.push(`/${locale}/projects/${created.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error creating project");
    } finally {
      setCreating(false);
    }
  }

  // Filter projects
  const filtered = projects.filter((p) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.shortDescription || "").toLowerCase().includes(q) ||
      (p.techStack || "").toLowerCase().includes(q)
    );
  });

  if (initializing || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030314] text-slate-400">
        Loading...
      </div>
    );
  }

  return (
    <NeonPageShell
      title={isArabic ? "مشاريعي" : "My projects"}
      subtitle={
        isArabic
          ? "جميع المشاريع المدارة بواسطة وكيل F0 - تطبيقات ويب، APIs، تطبيقات موبايل والمزيد."
          : "All projects managed by F0's AI agent – web apps, APIs, mobile apps and more."
      }
      rightActions={
        <NeonButton onClick={() => setShowForm(!showForm)}>
          {isArabic ? "+ مشروع جديد" : "+ New project"}
        </NeonButton>
      }
    >
      {/* New Project Form */}
      {showForm && (
        <section className="mb-6">
          <NeonCard title={isArabic ? "إنشاء مشروع جديد" : "Create new project"}>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <NeonInput
                  label={isArabic ? "اسم المشروع" : "Project name"}
                  placeholder={isArabic ? "مثال: متجر إلكتروني" : "e.g. My SaaS App"}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <NeonInput
                  label={isArabic ? "وصف مختصر" : "Short description"}
                  placeholder={
                    isArabic
                      ? "وصف سريع لاستخدام المشروع"
                      : "What is this project for?"
                  }
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-2">
                <NeonButton
                  onClick={handleCreateProject}
                  loading={creating}
                  disabled={creating || !newName.trim()}
                >
                  {isArabic ? "إنشاء المشروع" : "Create project"}
                </NeonButton>
                <NeonButton variant="secondary" onClick={() => setShowForm(false)}>
                  {isArabic ? "إلغاء" : "Cancel"}
                </NeonButton>
              </div>
            </div>
          </NeonCard>
        </section>
      )}

      {/* Search */}
      <section className="mb-6">
        <div className="w-full max-w-md">
          <NeonInput
            label={isArabic ? "بحث" : "Search"}
            placeholder={
              isArabic
                ? "ابحث بالاسم، التقنيات، أو الوصف…"
                : "Search by name, tech stack, or description…"
            }
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            prefix={<span>🔍</span>}
          />
        </div>
      </section>

      {/* Projects List */}
      <section className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-400">
            {isArabic ? "جاري التحميل..." : "Loading projects…"}
          </p>
        ) : filtered.length === 0 ? (
          <NeonCard>
            <p className="text-xs text-slate-300">
              {isArabic
                ? "لا توجد مشاريع تطابق هذا البحث. جرّب مسح البحث أو إنشاء مشروع جديد."
                : "No projects match this filter. Try clearing the search or create a new project."}
            </p>
          </NeonCard>
        ) : (
          filtered.map((p) => (
            <Link
              key={p.id}
              href={`/${locale}/projects/${p.id}`}
              className="block"
            >
              <NeonCard
                title={p.name}
                subtitle={p.shortDescription}
                footer={
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex flex-wrap items-center gap-2">
                      <NeonBadge tone="neutral">
                        {p.status === "archived"
                          ? isArabic
                            ? "مؤرشف"
                            : "Archived"
                          : isArabic
                          ? "نشط"
                          : "Active"}
                      </NeonBadge>
                      {p.techStack && (
                        <span className="text-slate-400">{p.techStack}</span>
                      )}
                    </div>
                    <span className="text-slate-500">
                      {isArabic ? "فتح المشروع ←" : "Open project →"}
                    </span>
                  </div>
                }
              />
            </Link>
          ))
        )}
      </section>
    </NeonPageShell>
  );
}
