import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

const TZ = "Asia/Kuwait";
const DAY_MS = 24 * 60 * 60 * 1000;

type DailyDoc = {
  date: string;
  total: number; info: number; warn: number; error: number;
  avgLatency: number; p50Latency: number; p95Latency: number;
  byType?: Record<string, number>;
  byStrategy?: Record<string, number>;
  updatedAt: number;
};

function ymdUTC(date: Date) { return date.toISOString().slice(0,10); }
function startOfDayUTC(d: Date) {
  const iso = ymdUTC(d); return new Date(`${iso}T00:00:00.000Z`).getTime();
}
function pctDelta(curr: number, prev: number) {
  if (!prev) return curr ? 100 : 0;
  return +(((curr - prev) / prev) * 100).toFixed(2);
}
function topN(obj: Record<string, number> = {}, n = 5) {
  return Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0, n);
}
function zScore(v: number, arr: number[]) {
  if (!arr.length) return 0;
  const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
  const sd = Math.sqrt(arr.reduce((a,b)=>a+(b-mean)**2,0) / arr.length) || 1;
  return +(((v - mean) / sd)).toFixed(2);
}

async function getDaily(db: FirebaseFirestore.Firestore, dateYMD: string) {
  const snap = await db.collection("ops_metrics_daily").doc(dateYMD).get();
  return snap.exists ? (snap.data() as DailyDoc) : null;
}

async function buildInsightFor(dateYMD: string) {
  const db = getFirestore();
  // اليوم المستهدف + آخر 7 أيام للمقارنة
  const target = await getDaily(db, dateYMD);
  if (!target) throw new Error(`No metrics for ${dateYMD}`);

  const days: DailyDoc[] = [target];
  for (let i = 1; i <= 7; i++) {
    const d = ymdUTC(new Date(startOfDayUTC(new Date()) - DAY_MS * ( (startOfDayUTC(new Date()) > Date.parse(`${dateYMD}T00:00:00Z`) ? i : i+1) )));
    const doc = await getDaily(db, d);
    if (doc) days.push(doc);
  }

  // مقارنات (اليوم المستهدف مقابل أقرب يوم سابق متوفر)
  const prev = days[1] || null;

  const deltas = {
    total: prev ? pctDelta(target.total, prev.total) : 0,
    error: prev ? pctDelta(target.error, prev.error) : 0,
    avgLatency: prev ? pctDelta(target.avgLatency, prev.avgLatency) : 0,
    p95Latency: prev ? pctDelta(target.p95Latency, prev.p95Latency) : 0,
  };

  // انحرافات (z-score) على سلسلة lats/errors
  const p95Series = days.slice(1).map(d => d.p95Latency).filter(Boolean);
  const errSeries = days.slice(1).map(d => d.error).filter(Boolean);
  const z = {
    p95: zScore(target.p95Latency, p95Series),
    error: zScore(target.error, errSeries),
  };

  const topTypes = topN(target.byType ?? {}, 5);
  const topStrats = topN(target.byStrategy ?? {}, 5);

  // رسائل جاهزة بالعربية والإنجليزية (مختصرة وواضحة)
  const trendEN: string[] = [];
  const trendAR: string[] = [];

  // إجمالي/أخطاء
  if (prev) {
    trendEN.push(`Total events ${deltas.total >= 0 ? "up" : "down"} ${Math.abs(deltas.total)}% vs previous day.`);
    trendAR.push(`إجمالي الأحداث ${deltas.total >= 0 ? "ارتفع" : "انخفض"} بنسبة ${Math.abs(deltas.total)}٪ مقارنة باليوم السابق.`);
    trendEN.push(`Errors ${deltas.error >= 0 ? "up" : "down"} ${Math.abs(deltas.error)}% (z=${z.error}).`);
    trendAR.push(`الأخطاء ${deltas.error >= 0 ? "زادت" : "انخفضت"} بنسبة ${Math.abs(deltas.error)}٪ (قيمة Z=${z.error}).`);
    trendEN.push(`Avg latency ${deltas.avgLatency >= 0 ? "up" : "down"} ${Math.abs(deltas.avgLatency)}%; p95 ${deltas.p95Latency >= 0 ? "up" : "down"} ${Math.abs(deltas.p95Latency)}% (z=${z.p95}).`);
    trendAR.push(`متوسط التأخير ${deltas.avgLatency >= 0 ? "زاد" : "انخفض"} بنسبة ${Math.abs(deltas.avgLatency)}٪؛ و p95 ${deltas.p95Latency >= 0 ? "زاد" : "انخفض"} بنسبة ${Math.abs(deltas.p95Latency)}٪ (قيمة Z=${z.p95}).`);
  } else {
    trendEN.push(`No previous day found. Baseline established for ${dateYMD}.`);
    trendAR.push(`لا توجد بيانات لليوم السابق — تم إنشاء خط أساس لتاريخ ${dateYMD}.`);
  }

  // أفضل الأنواع/الاستراتيجيات
  if (topTypes.length) {
    const en = topTypes.map(([k,v]) => `${k}: ${v}`).join(", ");
    const ar = topTypes.map(([k,v]) => `${k}: ${v}`).join("، ");
    trendEN.push(`Top types: ${en}.`);
    trendAR.push(`أكثر الأنواع نشاطًا: ${ar}.`);
  }
  if (topStrats.length) {
    const en = topStrats.map(([k,v]) => `${k}: ${v}`).join(", ");
    const ar = topStrats.map(([k,v]) => `${k}: ${v}`).join("، ");
    trendEN.push(`Top strategies: ${en}.`);
    trendAR.push(`أكثر الاستراتيجيات استخدامًا: ${ar}.`);
  }

  const insights = {
    date: dateYMD,
    stats: {
      target,
      deltas, z,
      topTypes: Object.fromEntries(topTypes),
      topStrategies: Object.fromEntries(topStrats),
    },
    summary: {
      en: trendEN.join(" "),
      ar: trendAR.join(" "),
    },
    createdAt: Date.now(),
  };

  // اكتب داخل وثيقة التقرير اليومية (نُحدّث doc اليوم إن وُجد)
  await db.collection("ops_reports").doc(dateYMD).set({ insights }, { merge: true });
  return insights;
}

/** 1) Scheduler — 02:25 Asia/Kuwait (بعد إنشاء التقارير بدقيقة) */
export const generateTrendInsights = onSchedule(
  { schedule: "25 2 * * *", timeZone: TZ, memory: "256MiB", timeoutSeconds: 90 },
  async () => {
    const end = startOfDayUTC(new Date());
    const dateYMD = ymdUTC(new Date(end - DAY_MS));
    await buildInsightFor(dateYMD);
  }
);

/** 2) Backfill callable (Admin) — إعادة بناء الملخص لآخر N أيام */
export const generateTrendInsightsBackfill = onCall(
  { region: "us-central1", cors: true, memory: "256MiB", timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth?.token?.admin) throw new HttpsError("permission-denied", "Admin only.");
    const days = Math.max(1, Math.min(60, Number(request.data?.days ?? 7)));
    const results: any[] = [];
    for (let i=1; i<=days; i++) {
      const end = startOfDayUTC(new Date()) - DAY_MS*(i-1);
      const d = ymdUTC(new Date(end - DAY_MS));
      try { results.push(await buildInsightFor(d)); }
      catch (e:any) { results.push({ date: d, error: e?.message || String(e) }); }
    }
    return { success: true, results };
  }
);
