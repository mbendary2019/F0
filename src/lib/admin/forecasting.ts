/**
 * Forecasting Utilities
 * Helper functions for working with prediction data
 */

export type ForecastDoc = {
  metric: 'calls' | 'errors' | 'latency_p95';
  endpoint?: string;
  t: number;
  horizonMin: number;
  forecast: number[];
  upper: number[];
  lower: number[];
  conf: number;
};

export type RiskLevel = 'low' | 'medium' | 'high';

export type WindowRisk = {
  next: number;
  upper: number;
  risk: RiskLevel;
};

/**
 * Calculate risk level for next time window based on forecast and threshold
 */
export function nextWindowRisk(
  forecast: ForecastDoc,
  threshold: number
): WindowRisk {
  const next = forecast.forecast?.[0] ?? 0;
  const upper = forecast.upper?.[0] ?? next;
  
  // Determine risk level
  let risk: RiskLevel;
  if (upper >= threshold) {
    risk = 'high';
  } else if (next >= threshold) {
    risk = 'medium';
  } else {
    risk = 'low';
  }
  
  return { next, upper, risk };
}

/**
 * Calculate average forecast value across horizon
 */
export function averageForecast(forecast: ForecastDoc): number {
  if (!forecast.forecast || forecast.forecast.length === 0) {
    return 0;
  }
  
  const sum = forecast.forecast.reduce((a, b) => a + b, 0);
  return sum / forecast.forecast.length;
}

/**
 * Get confidence interval width
 */
export function confidenceWidth(forecast: ForecastDoc, index: number = 0): number {
  const upper = forecast.upper?.[index] ?? 0;
  const lower = forecast.lower?.[index] ?? 0;
  return upper - lower;
}

/**
 * Check if forecast exceeds threshold at any point in horizon
 */
export function exceedsThreshold(
  forecast: ForecastDoc,
  threshold: number
): boolean {
  if (!forecast.forecast) return false;
  
  return forecast.forecast.some(value => value >= threshold);
}

/**
 * Get time when threshold will be exceeded (in minutes from now)
 */
export function timeToThreshold(
  forecast: ForecastDoc,
  threshold: number
): number | null {
  if (!forecast.forecast) return null;
  
  const exceedIndex = forecast.forecast.findIndex(value => value >= threshold);
  
  if (exceedIndex === -1) return null;
  
  return exceedIndex * forecast.horizonMin;
}

/**
 * Format forecast for display
 */
export function formatForecast(forecast: ForecastDoc): string {
  const next = forecast.forecast?.[0];
  const upper = forecast.upper?.[0];
  const lower = forecast.lower?.[0];
  
  if (next === undefined) return 'N/A';
  
  return `${next.toFixed(1)} (${lower?.toFixed(1)} - ${upper?.toFixed(1)})`;
}

/**
 * Calculate trend from forecast
 */
export function calculateTrend(forecast: ForecastDoc): 'increasing' | 'decreasing' | 'stable' {
  if (!forecast.forecast || forecast.forecast.length < 2) {
    return 'stable';
  }
  
  const first = forecast.forecast[0];
  const last = forecast.forecast[forecast.forecast.length - 1];
  const change = (last - first) / Math.max(1, first);
  
  if (change > 0.1) return 'increasing';
  if (change < -0.1) return 'decreasing';
  return 'stable';
}

