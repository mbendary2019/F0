/**
 * JSON Export Utility
 *
 * Provides utilities for exporting data as JSON files with proper formatting.
 */

/**
 * Downloads data as a formatted JSON file
 *
 * @param data - Any serializable data to export
 * @param filename - Name of the downloaded file (default: "export.json")
 *
 * @example
 * downloadJSON(timelineItems, "timeline-2025-11-07.json");
 *
 * @example
 * downloadJSON({ sessions: data, exportedAt: Date.now() }, "report.json");
 */
export function downloadJSON(data: any, filename = "export.json"): void {
  // Pretty-print JSON with 2-space indentation
  const json = JSON.stringify(data, null, 2);

  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  // Clean up object URL
  URL.revokeObjectURL(url);
}

/**
 * Copies JSON to clipboard
 *
 * @param data - Any serializable data to copy
 * @param pretty - Whether to format with indentation (default: true)
 * @returns Promise that resolves when copied
 *
 * @example
 * await copyJSON(sessionData);
 * alert("Session data copied to clipboard!");
 */
export async function copyJSON(data: any, pretty = true): Promise<void> {
  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await navigator.clipboard.writeText(json);
}
