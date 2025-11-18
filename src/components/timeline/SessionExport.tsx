/**
 * SessionExport Component
 *
 * Export button for complete session data.
 * Fetches session details and downloads as JSON or CSV.
 */

"use client";

import { useState } from "react";
import { exportSessionAsJson, exportSessionAsCsv, exportSessionCsv } from "@/utils/exportSession";

export interface SessionExportProps {
  /**
   * Session ID to export
   */
  sessionId: string;

  /**
   * Export format (default: "json")
   */
  format?: "json" | "csv" | "both" | "session-csv";

  /**
   * Optional: pass events directly for session-csv format
   */
  events?: any[];
}

export function SessionExport({ sessionId, format = "json", events }: SessionExportProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async (exportFormat: "json" | "csv" | "session-csv") => {
    try {
      setLoading(true);

      // For session-csv format, use events directly if provided
      if (exportFormat === "session-csv") {
        if (!events || events.length === 0) {
          throw new Error("No events provided for export");
        }
        exportSessionCsv(sessionId, events);
        setLoading(false);
        return;
      }

      // Fetch session data for full exports
      const response = await fetch(`/api/ops/timeline/${sessionId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Export in requested format
      if (exportFormat === "json") {
        exportSessionAsJson(data);
      } else {
        exportSessionAsCsv(data);
      }
    } catch (err: any) {
      console.error("Export failed:", err);
      alert(`Failed to export session: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (format === "both") {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => handleExport("json")}
          disabled={loading}
          className="px-3 py-1 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500/60"
          aria-label="Export session as JSON"
        >
          {loading ? "⏳" : "📄"} JSON
        </button>
        <button
          onClick={() => handleExport("csv")}
          disabled={loading}
          className="px-3 py-1 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500/60"
          aria-label="Export session as CSV"
        >
          {loading ? "⏳" : "📊"} CSV
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => handleExport(format)}
      disabled={loading}
      className="px-3 py-1 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500/60"
      aria-label={`Export session as ${format.toUpperCase()}`}
    >
      {loading ? "⏳ Exporting..." : `💾 Export ${format.toUpperCase()}`}
    </button>
  );
}
