/**
 * ExportMenu - Export timeline data as CSV or JSON
 *
 * Provides buttons to export current timeline items in various formats:
 * - CSV for spreadsheet analysis
 * - JSON for programmatic processing
 */

import { toCSV } from "@/utils/csv";
import { downloadJSON } from "@/utils/json";

export interface ExportMenuProps {
  /**
   * Timeline items to export
   */
  items: any[];
}

export function ExportMenu({ items }: ExportMenuProps) {
  const exportCSV = () => {
    // Flatten timeline items for CSV export
    const rows = items.map((i) => ({
      id: i.id,
      timestamp: i.ts,
      type: i.type,
      sessionId: i.sessionId,
      label: i.label,
      severity: i.severity,
      score: i.meta?.score,
      model: i.meta?.model,
      strategy: i.meta?.strategy,
      provider: i.meta?.provider,
    }));

    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timeline-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const filename = `timeline-${new Date().toISOString().split("T")[0]}.json`;
    downloadJSON(items, filename);
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={exportCSV}
        className="px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/60"
        aria-label="Export timeline as CSV"
        title="Export as CSV for spreadsheet analysis"
      >
        📊 Export CSV
      </button>
      <button
        onClick={exportJSON}
        className="px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/60"
        aria-label="Export timeline as JSON"
        title="Export as JSON for programmatic use"
      >
        📄 Export JSON
      </button>
    </div>
  );
}
