/**
 * Anomaly Detection Algorithms
 * Z-Score Robust, EWMA, and Fusion methods
 */

export type Point = { 
  t: number;  // timestamp
  v: number;  // value
};

export type DetectConfig = { 
  sensitivity?: number;  // 1..5 (higher number = less sensitive)
};

export type DetectResult = { 
  anomaly: boolean;
  score: number;
  reason: string;
  details?: Record<string, any>;
};

/**
 * Clamp value between min and max
 */
const clamp = (x: number, min: number, max: number) => 
  Math.max(min, Math.min(max, x));

/**
 * Calculate median of sorted array
 */
function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculate Median Absolute Deviation
 */
function medianAbsDev(arr: number[], medianVal: number): number {
  const deviations = arr.map(x => Math.abs(x - medianVal)).sort((a, b) => a - b);
  return median(deviations);
}

/**
 * Z-Score Robust Detection (Median + MAD)
 * More resistant to outliers than standard z-score
 */
export function zscoreRobust(
  series: Point[], 
  cfg: DetectConfig = {}
): DetectResult {
  // Need at least 8 points for meaningful statistics
  if (series.length < 8) {
    return { 
      anomaly: false, 
      score: 0, 
      reason: 'insufficient_data',
      details: { points: series.length }
    };
  }

  // Extract and sort values
  const values = series.map(p => p.v).sort((a, b) => a - b);
  const medianVal = median(values);
  const mad = medianAbsDev(values, medianVal) || 1e-6; // Avoid division by zero
  
  // Calculate robust z-score for last point
  const last = series[series.length - 1].v;
  const z = Math.abs((last - medianVal) / (1.4826 * mad));
  
  // Adjust threshold based on sensitivity
  const sens = clamp(cfg.sensitivity ?? 3, 1, 5);
  const baseThreshold = 3.5;
  const threshold = baseThreshold + (sens - 3) * 0.7;
  
  return {
    anomaly: z > threshold,
    score: z,
    reason: `z=${z.toFixed(2)} (threshold=${threshold.toFixed(1)})`,
    details: {
      median: medianVal,
      mad,
      lastValue: last,
      threshold,
      sensitivity: sens
    }
  };
}

/**
 * Exponential Weighted Moving Average (EWMA) Detection
 * Adapts quickly to trends while smoothing noise
 */
export function ewma(
  series: Point[], 
  cfg: DetectConfig = {}
): DetectResult {
  if (series.length < 8) {
    return { 
      anomaly: false, 
      score: 0, 
      reason: 'insufficient_data',
      details: { points: series.length }
    };
  }

  // EWMA parameters
  const alpha = 0.3; // Smoothing factor (0 < α < 1)
  let mean = series[0].v;
  let variance = 0;

  // Calculate EWMA mean and variance
  for (let i = 1; i < series.length; i++) {
    const x = series[i].v;
    const prevMean = mean;
    mean = alpha * x + (1 - alpha) * mean;
    variance = alpha * Math.pow(x - mean, 2) + (1 - alpha) * variance;
  }

  const sigma = Math.sqrt(variance) || 1e-6;
  const last = series[series.length - 1].v;
  const distance = Math.abs(last - mean) / sigma;

  // Adjust threshold based on sensitivity
  const sens = clamp(cfg.sensitivity ?? 3, 1, 5);
  const baseThreshold = 3;
  const threshold = baseThreshold + (sens - 3) * 0.6;

  return {
    anomaly: distance > threshold,
    score: distance,
    reason: `ewma=${distance.toFixed(2)} (threshold=${threshold.toFixed(1)})`,
    details: {
      mean,
      sigma,
      lastValue: last,
      threshold,
      sensitivity: sens
    }
  };
}

/**
 * Fuse multiple detector results
 * Uses weighted voting to reduce false positives
 */
export function fuse(
  r1: DetectResult,
  r2: DetectResult,
  w1: number = 0.5,
  w2: number = 0.5
): DetectResult {
  // Weighted score
  const score = w1 * r1.score + w2 * r2.score;
  
  // Anomaly if:
  // 1. Both detectors agree, OR
  // 2. Weighted score exceeds high threshold
  const anomaly = (r1.anomaly && r2.anomaly) || score > 4.5;

  return {
    anomaly,
    score,
    reason: `fusion(${r1.reason} + ${r2.reason})`,
    details: {
      detector1: r1,
      detector2: r2,
      weights: [w1, w2],
      combinedScore: score
    }
  };
}

/**
 * Calculate severity level based on score
 */
export function calculateSeverity(score: number): 'low' | 'medium' | 'high' {
  if (score > 8) return 'high';
  if (score > 6) return 'medium';
  return 'low';
}

/**
 * Format detection result for display
 */
export function formatResult(result: DetectResult): string {
  const status = result.anomaly ? '🚨 ANOMALY' : '✅ NORMAL';
  const score = result.score.toFixed(2);
  return `${status} - Score: ${score} - ${result.reason}`;
}

