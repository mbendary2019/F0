/**
 * Root Cause Analysis Engine
 * Calculates correlations between metrics to identify relationships
 * Helps understand which metrics influence each other
 */

import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Calculate Pearson correlation coefficient
 * Measures linear relationship between two variables (-1 to 1)
 */
function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  
  if (n < 6) {
    console.warn('[pearsonCorrelation] Insufficient data points:', n);
    return 0;
  }
  
  // Calculate means
  const meanX = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanY = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  
  // Calculate correlation components
  let numerator = 0;
  let sumSquaredDiffX = 0;
  let sumSquaredDiffY = 0;
  
  for (let i = 0; i < n; i++) {
    const diffX = xs[i] - meanX;
    const diffY = ys[i] - meanY;
    
    numerator += diffX * diffY;
    sumSquaredDiffX += diffX * diffX;
    sumSquaredDiffY += diffY * diffY;
  }
  
  // Calculate correlation
  const denominator = Math.sqrt(sumSquaredDiffX * sumSquaredDiffY);
  
  if (denominator < 1e-9) {
    return 0;
  }
  
  return numerator / denominator;
}

/**
 * Root Cause Analysis Cloud Function
 * Runs every hour to calculate metric correlations
 */
export const rootCause = functions.pubsub
  .schedule('every 60 minutes')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('[rootCause] Starting correlation analysis');
    
    const db = getFirestore();
    const lookbackDays = 7;
    const since = Date.now() - (lookbackDays * 24 * 60 * 60 * 1000);
    
    try {
      // Load historical metrics
      const metricsSnap = await db
        .collection('api_metrics_daily')
        .where('ts', '>=', since)
        .orderBy('ts', 'asc')
        .get();
      
      if (metricsSnap.empty || metricsSnap.size < 24) {
        console.log('[rootCause] Insufficient historical data');
        return null;
      }
      
      // Extract metric arrays
      const calls: number[] = [];
      const errors: number[] = [];
      const latencyP95: number[] = [];
      const timestamps: number[] = [];
      
      const rows = metricsSnap.docs.map(doc => doc.data() as any).sort((a, b) => a.ts - b.ts);
      
      for (const row of rows) {
        calls.push(Number(row.calls) || 0);
        errors.push(Number(row.errors) || 0);
        latencyP95.push(Number(row.latency_p95) || 0);
        timestamps.push(row.ts);
      }
      
      console.log(`[rootCause] Analyzing ${calls.length} data points from last ${lookbackDays} days`);
      
      // Calculate pairwise correlations
      const correlations = [
        {
          pair: 'calls~errors',
          r: pearsonCorrelation(calls, errors),
          description: 'Traffic volume vs Error rate'
        },
        {
          pair: 'calls~latency_p95',
          r: pearsonCorrelation(calls, latencyP95),
          description: 'Traffic volume vs Response time'
        },
        {
          pair: 'errors~latency_p95',
          r: pearsonCorrelation(errors, latencyP95),
          description: 'Error rate vs Response time'
        }
      ];
      
      // Identify strong correlations (|r| >= 0.7)
      const strongCorrelations = correlations.filter(c => Math.abs(c.r) >= 0.7);
      
      // Calculate trend analysis
      const recentCalls = calls.slice(-24); // Last 24 points
      const recentErrors = errors.slice(-24);
      const recentLatency = latencyP95.slice(-24);
      
      const callsTrend = recentCalls.length > 0 
        ? (recentCalls[recentCalls.length - 1] - recentCalls[0]) / Math.max(1, recentCalls[0])
        : 0;
      
      const errorsTrend = recentErrors.length > 0
        ? (recentErrors[recentErrors.length - 1] - recentErrors[0]) / Math.max(1, recentErrors[0])
        : 0;
      
      const latencyTrend = recentLatency.length > 0
        ? (recentLatency[recentLatency.length - 1] - recentLatency[0]) / Math.max(1, recentLatency[0])
        : 0;
      
      // Generate insights based on correlations
      const insights: string[] = [];
      
      if (Math.abs(correlations[0].r) >= 0.7) {
        insights.push(
          correlations[0].r > 0 
            ? 'High traffic increases errors - may indicate capacity issues'
            : 'High traffic decreases errors - system handles load well'
        );
      }
      
      if (Math.abs(correlations[1].r) >= 0.7) {
        insights.push(
          correlations[1].r > 0
            ? 'High traffic increases latency - consider scaling'
            : 'High traffic decreases latency - efficient resource utilization'
        );
      }
      
      if (Math.abs(correlations[2].r) >= 0.7) {
        insights.push(
          correlations[2].r > 0
            ? 'Errors correlated with latency - timeouts or slow operations'
            : 'Errors inversely correlated with latency - fast failures'
        );
      }
      
      // Store analysis results
      await db.collection('root_cause_graph').doc('global').set({
        ts: Date.now(),
        lookbackDays,
        dataPoints: calls.length,
        correlations,
        strongCorrelations,
        trends: {
          calls: callsTrend,
          errors: errorsTrend,
          latency_p95: latencyTrend
        },
        insights,
        metrics: {
          calls: {
            current: calls[calls.length - 1] || 0,
            avg: calls.reduce((a, b) => a + b, 0) / calls.length,
            min: Math.min(...calls),
            max: Math.max(...calls)
          },
          errors: {
            current: errors[errors.length - 1] || 0,
            avg: errors.reduce((a, b) => a + b, 0) / errors.length,
            min: Math.min(...errors),
            max: Math.max(...errors)
          },
          latency_p95: {
            current: latencyP95[latencyP95.length - 1] || 0,
            avg: latencyP95.reduce((a, b) => a + b, 0) / latencyP95.length,
            min: Math.min(...latencyP95),
            max: Math.max(...latencyP95)
          }
        }
      }, { merge: true });
      
      console.log('[rootCause] Analysis complete:');
      console.log(`  - Calls~Errors correlation: ${correlations[0].r.toFixed(3)}`);
      console.log(`  - Calls~Latency correlation: ${correlations[1].r.toFixed(3)}`);
      console.log(`  - Errors~Latency correlation: ${correlations[2].r.toFixed(3)}`);
      console.log(`  - Strong correlations: ${strongCorrelations.length}`);
      console.log(`  - Insights generated: ${insights.length}`);
      
    } catch (err) {
      console.error('[rootCause] Error:', err);
    }
    
    return null;
  });

/**
 * Analyze endpoint-specific correlations
 * Runs daily to identify problematic endpoints
 */
export const rootCauseEndpoints = functions.pubsub
  .schedule('every 24 hours')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('[rootCauseEndpoints] Starting endpoint-specific analysis');
    
    const db = getFirestore();
    const lookbackDays = 7;
    const since = Date.now() - (lookbackDays * 24 * 60 * 60 * 1000);
    
    try {
      // Load metrics with endpoint breakdown
      const metricsSnap = await db
        .collection('api_metrics_daily')
        .where('ts', '>=', since)
        .get();
      
      if (metricsSnap.empty) {
        console.log('[rootCauseEndpoints] No data available');
        return null;
      }
      
      // Aggregate by endpoint
      const endpointStats = new Map<string, {
        calls: number;
        errors: number;
        avgLatency: number;
        errorRate: number;
      }>();
      
      metricsSnap.docs.forEach(doc => {
        const data = doc.data() as any;
        
        if (data.endpoints) {
          Object.entries(data.endpoints).forEach(([endpoint, metrics]: [string, any]) => {
            const existing = endpointStats.get(endpoint) || {
              calls: 0,
              errors: 0,
              avgLatency: 0,
              errorRate: 0
            };
            
            existing.calls += Number(metrics.calls) || 0;
            existing.errors += Number(metrics.errors) || 0;
            existing.avgLatency = (existing.avgLatency + (Number(metrics.latency_p95) || 0)) / 2;
            
            endpointStats.set(endpoint, existing);
          });
        }
      });
      
      // Calculate error rates and identify problematic endpoints
      const problematicEndpoints = [];
      
      for (const [endpoint, stats] of endpointStats.entries()) {
        stats.errorRate = stats.calls > 0 ? (stats.errors / stats.calls) * 100 : 0;
        
        // Flag if error rate > 5% or avg latency > 1000ms
        if (stats.errorRate > 5 || stats.avgLatency > 1000) {
          problematicEndpoints.push({
            endpoint,
            ...stats,
            severity: stats.errorRate > 10 ? 'high' : stats.errorRate > 5 ? 'medium' : 'low'
          });
        }
      }
      
      // Store results
      await db.collection('root_cause_graph').doc('endpoints').set({
        ts: Date.now(),
        lookbackDays,
        totalEndpoints: endpointStats.size,
        problematicEndpoints: problematicEndpoints.sort((a, b) => b.errorRate - a.errorRate).slice(0, 20),
        summary: {
          highSeverity: problematicEndpoints.filter(e => e.severity === 'high').length,
          mediumSeverity: problematicEndpoints.filter(e => e.severity === 'medium').length,
          lowSeverity: problematicEndpoints.filter(e => e.severity === 'low').length
        }
      }, { merge: true });
      
      console.log(`[rootCauseEndpoints] Found ${problematicEndpoints.length} problematic endpoints`);
      
    } catch (err) {
      console.error('[rootCauseEndpoints] Error:', err);
    }
    
    return null;
  });

