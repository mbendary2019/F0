/**
 * Phase 63 Day 3: Reports Panel Component
 * Displays list of recent daily reports with download links
 */

"use client";

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { app } from "@/lib/firebase";

type ReportItem = {
  date: string;
  createdAt: number;
  pdf: {
    path: string;
    size: number;
    contentType: string;
    url: string | null;
  };
  xlsx: {
    path: string;
    size: number;
    contentType: string;
    url: string | null;
  };
};

export default function ReportsPanel({ locale = "ar" }: { locale?: "ar" | "en" }) {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t =
    locale === "ar"
      ? {
          title: "التقارير اليومية",
          pdf: "تحميل PDF",
          xlsx: "تحميل XLSX",
          empty: "لا توجد تقارير بعد",
          loading: "جاري التحميل...",
          error: "فشل تحميل التقارير",
          retry: "إعادة المحاولة",
          size: "الحجم",
        }
      : {
          title: "Daily Reports",
          pdf: "Download PDF",
          xlsx: "Download XLSX",
          empty: "No reports yet",
          loading: "Loading...",
          error: "Failed to load reports",
          retry: "Retry",
          size: "Size",
        };

  useEffect(() => {
    let mounted = true;

    async function fetchReports() {
      setLoading(true);
      setError(null);

      try {
        // Get Firebase auth token
        const auth = getAuth(app);
        const user = auth.currentUser;

        if (!user) {
          throw new Error("User not authenticated");
        }

        const idToken = await user.getIdToken();

        // Fetch reports from API
        const res = await fetch("/api/ops/reports", {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const json = await res.json();

        if (mounted) {
          setItems(json.items ?? []);
        }
      } catch (err: any) {
        console.error("[ReportsPanel] Error fetching reports:", err);
        if (mounted) {
          setError(err.message || "Failed to load reports");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchReports();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Format file size in human-readable format
   */
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-red-700 dark:text-red-400">{t.title}</h3>
        </div>
        <div className="text-sm text-red-600 dark:text-red-500 mb-3">{t.error}: {error}</div>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors text-sm"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{t.title}</h3>
        {!loading && items.length > 0 && (
          <span className="text-sm opacity-60">{items.length} reports</span>
        )}
      </div>

      {loading ? (
        <div className="h-32 grid place-content-center opacity-60">
          <div className="animate-pulse">{t.loading}</div>
        </div>
      ) : items.length === 0 ? (
        <div className="h-32 grid place-content-center opacity-60">{t.empty}</div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {items.map((report) => (
            <div
              key={report.date}
              className="flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div>
                <div className="text-sm font-medium">{report.date}</div>
                <div className="text-xs opacity-60 mt-1">
                  PDF: {formatSize(report.pdf.size)} | XLSX: {formatSize(report.xlsx.size)}
                </div>
              </div>
              <div className="flex gap-2">
                {report.pdf?.url && (
                  <a
                    className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
                    href={report.pdf.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    download={`report-${report.date}.pdf`}
                  >
                    {t.pdf}
                  </a>
                )}
                {report.xlsx?.url && (
                  <a
                    className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
                    href={report.xlsx.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    download={`report-${report.date}.xlsx`}
                  >
                    {t.xlsx}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
