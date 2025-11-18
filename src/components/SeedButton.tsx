"use client";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslations } from "next-intl";

interface SeedButtonProps {
  orchUrl?: string;
}

export default function SeedButton({ orchUrl = "http://localhost:8080" }: SeedButtonProps) {
  const { user } = useAuth();
  const t = useTranslations('seed');
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [count, setCount] = useState(100);
  const [daysBack, setDaysBack] = useState(10);

  // Check if user has admin claims
  const [isAdmin, setIsAdmin] = useState(false);

  useState(() => {
    if (user) {
      user.getIdTokenResult().then((result) => {
        setIsAdmin(result.claims.admin === true);
      });
    }
  });

  const runSeed = async () => {
    if (!user) {
      setMsg("⚠️ " + t('error'));
      return;
    }

    setLoading(true);
    setMsg("🌱 " + t('seeding'));

    try {
      // Get the API key from the seed endpoint directly
      // In production, this should go through a Next.js API route
      const apiKey = process.env.NEXT_PUBLIC_F0_API_KEY || "40553a48faf4ab1e9f77670df6444229535be8ff7ad4d511d3ee0d87ce1a936a";

      const res = await fetch(`${orchUrl}/api/ops/seed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-f0-key": apiKey,
        },
        body: JSON.stringify({
          count,
          daysBack,
          env: "dev",
          withAudit: true,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMsg(`✅ ${t('success')}`);
      } else {
        setMsg(`❌ ${t('error')}: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      setMsg(`❌ ${t('error')}: ${e?.message || "Network error"}`);
    } finally {
      setLoading(false);
    }
  };

  // Don't show to non-admin users
  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-purple-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-purple-800">{t('title')}</p>
          <p className="text-xs text-purple-600">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="text-xs px-3 py-1 rounded border border-purple-600 text-purple-700 hover:bg-purple-100"
        >
          {showConfig ? t('hide') : t('configure')}
        </button>
      </div>

      {showConfig && (
        <div className="space-y-2 border-t border-purple-200 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-purple-800">{t('records')}</label>
              <input
                type="number"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full text-sm rounded border px-2 py-1"
                min="10"
                max="500"
              />
            </div>
            <div>
              <label className="text-xs text-purple-800">{t('daysBack')}</label>
              <input
                type="number"
                value={daysBack}
                onChange={(e) => setDaysBack(Number(e.target.value))}
                className="w-full text-sm rounded border px-2 py-1"
                min="1"
                max="30"
              />
            </div>
          </div>
        </div>
      )}

      <button
        onClick={runSeed}
        disabled={loading}
        className="w-full text-sm px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
      >
        {loading ? t('seeding') : t('seedButton', {count})}
      </button>

      {msg && (
        <div
          className={`text-xs p-2 rounded ${
            msg.startsWith("✅")
              ? "bg-green-100 text-green-800"
              : msg.startsWith("❌")
              ? "bg-red-100 text-red-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {msg}
        </div>
      )}

      <p className="text-xs text-purple-600">
        {t('adminOnly')}
      </p>
    </div>
  );
}
