/**
 * Session Export Utilities
 *
 * Tools for exporting complete session data as downloadable files.
 */

export interface SessionData {
  sessionId: string;
  events: any[];
  stats?: any;
  userId?: string;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
}

export interface SessionExport {
  sessionId: string;
  exportedAt: string;
  stats: any;
  events: any[];
  metadata?: {
    userId?: string;
    startedAt?: number;
    endedAt?: number;
    durationMs?: number;
  };
}

/**
 * Builds a complete session export object
 *
 * @param session - Raw session data from API
 * @returns Formatted export object with metadata
 *
 * @example
 * const sessionData = await fetch(`/api/ops/timeline/${sessionId}`).then(r => r.json());
 * const exportData = buildSessionExport(sessionData);
 */
export function buildSessionExport(session: SessionData): SessionExport {
  return {
    sessionId: session.sessionId,
    exportedAt: new Date().toISOString(),
    stats: session.stats || {},
    events: session.events || [],
    metadata: {
      userId: session.userId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMs: session.durationMs,
    },
  };
}

/**
 * Downloads content as a file
 *
 * @param content - File content (string or Blob)
 * @param filename - Name for downloaded file
 * @param type - MIME type (default: application/json)
 *
 * @example
 * downloadBlob(JSON.stringify(data, null, 2), "session_123.json");
 */
export function downloadBlob(
  content: string | Blob,
  filename: string,
  type = "application/json"
): void {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  // Cleanup
  URL.revokeObjectURL(url);
}

/**
 * Exports a session as JSON file
 *
 * @param session - Session data to export
 * @param filename - Optional custom filename
 *
 * @example
 * exportSessionAsJson(sessionData, "my-session.json");
 */
export function exportSessionAsJson(
  session: SessionData,
  filename?: string
): void {
  const exportData = buildSessionExport(session);
  const json = JSON.stringify(exportData, null, 2);
  const defaultFilename = `session_${session.sessionId}_${new Date().toISOString().split("T")[0]}.json`;

  downloadBlob(json, filename || defaultFilename);
}

/**
 * Exports session events as CSV
 *
 * @param session - Session data to export
 * @param filename - Optional custom filename
 *
 * @example
 * exportSessionAsCsv(sessionData);
 */
export function exportSessionAsCsv(
  session: SessionData,
  filename?: string
): void {
  const events = session.events || [];

  // Build CSV header
  const headers = ["id", "timestamp", "type", "label", "severity", "score", "model", "strategy"];
  const csvHeader = headers.join(",");

  // Build CSV rows
  const csvRows = events.map((event) => {
    const row = [
      event.id || "",
      event.ts || "",
      event.type || "",
      event.label || "",
      event.severity || "",
      event.meta?.score || "",
      event.meta?.model || "",
      event.meta?.strategy || "",
    ];

    // Escape values that contain commas or quotes
    return row.map((val) => {
      const str = String(val);
      if (str.includes(",") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",");
  });

  const csv = [csvHeader, ...csvRows].join("\n");
  const defaultFilename = `session_${session.sessionId}_${new Date().toISOString().split("T")[0]}.csv`;

  downloadBlob(csv, filename || defaultFilename, "text/csv");
}

/**
 * Exports single session events as CSV (Day 5)
 *
 * Optimized for exporting a single session with better formatting.
 * Includes ISO timestamps and full metadata in dedicated column.
 *
 * @param sessionId - Session ID to export
 * @param events - Array of events for this session
 * @param filename - Optional custom filename
 *
 * @example
 * exportSessionCsv("sess_123", sessionEvents);
 */
export function exportSessionCsv(
  sessionId: string,
  events: any[],
  filename?: string
): void {
  // Filter and sort events by this session
  const sessionEvents = events
    .filter((e) => e.sessionId === sessionId)
    .sort((a, b) => a.ts - b.ts);

  if (sessionEvents.length === 0) {
    alert("No events found for this session");
    return;
  }

  // Build CSV with enhanced columns
  const headers = ["ts", "timestamp_iso", "level", "type", "strategy", "message", "meta"];
  const csvHeader = headers.join(",");

  // Build rows with proper escaping
  const csvRows = sessionEvents.map((e) => {
    const row = [
      e.ts || "",
      e.ts ? new Date(e.ts).toISOString() : "",
      e.severity || e.level || "",
      e.type || "",
      e.meta?.strategy || e.strategy || "",
      (e.label || e.message || "").toString().replace(/\n/g, " "),
      JSON.stringify(e.meta ?? {}),
    ];

    // Escape each value
    return row
      .map((val) => {
        const str = String(val);
        // Always quote to handle commas, quotes, and newlines
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(",");
  });

  const csv = [csvHeader, ...csvRows].join("\n");
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const defaultFilename = `session_${sessionId}_${timestamp}.csv`;

  downloadBlob(csv, filename || defaultFilename, "text/csv");
}
