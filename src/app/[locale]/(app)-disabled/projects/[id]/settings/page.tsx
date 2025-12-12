'use client';

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useProjectSettings } from "@/features/projects/hooks/useProjectSettings";
import { useProjectEnvVars } from "@/features/projects/hooks/useProjectEnvVars";
import type { EnvVarScope } from "@/lib/firebase/functions/envFunctions";
import { GithubSettingsCard } from "@/features/projects/GithubSettingsCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 as TrashIcon } from "lucide-react";
import {
  Settings,
  ArrowLeft,
  Save,
  Github,
  Globe,
  Database,
  Plug,
  AlertTriangle,
  Trash2,
  Info,
  Loader2
} from "lucide-react";

export default function ProjectSettingsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const locale = params.locale as string;

  const { data, loading, saving, error, save } = useProjectSettings(projectId);
  const { items: envVars, loading: envLoading, saving: envSaving, error: envError, saveVar, deleteVar } = useProjectEnvVars(projectId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [techStack, setTechStack] = useState("");

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newScope, setNewScope] = useState<EnvVarScope>("server");
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    if (!data) return;
    setName(data.name ?? "");
    setDescription(data.description ?? "");
    setTechStack(data.techStack ?? "");
  }, [data]);

  const handleSave = async () => {
    await save({
      name,
      description,
      techStack,
    });

    toast.success("تم حفظ الإعدادات", {
      description: "تم تحديث بيانات المشروع بنجاح.",
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/${locale}/projects/${projectId}`}
          className="p-2 hover:bg-accent rounded-md transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            إعدادات المشروع
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Project: <span className="font-mono">{projectId}</span>
          </p>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="flex flex-wrap gap-2">
        <Link href={`/${locale}/projects/${projectId}`}>
          <Button variant="outline" size="sm">
            ← العودة للمشروع
          </Button>
        </Link>
        <Link href={`/${locale}/projects/${projectId}/integrations`}>
          <Button variant="outline" size="sm">
            <Plug className="w-3 h-3 mr-2" />
            التكاملات
          </Button>
        </Link>
        <Link href={`/${locale}/projects/${projectId}/domains`}>
          <Button variant="outline" size="sm">
            <Globe className="w-3 h-3 mr-2" />
            الدومينات
          </Button>
        </Link>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                المعلومات الأساسية
              </CardTitle>
              <CardDescription>
                اسم المشروع، الوصف، والتقنيات المستخدمة
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">اسم المشروع</label>
                    <Input
                      placeholder="مثال: My Awesome App"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="font-mono"
                      disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                      هذا الاسم سيظهر في لوحة التحكم وجميع الصفحات
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">الوصف</label>
                    <Textarea
                      placeholder="وصف مختصر عن المشروع وأهدافه..."
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">التقنيات المستخدمة</label>
                    <Input
                      placeholder="Next.js, Firebase, Tailwind CSS, ..."
                      value={techStack}
                      onChange={(e) => setTechStack(e.target.value)}
                      className="text-sm"
                      disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                      افصل بين التقنيات بفاصلة
                    </p>
                  </div>

                  {error && (
                    <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 p-3 rounded-md">
                      {error}
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} disabled={saving || loading}>
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          جارٍ الحفظ...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          حفظ التغييرات
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* GitHub Integration */}
          <GithubSettingsCard
            projectId={projectId}
            github={data?.github ?? null}
            locale={locale as 'ar' | 'en'}
          />

          {/* Environment Variables */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Environment Variables
              </CardTitle>
              <CardDescription>
                إدارة المتغيرات البيئية الخاصة بالمشروع (server / client)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {envError && (
                <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 p-3 rounded-md">
                  حدث خطأ أثناء تحميل المتغيرات: {envError}
                </div>
              )}

              {/* Existing vars list */}
              <div className="space-y-2">
                {envLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!envLoading && envVars.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    لا توجد متغيرات بعد — أضف أول متغير من الأسفل.
                  </p>
                )}

                {!envLoading && envVars.map((env) => (
                  <div
                    key={env.id}
                    className="flex flex-col gap-2 rounded-md border border-border/50 px-3 py-2 md:flex-row md:items-center"
                  >
                    <div className="flex-1">
                      <p className="text-xs font-mono text-muted-foreground mb-1">{env.key}</p>
                      <div className="flex items-center gap-2">
                        <code className="h-8 flex items-center text-sm bg-muted px-3 rounded-md font-mono flex-1">
                          {env.last4 ? `••••${env.last4}` : "••••••••"}
                        </code>
                        {env.note && (
                          <span className="text-xs text-muted-foreground italic">
                            {env.note}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:w-56">
                      <Badge variant="outline" className="h-8 text-xs">
                        {env.scope === "server" ? "Server only" : env.scope === "client" ? "Client (PUBLIC)" : env.scope === "shared" ? "Shared" : "Both"}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={async () => {
                          if (confirm(`هل تريد حذف المتغير ${env.key}؟`)) {
                            try {
                              await deleteVar(env.id);
                              toast.success("تم حذف المتغير");
                            } catch (err) {
                              toast.error("فشل حذف المتغير");
                            }
                          }
                        }}
                        disabled={envSaving}
                      >
                        <TrashIcon className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border/40 my-4" />

              {/* Add new var */}
              <div className="space-y-2">
                <p className="text-sm font-medium">إضافة متغير جديد</p>
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 md:flex-row">
                    <Input
                      className="md:flex-[2] h-9 text-sm"
                      placeholder="KEY (مثال: NEXT_PUBLIC_API_URL)"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                      disabled={envSaving}
                    />
                    <Input
                      className="md:flex-[3] h-9 text-sm"
                      placeholder="القيمة"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      disabled={envSaving}
                    />
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row">
                    <Select
                      value={newScope}
                      onValueChange={(v) => setNewScope(v as EnvVarScope)}
                      disabled={envSaving}
                    >
                      <SelectTrigger className="md:w-40 h-9 text-xs">
                        <SelectValue placeholder="Scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="server">Server only</SelectItem>
                        <SelectItem value="client">Client (PUBLIC)</SelectItem>
                        <SelectItem value="shared">Shared</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      className="flex-1 h-9 text-sm"
                      placeholder="ملاحظة (اختياري)"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      disabled={envSaving}
                    />
                    <Button
                      size="sm"
                      className="h-9"
                      disabled={!newKey || !newValue || envSaving}
                      onClick={async () => {
                        try {
                          await saveVar(newKey, newValue, newScope, newNote || undefined);
                          setNewKey("");
                          setNewValue("");
                          setNewScope("server");
                          setNewNote("");
                          toast.success("تم إضافة المتغير", {
                            description: "تم حفظ المتغير في الخزنة (Vault) بشكل آمن.",
                          });
                        } catch (err) {
                          toast.error("فشل إضافة المتغير");
                        }
                      }}
                    >
                      {envSaving ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                          إضافة...
                        </>
                      ) : (
                        "إضافة"
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  تذكير: متغيرات الواجهة (client) يجب أن تبدأ بـ <code className="bg-muted px-1 py-0.5 rounded">NEXT_PUBLIC_</code>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
                منطقة الخطر
              </CardTitle>
              <CardDescription>
                إجراءات لا يمكن التراجع عنها
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                <h3 className="text-sm font-semibold mb-2 text-red-900 dark:text-red-200">
                  حذف المشروع
                </h3>
                <p className="text-xs text-red-700 dark:text-red-300 mb-3">
                  سيتم حذف جميع البيانات، التكاملات، الدومينات، والمهام بشكل دائم.
                  لا يمكن التراجع عن هذا الإجراء.
                </p>
                <Button variant="destructive" size="sm" disabled>
                  <Trash2 className="w-3 h-3 mr-2" />
                  حذف المشروع نهائيًا
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Project Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ملخص المشروع</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">معرّف المشروع</p>
                <p className="font-mono text-xs bg-muted px-2 py-1 rounded">
                  {projectId}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">الحالة</p>
                <Badge variant="default" className="text-xs">
                  نشط
                </Badge>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">تاريخ الإنشاء</p>
                <p className="text-xs">--</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">آخر تحديث</p>
                <p className="text-xs">--</p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">إجراءات سريعة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href={`/${locale}/projects/${projectId}/integrations`}>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Plug className="w-3 h-3 mr-2" />
                  إدارة التكاملات
                </Button>
              </Link>

              <Link href={`/${locale}/projects/${projectId}/domains`}>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Globe className="w-3 h-3 mr-2" />
                  إدارة الدومينات
                </Button>
              </Link>

              <Link href={`/${locale}/projects/${projectId}`}>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Settings className="w-3 h-3 mr-2" />
                  العودة للمشروع
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Help Card */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="w-4 h-4" />
                نصيحة
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>
                يمكنك ربط المشروع بـ GitHub Repository من الأعلى
                لتفعيل النشر التلقائي.
              </p>
              <p>
                لإضافة دومين مخصص، توجه إلى صفحة إدارة الدومينات.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
