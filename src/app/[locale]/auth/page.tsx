"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useF0Auth } from "@/lib/useF0Auth";

export default function AuthPage() {
  const { user, initializing, error, setError, login, register } = useF0Auth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("dev@test.com");
  const [password, setPassword] = useState("12345678");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const locale = useLocale();

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  // لو already logged in → روح على صفحة المشاريع
  if (user) {
    router.push(`/${locale}/projects`);
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
      router.push(`/${locale}/projects`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Auth error");
    } finally {
      setLoading(false);
    }
  }

  const isArabic = locale === "ar";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <h1 className="text-2xl font-bold text-center">
          {isArabic ? "تسجيل الدخول إلى F0" : "Sign in to F0"}
        </h1>

        <div className="flex justify-center gap-2 text-sm">
          <button
            onClick={() => setMode("login")}
            className={`px-3 py-1 rounded-full border ${
              mode === "login"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700"
            }`}
          >
            {isArabic ? "دخول" : "Login"}
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`px-3 py-1 rounded-full border ${
              mode === "signup"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700"
            }`}
          >
            {isArabic ? "تسجيل جديد" : "Sign up"}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium">
              {isArabic ? "البريد الإلكتروني" : "Email"}
            </label>
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium">
              {isArabic ? "كلمة المرور" : "Password"}
            </label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 whitespace-pre-line">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2 text-sm font-semibold bg-slate-900 text-white disabled:opacity-60"
          >
            {loading
              ? isArabic
                ? "جارٍ المعالجة..."
                : "Processing..."
              : mode === "login"
              ? isArabic
                ? "تسجيل الدخول"
                : "Login"
              : isArabic
              ? "إنشاء حساب"
              : "Create account"}
          </button>

          {isArabic && (
            <p className="text-[11px] text-gray-500 mt-2">
              للاختبار يمكنك استخدام المستخدم الجاهز:
              <br />
              dev@test.com / 12345678
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
