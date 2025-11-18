"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useF0Auth } from "@/lib/useF0Auth";

type Project = {
  id: string;
  name: string;
  description?: string;
  ownerUid: string;
  lastActivity?: string;
};

export default function ProjectsPage() {
  const { user, initializing, logout } = useF0Auth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const locale = useLocale();
  const isArabic = locale === "ar";

  // لو مش لوج إن → روح auth
  useEffect(() => {
    if (!initializing && !user) {
      router.push(`/${locale}/auth`);
    }
  }, [initializing, user, router, locale]);

  // تحميل المشاريع
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "projects"),
      where("ownerUid", "==", user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: Project[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as any;
        list.push({
          id: doc.id,
          name: data.name || "(بدون اسم)",
          description: data.description || "",
          ownerUid: data.ownerUid,
        });
      });
      setProjects(list);
    });

    return () => unsub();
  }, [user]);

  async function handleCreateProject() {
    if (!user) return;
    if (!newName.trim()) {
      setError(isArabic ? "اكتب اسم المشروع" : "Please enter a project name");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const { addDoc, serverTimestamp } = await import("firebase/firestore");

      const docRef = await addDoc(collection(db, "projects"), {
        name: newName.trim(),
        description: newDesc.trim() || "",
        ownerUid: user.uid,
        slug: newName.trim().toLowerCase().replace(/\s+/g, "-"),
        stack: "Next.js, Firebase, Tailwind CSS",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNewName("");
      setNewDesc("");

      router.push(`/${locale}/projects/${docRef.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error creating project");
    } finally {
      setCreating(false);
    }
  }

  if (initializing || (!user && !initializing)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">
        {/* الهيدر */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {isArabic ? "مشاريعي" : "My Projects"}
            </h1>
            <p className="text-sm text-gray-500">
              {isArabic
                ? "أنشئ مشروع جديد لاختبار الإعدادات والتكاملات مع الوكيل."
                : "Create a project to test settings and integrations with the agent."}
            </p>
          </div>

          <button
            onClick={logout}
            className="text-xs px-3 py-1.5 rounded-full border text-gray-700"
          >
            {isArabic ? "تسجيل الخروج" : "Logout"}
          </button>
        </div>

        {/* إنشاء مشروع جديد */}
        <div className="bg-white rounded-2xl shadow p-6 space-y-4 border-dashed border border-slate-200">
          <button
            type="button"
            className="w-full text-center text-sm text-slate-500 mb-4"
            onClick={() => {
              // مجرد Scroll للداخل؛ عندك الفورم تحت أصلاً
            }}
          >
            {isArabic ? "+ إنشاء مشروع جديد" : "+ Create a new project"}
          </button>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                {isArabic ? "اسم المشروع" : "Project name"}
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={isArabic ? "مثال: متجر إلكتروني" : "e.g. My SaaS App"}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                {isArabic ? "وصف مختصر" : "Short description"}
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder={
                  isArabic
                    ? "وصف سريع لاستخدام المشروع"
                    : "What is this project for?"
                }
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={handleCreateProject}
            disabled={creating}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white disabled:opacity-60"
            type="button"
          >
            {creating
              ? isArabic
                ? "جاري إنشاء المشروع..."
                : "Creating..."
              : isArabic
              ? "إنشاء المشروع"
              : "Create project"}
          </button>
        </div>

        {/* قائمة المشاريع */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            {isArabic ? "المشاريع الحالية" : "Existing projects"}
          </h2>

          {projects.length === 0 ? (
            <p className="text-sm text-gray-500">
              {isArabic
                ? "لا توجد مشاريع حتى الآن. أنشئ أول مشروع من الأعلى."
                : "No projects yet. Create your first one above."}
            </p>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => router.push(`/${locale}/projects/${p.id}`)}
                  className="w-full text-left border rounded-lg px-4 py-3 hover:bg-slate-50 flex items-center justify-between bg-slate-100/70"
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-gray-500 line-clamp-1">
                        {p.description}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400">
                    ID: {p.id}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
