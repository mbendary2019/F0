/**
 * Phase 63 Day 3: Daily Report Generation
 * Scheduled function to generate PDF and XLSX reports from daily metrics
 * Includes backfill capability for historical reports
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import ExcelJS from "exceljs";

const TZ = "Asia/Kuwait";
const BUCKET = process.env.REPORTS_BUCKET || process.env.GCLOUD_STORAGE_BUCKET;
const DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================
// TYPE DEFINITIONS
// ============================================================

type DailyDoc = {
  date: string;
  total: number;
  info: number;
  warn: number;
  error: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  byType?: Record<string, number>;
  byStrategy?: Record<string, number>;
  updatedAt: number;
};

type FileMetadata = {
  path: string;
  size: number;
  contentType: string;
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Format date as yyyy-mm-dd in UTC
 */
function ymdUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Get start of day (00:00:00.000) in UTC
 */
function startOfDayUTC(d: Date): number {
  const iso = ymdUTC(d);
  return new Date(`${iso}T00:00:00.000Z`).getTime();
}

/**
 * Fetch daily metrics for a specific date
 */
async function fetchDaily(dateYMD: string): Promise<DailyDoc | null> {
  const db = getFirestore();
  const snap = await db.collection("ops_metrics_daily").doc(dateYMD).get();
  return snap.exists ? (snap.data() as DailyDoc) : null;
}

/**
 * Get top N entries from a record, sorted by count descending
 */
function topN(obj: Record<string, number> = {}, n = 5): Array<[string, number]> {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

// ============================================================
// PDF GENERATION
// ============================================================

/**
 * Generate PDF report buffer from daily metrics
 */
async function makePdfBuffer(d: DailyDoc): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4 size
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const draw = (text: string, bold = false, size = 12) => {
    page.drawText(text, {
      x: 50,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= size + 10;
  };

  // Header
  draw("From Zero Labs — Ops Daily Report", true, 18);
  draw(`Date (UTC): ${d.date}`, false, 12);
  y -= 10; // Extra spacing

  // Summary Section
  draw("Summary", true, 14);
  draw(`Total Events: ${d.total.toLocaleString()}`);
  draw(`Info: ${d.info.toLocaleString()}   Warn: ${d.warn.toLocaleString()}   Error: ${d.error.toLocaleString()}`);
  draw(`Error Rate: ${d.total ? ((d.error / d.total) * 100).toFixed(2) : 0}%`);
  y -= 10;

  // Latency Section
  draw("Latency Metrics", true, 14);
  draw(`Average: ${d.avgLatency} ms`);
  draw(`p50 (Median): ${d.p50Latency} ms`);
  draw(`p95 (95th percentile): ${d.p95Latency} ms`);
  y -= 10;

  // Top Event Types
  draw("Top Event Types", true, 14);
  const topTypes = topN(d.byType ?? {}, 8);
  if (topTypes.length === 0) {
    draw("  No event types recorded", false, 10);
  } else {
    for (const [k, v] of topTypes) {
      draw(`  • ${k}: ${v.toLocaleString()}`, false, 10);
    }
  }
  y -= 10;

  // Top Strategies
  draw("Top Strategies", true, 14);
  const topStrategies = topN(d.byStrategy ?? {}, 8);
  if (topStrategies.length === 0) {
    draw("  No strategies recorded", false, 10);
  } else {
    for (const [k, v] of topStrategies) {
      draw(`  • ${k}: ${v.toLocaleString()}`, false, 10);
    }
  }

  // Footer
  y = 50;
  draw(`Generated at: ${new Date().toISOString()}`, false, 8);
  draw("From Zero Labs - Operations Analytics", false, 8);

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

// ============================================================
// EXCEL GENERATION
// ============================================================

/**
 * Generate XLSX report buffer from daily metrics
 */
async function makeXlsxBuffer(d: DailyDoc): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "From Zero Labs";
  wb.created = new Date();
  wb.modified = new Date();

  // Sheet 1: KPIs
  const s1 = wb.addWorksheet("KPIs");
  s1.columns = [
    { header: "Metric", key: "metric", width: 24 },
    { header: "Value", key: "value", width: 18 },
  ];

  // Style header
  s1.getRow(1).font = { bold: true };
  s1.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  s1.addRows([
    { metric: "Date", value: d.date },
    { metric: "Total Events", value: d.total },
    { metric: "Info", value: d.info },
    { metric: "Warn", value: d.warn },
    { metric: "Error", value: d.error },
    { metric: "Error Rate (%)", value: d.total ? ((d.error / d.total) * 100).toFixed(2) : 0 },
    { metric: "Avg Latency (ms)", value: d.avgLatency },
    { metric: "p50 Latency (ms)", value: d.p50Latency },
    { metric: "p95 Latency (ms)", value: d.p95Latency },
    { metric: "Updated At (unix ms)", value: d.updatedAt },
  ]);

  // Sheet 2: Event Types
  const s2 = wb.addWorksheet("Event Types");
  s2.columns = [
    { header: "Type", key: "type", width: 32 },
    { header: "Count", key: "count", width: 14 },
  ];
  s2.getRow(1).font = { bold: true };
  s2.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  const types = Object.entries(d.byType ?? {}).sort((a, b) => b[1] - a[1]);
  types.forEach(([k, v]) => s2.addRow({ type: k, count: v }));

  // Sheet 3: Strategies
  const s3 = wb.addWorksheet("Strategies");
  s3.columns = [
    { header: "Strategy", key: "strategy", width: 32 },
    { header: "Count", key: "count", width: 14 },
  ];
  s3.getRow(1).font = { bold: true };
  s3.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  const strategies = Object.entries(d.byStrategy ?? {}).sort((a, b) => b[1] - a[1]);
  strategies.forEach(([k, v]) => s3.addRow({ strategy: k, count: v }));

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ============================================================
// STORAGE UPLOAD
// ============================================================

/**
 * Upload buffer to Cloud Storage and return metadata
 */
async function uploadBuffer(
  buf: Buffer,
  path: string,
  contentType: string
): Promise<FileMetadata> {
  const bucket = getStorage().bucket(BUCKET);
  const file = bucket.file(path);

  await file.save(buf, {
    contentType,
    resumable: false,
    public: false,
    metadata: {
      cacheControl: "private, max-age=3600",
    },
  });

  const [metadata] = await file.getMetadata();
  return {
    path,
    size: Number(metadata.size || buf.length),
    contentType,
  };
}

/**
 * Write report document to Firestore
 */
async function writeReportDoc(
  dateYMD: string,
  files: { pdf?: FileMetadata; xlsx?: FileMetadata }
) {
  const db = getFirestore();
  await db
    .collection("ops_reports")
    .doc(dateYMD)
    .set(
      {
        date: dateYMD,
        files,
        createdAt: Date.now(),
      },
      { merge: true }
    );
}

// ============================================================
// MAIN REPORT GENERATION
// ============================================================

/**
 * Build and store complete report (PDF + XLSX) for a date
 */
async function buildAndStoreReport(dateYMD: string) {
  console.log(`📊 Generating report for ${dateYMD}...`);

  // Fetch metrics
  const data = await fetchDaily(dateYMD);
  if (!data) {
    throw new Error(`No metrics found for ${dateYMD}`);
  }

  // Generate reports
  console.log(`  → Generating PDF...`);
  const pdf = await makePdfBuffer(data);

  console.log(`  → Generating XLSX...`);
  const xlsx = await makeXlsxBuffer(data);

  // Upload to storage
  const base = `reports/daily/${dateYMD}`;
  console.log(`  → Uploading to Storage...`);

  const [pMeta, xMeta] = await Promise.all([
    uploadBuffer(pdf, `${base}/report-${dateYMD}.pdf`, "application/pdf"),
    uploadBuffer(xlsx, `${base}/report-${dateYMD}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  ]);

  // Write metadata to Firestore
  console.log(`  → Writing metadata to Firestore...`);
  await writeReportDoc(dateYMD, { pdf: pMeta, xlsx: xMeta });

  console.log(`✅ Report generated for ${dateYMD}: PDF (${pMeta.size} bytes), XLSX (${xMeta.size} bytes)`);

  return {
    date: dateYMD,
    pdf: pMeta,
    xlsx: xMeta,
  };
}

// ============================================================
// SCHEDULED FUNCTION (runs daily at 02:20 Asia/Kuwait)
// ============================================================

export const generateDailyReport = onSchedule(
  {
    schedule: "20 2 * * *", // 02:20 every day
    timeZone: TZ,
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async () => {
    console.log("🚀 Starting daily report generation...");

    // Generate report for yesterday (previous complete day)
    const end = startOfDayUTC(new Date()); // Today 00:00 UTC
    const yesterday = new Date(end - DAY_MS);
    const dateYMD = ymdUTC(yesterday);

    try {
      await buildAndStoreReport(dateYMD);
      console.log("✅ Daily report generation complete");
    } catch (error: any) {
      console.error("❌ Daily report generation failed:", error);
      throw error;
    }
  }
);

// ============================================================
// BACKFILL CALLABLE (admin-only)
// ============================================================

export const generateDailyReportBackfill = onCall(
  {
    region: "us-central1",
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 540, // 9 minutes
  },
  async (request) => {
    // Admin-only guard
    if (!request.auth?.token?.admin) {
      throw new HttpsError("permission-denied", "Admin access required");
    }

    // Validate input: days (1-60, default 7)
    const days = Math.max(1, Math.min(60, Number(request.data?.days ?? 7)));

    console.log(`🔄 Starting backfill for last ${days} days...`);

    const results: any[] = [];

    // Process each day
    for (let i = 1; i <= days; i++) {
      const end = startOfDayUTC(new Date()) - DAY_MS * (i - 1);
      const dateYMD = ymdUTC(new Date(end - DAY_MS));

      try {
        const result = await buildAndStoreReport(dateYMD);
        results.push(result);
      } catch (e: any) {
        console.error(`  ❌ Failed for ${dateYMD}:`, e.message);
        results.push({
          date: dateYMD,
          error: e?.message || String(e),
        });
      }
    }

    console.log(`✅ Backfill complete: ${results.length} days processed`);

    return {
      success: true,
      processed: results.length,
      results,
    };
  }
);
