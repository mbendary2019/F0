"use client";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebaseClient";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

export default function AuthStatus() {
  const { user, loading } = useAuth();
  const [claims, setClaims] = useState<any>(null);
  const [showingClaims, setShowingClaims] = useState(false);
  const t = useTranslations('auth');
  const locale = useLocale();

  const checkClaims = async () => {
    if (!user || !auth) return;
    try {
      const tokenResult = await user.getIdTokenResult(true);
      setClaims(tokenResult.claims);
      setShowingClaims(true);
    } catch (e) {
      console.error("Failed to get claims:", e);
    }
  };

  const logout = async () => {
    if (!auth) return;
    try {
      await auth.signOut();
      window.location.href = `/${locale}`;
    } catch (e) {
      console.error("Failed to logout:", e);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border bg-blue-50 p-3 text-sm text-blue-800">
        {t('loading')}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-lg border bg-yellow-50 p-3 space-y-2">
        <p className="text-sm text-yellow-800">{t('notAuthenticated')}</p>
        <Link
          href={`/${locale}/login`}
          className="inline-block text-sm text-blue-600 hover:underline"
        >
          {t('signIn')} →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-green-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-green-800">{t('authenticated')}</p>
          <p className="text-xs text-green-600">{user.email}</p>
        </div>
        <button
          onClick={logout}
          className="text-xs px-3 py-1 rounded border border-green-600 text-green-700 hover:bg-green-100"
        >
          {t('signOut')}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={checkClaims}
          className="text-xs px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
        >
          {t('checkClaims')}
        </button>
      </div>

      {showingClaims && claims && (
        <div className="border-t border-green-200 pt-3">
          <p className="text-xs font-medium text-green-800 mb-2">{t('customClaims')}</p>
          <pre className="text-xs bg-white/50 rounded p-2 overflow-auto">
            {JSON.stringify(
              {
                admin: claims.admin,
                developer: claims.developer,
                roles: claims.roles,
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
