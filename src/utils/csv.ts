/**
 * CSV Export Utility
 *
 * Converts array of objects to CSV format with proper escaping.
 * Handles edge cases like:
 * - Commas in values
 * - Quotes in values (escaped as "")
 * - Newlines in values
 * - Null/undefined values
 * - Heterogeneous objects (different keys)
 */

export interface CsvOptions {
  /**
   * Field separator (default: comma)
   */
  sep?: string;
}

/**
 * Converts an array of objects to CSV string
 *
 * @param rows - Array of objects to convert
 * @param opts - Options (separator, etc.)
 * @returns CSV string with headers
 *
 * @example
 * const data = [
 *   { name: "Alice", score: 0.95 },
 *   { name: "Bob", score: 0.87 }
 * ];
 * const csv = toCSV(data);
 * // "name,score\nAlice,0.95\nBob,0.87"
 */
export function toCSV(rows: Record<string, any>[], opts: CsvOptions = {}): string {
  if (!rows?.length) return "";

  const sep = opts.sep ?? ",";

  // Collect all unique keys across all rows
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));

  // Escape function for CSV values
  const esc = (s: any): string => {
    if (s == null) return "";
    const str = String(s).replace(/"/g, '""'); // Escape quotes by doubling them
    // Wrap in quotes if contains separator, quotes, or newlines
    return /[",\n]/.test(str) ? `"${str}"` : str;
  };

  // Build header row
  const headerRow = headers.join(sep);

  // Build data rows
  const dataRows = rows.map((r) => headers.map((h) => esc(r[h])).join(sep));

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Downloads CSV data as a file
 *
 * @param rows - Array of objects to export
 * @param filename - Name of the downloaded file
 * @param opts - CSV options
 *
 * @example
 * downloadCSV(timelineItems, "timeline-export.csv");
 */
export function downloadCSV(
  rows: Record<string, any>[],
  filename = "export.csv",
  opts: CsvOptions = {}
): void {
  const csv = toCSV(rows, opts);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
