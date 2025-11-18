"use client";

import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";

interface LegalReportButtonProps {
  dsarId: string;
}

export default function LegalReportButton({ dsarId }: LegalReportButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);

    try {
      const functions = getFunctions();
      const callable = httpsCallable(functions, "generateLegalReport");

      const result: any = await callable({ dsarId });

      if (result.data?.downloadUrl) {
        // Open PDF in new tab
        window.open(result.data.downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        throw new Error("No download URL returned from function");
      }
    } catch (e: any) {
      console.error("Error generating legal report:", e);
      setError(e?.message || "Failed to generate report");
      alert(`Error: ${e?.message || "Failed to generate legal report"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        onClick={generate}
        disabled={busy}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:hover:bg-gray-800"
        title="Generate PDF report for legal/compliance purposes"
      >
        {busy ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Generating...
          </span>
        ) : (
          "📄 Generate Legal PDF"
        )}
      </button>

      {error && (
        <div className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
