/**
 * Phase 79: Projects Page Client Component
 * Handles project creation and listing
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { F0Project, ListProjectsResponse } from '@/types/project';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, FolderOpen } from 'lucide-react';

export function ProjectsPageClient() {
  const router = useRouter();
  const [projects, setProjects] = useState<F0Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [techStack, setTechStack] = useState('');

  async function loadProjects() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/projects', { method: 'GET' });

      if (!res.ok) {
        throw new Error(`فشل تحميل المشاريع: ${res.status}`);
      }

      const json: ListProjectsResponse = await res.json();
      setProjects(json.projects);
    } catch (e: any) {
      console.error('Load projects error:', e);
      setError('تعذر تحميل المشاريع');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('اسم المشروع مطلوب');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          shortDescription: shortDescription.trim() || undefined,
          techStack: techStack.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'فشل إنشاء المشروع');
      }

      const created: F0Project = await res.json();
      setProjects((prev) => [created, ...prev]);

      // Reset form
      setName('');
      setShortDescription('');
      setTechStack('');
      setShowCreateForm(false);
    } catch (e: any) {
      console.error('Create project error:', e);
      setError(e.message || 'تعذر إنشاء المشروع');
    } finally {
      setCreating(false);
    }
  }

  function handleProjectClick(projectId: string) {
    router.push(`/ar/projects/${projectId}`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">مشاريعي</h1>
          <p className="text-muted-foreground mt-1">
            قم بإنشاء وإدارة مشاريعك
          </p>
        </div>

        {!showCreateForm && (
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 ml-2" />
            مشروع جديد
          </Button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Create Project Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>إنشاء مشروع جديد</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">اسم المشروع *</Label>
                <Input
                  id="name"
                  placeholder="مثال: تطبيق إدارة المهام"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={creating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shortDescription">وصف مختصر</Label>
                <Textarea
                  id="shortDescription"
                  placeholder="وصف مختصر للمشروع (اختياري)"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  rows={3}
                  disabled={creating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="techStack">التقنيات المستخدمة</Label>
                <Input
                  id="techStack"
                  placeholder="مثال: Next.js, Firebase, Tailwind CSS"
                  value={techStack}
                  onChange={(e) => setTechStack(e.target.value)}
                  disabled={creating}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جاري الإنشاء...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 ml-2" />
                      إنشاء المشروع
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setName('');
                    setShortDescription('');
                    setTechStack('');
                    setError(null);
                  }}
                  disabled={creating}
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Projects List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري تحميل المشاريع...
              </div>
            </CardContent>
          </Card>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  لا توجد مشاريع حتى الآن
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  قم بإنشاء مشروعك الأول للبدء
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleProjectClick(project.id)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{project.name}</h3>
                    {project.shortDescription && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {project.shortDescription}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span>ID: {project.id}</span>
                      {project.techStack && (
                        <span className="text-primary">{project.techStack}</span>
                      )}
                      <span className="bg-primary/10 text-primary px-2 py-1 rounded">
                        {project.status}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
