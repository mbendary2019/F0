/**
 * Model Drift Detection
 * Monitor model performance over time and detect degradation
 */

import { db } from './firebase-admin';
import { alert } from './alerts';

// ---------- Types ----------
export interface ModelMetrics {
  accuracy?: number;
  latency_p50?: number;
  latency_p95?: number;
  cost_est?: number;
  error_rate?: number;
  [key: string]: number | undefined;
}

export interface ModelStats {
  date: string; // YYYYMMDD
  model: string;
  metrics: ModelMetrics;
  sample_count?: number;
  createdAt: Date;
}

export interface DriftDetection {
  model: string;
  metric: string;
  current_value: number;
  baseline_value: number;
  drift_pct: number; // 0..1
  threshold_pct: number;
  is_drifting: boolean;
  severity: 'info' | 'warning' | 'critical';
}

// ---------- Helpers ----------
function getDateKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// Encode model id to be safe for Firestore doc ids (no slashes, etc.)
function encodeModelId(model: string): string {
  return Buffer.from(model, 'utf8').toString('base64url');
}

function decodeModelId(id: string): string {
  return Buffer.from(id, 'base64url').toString('utf8');
}

// Subcollection ref: model_stats_daily/{day}/models
function modelsCol(dayKey: string) {
  return db.collection('model_stats_daily').doc(dayKey).collection('models');
}

// ---------- Write ----------
export async function recordModelMetrics(params: {
  model: string;
  metrics: ModelMetrics;
  sample_count?: number;   // optional incremental samples for the day
  date?: Date;
}): Promise<void> {
  const { model, metrics, sample_count, date = new Date() } = params;
  const dateKey = getDateKey(date);
  const modelId = encodeModelId(model);

  try {
    await modelsCol(dateKey).doc(modelId).set(
      {
        date: dateKey,
        model,
        metrics,
        ...(typeof sample_count === 'number' ? { sample_count } : {}),
        createdAt: new Date(),
      },
      { merge: true }
    );

    console.log(`[recordModelMetrics] Recorded metrics for ${model} on ${dateKey}`);
  } catch (error) {
    console.error('[recordModelMetrics] Error:', error);
    throw error;
  }
}

// ---------- Read ----------
export async function getModelMetrics(params: {
  model: string;
  days: number;
}): Promise<ModelStats[]> {
  const { model, days } = params;
  const now = new Date();
  const modelId = encodeModelId(model);

  const stats: ModelStats[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - i);
    const dateKey = getDateKey(date);

    try {
      const snap = await modelsCol(dateKey).doc(modelId).get();
      if (snap.exists) {
        const data = snap.data() as any;
        stats.push({
          date: data.date ?? dateKey,
          model: data.model ?? model,
          metrics: data.metrics ?? {},
          sample_count: data.sample_count,
          createdAt: data.createdAt?.toDate?.() || new Date(),
        });
      }
    } catch (error) {
      console.error(`[getModelMetrics] Error fetching ${dateKey}:`, error);
    }
  }

  return stats.reverse();
}

// ---------- Baseline ----------
function calculateBaseline(stats: ModelStats[], metric: string): number {
  const values = stats
    .map((s) => s.metrics[metric])
    .filter((v): v is number => v !== undefined);

  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// ---------- Drift ----------
export async function detectDrift(params: {
  model: string;
  metrics?: string[];
}): Promise<DriftDetection[]> {
  const { model, metrics: metricsToCheck } = params;

  const baselineDays = Number(process.env.DRIFT_BASELINE_DAYS || 7);
  const thresholdPct = Number(process.env.DRIFT_ALERT_THRESHOLD_PCT || 0.07);

  console.log(
    `[detectDrift] ${model} | baseline=${baselineDays}d | threshold=${(thresholdPct * 100).toFixed(1)}%`
  );

  const stats = await getModelMetrics({ model, days: baselineDays + 1 });
  if (stats.length < 2) {
    console.log(`[detectDrift] Not enough data for ${model}`);
    return [];
  }

  const currentStats = stats[stats.length - 1];
  const baselineStats = stats.slice(0, -1);
  const available = Object.keys(currentStats.metrics);
  const toAnalyze = metricsToCheck || available;

  const results: DriftDetection[] = [];

  for (const metric of toAnalyze) {
    const currentValue = currentStats.metrics[metric];
    if (currentValue === undefined) continue;

    const baselineValue = calculateBaseline(baselineStats, metric);
    if (baselineValue === 0) continue; // avoid div-by-zero; treat as insufficient baseline

    const driftPct = Math.abs((currentValue - baselineValue) / baselineValue);
    const is_drifting = driftPct >= thresholdPct;

    let severity: DriftDetection['severity'] = 'info';
    if (is_drifting) severity = driftPct >= thresholdPct * 2 ? 'critical' : 'warning';

    results.push({
      model,
      metric,
      current_value: currentValue,
      baseline_value: baselineValue,
      drift_pct: driftPct,
      threshold_pct: thresholdPct,
      is_drifting,
      severity,
    });

    console.log(
      `[detectDrift] ${model}.${metric}: ${Number(currentValue).toFixed(3)} vs ${Number(
        baselineValue
      ).toFixed(3)} (drift ${(driftPct * 100).toFixed(1)}%)`
    );
  }

  return results;
}

export async function checkAllModelsDrift(): Promise<{
  models_checked: number;
  drift_detected: DriftDetection[];
}> {
  console.log('[checkAllModelsDrift] Starting drift detection for all models');

  const dateKey = getDateKey();
  const snap = await modelsCol(dateKey).get();

  const models = new Set<string>();
  snap.forEach((doc) => {
    const data = doc.data() as any;
    models.add(data.model || decodeModelId(doc.id));
  });

  console.log(`[checkAllModelsDrift] Found ${models.size} models to check`);

  const allDrift: DriftDetection[] = [];

  for (const model of Array.from(models)) {
    try {
      const drift = await detectDrift({ model });
      const drifting = drift.filter((d) => d.is_drifting);

      if (drifting.length > 0) {
        allDrift.push(...drifting);

        const critical = drifting.some((d) => d.severity === 'critical');
        await alert({
          severity: critical ? 'critical' : 'warning',
          kind: 'custom',
          message: `Model drift detected for ${model}: ${drifting.length} metric(s) drifting`,
          context: {
            model,
            drifting_metrics: drifting.map((d) => ({
              metric: d.metric,
              drift_pct: `${(d.drift_pct * 100).toFixed(1)}%`,
              current: d.current_value,
              baseline: d.baseline_value,
            })),
          },
        });
      }
    } catch (error) {
      console.error(`[checkAllModelsDrift] Error checking ${model}:`, error);
    }
  }

  console.log(
    `[checkAllModelsDrift] Detected drift in ${allDrift.length} metrics across ${models.size} models`
  );

  return { models_checked: models.size, drift_detected: allDrift };
}

export async function getDriftStatus(model: string): Promise<{
  model: string;
  last_check: Date;
  is_drifting: boolean;
  drift_details: DriftDetection[];
}> {
  const drift = await detectDrift({ model });
  return {
    model,
    last_check: new Date(),
    is_drifting: drift.some((d) => d.is_drifting),
    drift_details: drift,
  };
}
