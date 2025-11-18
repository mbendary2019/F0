/**
 * Forecast Engine - Predictive Analytics
 * Simple Moving Average (SMA) based forecasting with confidence intervals
 * ARIMA-lite alternative: upgradeable to ML models later
 */

import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';

export type SeriesPoint = { 
  t: number;  // timestamp
  v: number;  // value
};

export type ForecastOut = { 
  metric: string; 
  endpoint?: string; 
  t: number; 
  horizonMin: number; 
  forecast: number[]; 
  upper: number[]; 
  lower: number[]; 
  conf: number;
};

/**
 * Simple Moving Average Forecast
 * Uses recent window to predict future values with confidence intervals
 */
function smaForecast(values: number[], horizon: number, windowSize = 12) {
  const n = values.length;
  
  // Use recent window for baseline
  const window = values.slice(Math.max(0, n - windowSize));
  const mean = window.reduce((a, b) => a + b, 0) / Math.max(1, window.length);
  const variance = window.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / Math.max(1, window.length);
  const std = Math.sqrt(variance);
  
  // Generate forecast (constant for SMA, but maintains recent trend)
  const forecast = Array(horizon).fill(Math.max(0, mean));
  
  // 95% confidence intervals (1.96 * std)
  const upper = forecast.map(x => x + 1.96 * std);
  const lower = forecast.map(x => Math.max(0, x - 1.96 * std));
  
  return { 
    f: forecast, 
    upper, 
    lower, 
    mean, 
    std 
  };
}

/**
 * Load time series data from Firestore
 * Falls back to admin_audit if api_metrics_daily not available
 */
async function loadSeries(
  db: FirebaseFirestore.Firestore, 
  metric: 'calls' | 'errors' | 'latency_p95', 
  minutesBack: number, 
  endpoint?: string
): Promise<SeriesPoint[]> {
  const since = Date.now() - minutesBack * 60_000;
  const points: SeriesPoint[] = [];
  
  try {
    // Try to load from api_metrics_daily (preferred)
    const snap = await db
      .collection('api_metrics_daily')
      .where('ts', '>=', since)
      .orderBy('ts', 'asc')
      .limit(2000)
      .get();
    
    if (!snap.empty) {
      snap.forEach(doc => {
        const row = doc.data() as any;
        let value = 0;
        
        if (endpoint && row.endpoints?.[endpoint]) {
          value = Number(row.endpoints[endpoint][metric]) || 0;
        } else {
          value = Number(row[metric]) || 0;
        }
        
        points.push({ 
          t: row.ts ?? Date.now(), 
          v: value 
        });
      });
      
      console.log(`[forecastEngine] Loaded ${points.length} points from api_metrics_daily for ${metric}`);
      return points;
    }
  } catch (err) {
    console.warn('[forecastEngine] api_metrics_daily not available, using fallback');
  }
  
  // Fallback: estimate from admin_audit
  try {
    const auditSnap = await db
      .collection('admin_audit')
      .where('ts', '>=', since)
      .get();
    
    const buckets = new Map<number, number>();
    
    auditSnap.docs.forEach(doc => {
      const ts = doc.get('ts') as number;
      const bucket = Math.floor(ts / 60_000) * 60_000; // Round to minute
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    });
    
    // Convert to points array
    const sortedEntries = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
    for (const [t, v] of sortedEntries) {
      points.push({ t, v });
    }
    
    console.log(`[forecastEngine] Fallback: loaded ${points.length} points from admin_audit`);
  } catch (err) {
    console.error('[forecastEngine] Error loading fallback data:', err);
  }
  
  return points;
}

/**
 * Forecast Engine Cloud Function
 * Runs every 15 minutes to generate predictions
 */
export const forecastEngine = functions.pubsub
  .schedule('every 15 minutes')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('[forecastEngine] Starting forecast generation');
    
    const db = getFirestore();
    const metrics: Array<'calls' | 'errors' | 'latency_p95'> = ['calls', 'errors', 'latency_p95'];
    const horizon = 6; // 6 time steps ahead (6 × 15min = 90 minutes)
    const lookbackMinutes = 24 * 60; // Last 24 hours
    
    let forecastCount = 0;
    
    for (const metric of metrics) {
      try {
        // Load historical data
        const series = await loadSeries(db, metric, lookbackMinutes);
        
        if (series.length < 6) {
          console.log(`[forecastEngine] Insufficient data for ${metric}: ${series.length} points`);
          continue;
        }
        
        // Extract values
        const values = series.map(p => p.v);
        
        // Generate forecast using SMA
        const { f: forecast, upper, lower } = smaForecast(values, horizon, 24);
        
        // Store forecast
        const forecastDoc: ForecastOut = {
          metric,
          t: Date.now(),
          horizonMin: 15, // Each step is 15 minutes
          forecast,
          upper,
          lower,
          conf: 0.95 // 95% confidence
        };
        
        await db.collection('predictions_daily').add(forecastDoc);
        forecastCount++;
        
        console.log(`[forecastEngine] Generated forecast for ${metric}: ${forecast[0].toFixed(2)} (next 15min)`);
      } catch (err) {
        console.error(`[forecastEngine] Error forecasting ${metric}:`, err);
      }
    }
    
    console.log(`[forecastEngine] Completed: ${forecastCount}/${metrics.length} forecasts generated`);
    return null;
  });

/**
 * Cleanup old predictions (keep last 7 days)
 */
export const cleanupPredictions = functions.pubsub
  .schedule('every 24 hours')
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = getFirestore();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    try {
      const oldPredictions = await db
        .collection('predictions_daily')
        .where('t', '<', sevenDaysAgo)
        .limit(500)
        .get();
      
      if (oldPredictions.empty) {
        console.log('[cleanupPredictions] No old predictions to clean');
        return null;
      }
      
      const batch = db.batch();
      oldPredictions.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`[cleanupPredictions] Deleted ${oldPredictions.size} old predictions`);
    } catch (err) {
      console.error('[cleanupPredictions] Error:', err);
    }
    
    return null;
  });

