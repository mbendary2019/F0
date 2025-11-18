/**
 * LLM Brain - Intelligent Analysis Engine
 * Multi-provider support: OpenAI, Anthropic, Gemini
 * Safe fallback to deterministic logic
 */

import * as functions from 'firebase-functions';
import type { LLMInsight } from './types';

export type LLMContext = {
  question?: string;
  metrics?: {
    calls24h?: number;
    errors24h?: number;
    p95?: number;
  };
  recentAnomalies?: Array<{
    ts: number;
    metric: string;
    severity: string;
    score?: number;
  }>;
  predictions?: Array<{
    metric: string;
    forecast: number[];
    upper: number[];
  }>;
};

// Environment configuration
const PROVIDER = process.env.LLM_PROVIDER?.toLowerCase() as 'openai' | 'anthropic' | 'gemini' | undefined;
const API_KEY = process.env.LLM_API_KEY;
const MODEL = process.env.LLM_MODEL || (
  PROVIDER === 'openai' ? 'gpt-4o-mini' :
  PROVIDER === 'anthropic' ? 'claude-3-5-sonnet-20241022' :
  PROVIDER === 'gemini' ? 'gemini-1.5-flash' :
  'fallback'
);

/**
 * Build prompt for LLM
 */
function buildPrompt(ctx: LLMContext): string {
  const q = ctx.question || 'Give a concise ops insight with actionable recommendations.';
  const m = ctx.metrics || {};
  const anomalies = (ctx.recentAnomalies || [])
    .map(a => `${a.metric}:${a.severity}`)
    .join(', ') || 'none';
  const forecasts = (ctx.predictions || [])
    .map(f => `${f.metric}:next=${f.forecast?.[0] || 0},upper=${f.upper?.[0] || 0}`)
    .join('; ') || 'none';

  return `You are an Operations AI Assistant. Analyze the following system metrics and provide insights.

Context:
- Metrics: calls24h=${m.calls24h ?? '-'} errors24h=${m.errors24h ?? '-'} p95=${m.p95 ?? '-'}ms
- Recent anomalies: ${anomalies}
- Forecasts: ${forecasts}

Task: ${q}

Return ONLY a valid JSON object with this exact structure:
{
  "summary": "Brief summary of system health (max 200 chars)",
  "suggestions": ["Action 1", "Action 2", "Action 3"],
  "confidence": 0.85
}`;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(prompt: string): Promise<LLMInsight> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful operations assistant. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 500
    })
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';

  try {
    // Try to parse JSON response
    const parsed = JSON.parse(text) as LLMInsight;
    return {
      summary: parsed.summary || 'No summary provided',
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.7)),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [],
      analysis: parsed.analysis
    };
  } catch {
    // Fallback if JSON parsing fails
    return {
      summary: text.slice(0, 200) || 'Unable to parse response',
      suggestions: ['Verify API response format', 'Check model configuration'],
      confidence: 0.5
    };
  }
}

/**
 * Call Anthropic Claude API
 */
async function callAnthropic(prompt: string): Promise<LLMInsight> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY!,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status}`);
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? '';

  try {
    const parsed = JSON.parse(text) as LLMInsight;
    return {
      summary: parsed.summary || 'No summary provided',
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.7)),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [],
      analysis: parsed.analysis
    };
  } catch {
    return {
      summary: text.slice(0, 200) || 'Unable to parse response',
      suggestions: ['Verify API response format', 'Check model configuration'],
      confidence: 0.5
    };
  }
}

/**
 * Call Google Gemini API
 */
async function callGemini(prompt: string): Promise<LLMInsight> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512 }
      })
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  try {
    const parsed = JSON.parse(text) as LLMInsight;
    return {
      summary: parsed.summary || 'No summary provided',
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.7)),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [],
      analysis: parsed.analysis
    };
  } catch {
    return {
      summary: text.slice(0, 200) || 'Unable to parse response',
      suggestions: ['Verify API response format', 'Check model configuration'],
      confidence: 0.5
    };
  }
}

/**
 * Deterministic fallback when LLM is unavailable
 */
function fallbackAnalysis(ctx: LLMContext): LLMInsight {
  const anomalies = ctx.recentAnomalies || [];
  const highSeverity = anomalies.filter(a => a.severity === 'high');
  const p95 = ctx.metrics?.p95 ?? 0;
  const errorRate = ctx.metrics?.errors24h && ctx.metrics?.calls24h
    ? (ctx.metrics.errors24h / ctx.metrics.calls24h) * 100
    : 0;

  let summary = '';
  const suggestions: string[] = [];
  const trends: string[] = [];
  const risks: string[] = [];

  // Analyze anomalies
  if (highSeverity.length > 0) {
    summary = `⚠️ ${highSeverity.length} high-severity anomaly detected. `;
    risks.push('System stability at risk');
    suggestions.push('Investigate high-severity anomalies immediately');
    suggestions.push('Review recent deployments');
  } else if (anomalies.length > 0) {
    summary = `📊 ${anomalies.length} anomaly detected. System generally healthy. `;
    suggestions.push('Monitor for recurring patterns');
  } else {
    summary = '✅ System operating normally. No anomalies detected. ';
  }

  // Analyze latency
  if (p95 > 1000) {
    summary += `High latency (p95: ${p95}ms). `;
    trends.push('Latency trending high');
    risks.push('User experience degradation');
    suggestions.push('Review slow query logs');
    suggestions.push('Consider caching strategy');
  } else if (p95 > 500) {
    trends.push('Latency slightly elevated');
  }

  // Analyze error rate
  if (errorRate > 5) {
    summary += `High error rate: ${errorRate.toFixed(2)}%. `;
    risks.push('Service reliability issues');
    suggestions.push('Investigate top error endpoints');
  }

  // Default suggestions
  if (suggestions.length === 0) {
    suggestions.push('Continue monitoring system metrics');
    suggestions.push('Review capacity planning');
  }
  
  return {
    summary: summary.trim(),
    confidence: highSeverity.length > 0 ? 0.78 : 0.68,
    suggestions: suggestions.slice(0, 5),
    analysis: {
      anomalies: anomalies.length,
      trends: trends.length > 0 ? trends : ['Stable performance'],
      risks: risks.length > 0 ? risks : ['No immediate risks']
    }
  };
}

/**
 * Main analyze function - routes to appropriate provider
 */
export async function llmAnalyze(context: LLMContext): Promise<LLMInsight> {
  // Use fallback if no provider configured
  if (!PROVIDER || !API_KEY) {
    console.log('[LLM Brain] No provider configured, using fallback');
    return fallbackAnalysis(context);
  }

  const prompt = buildPrompt(context);

  try {
    console.log(`[LLM Brain] Using provider: ${PROVIDER} (model: ${MODEL})`);

    switch (PROVIDER) {
      case 'openai':
        return await callOpenAI(prompt);
      case 'anthropic':
        return await callAnthropic(prompt);
      case 'gemini':
        return await callGemini(prompt);
      default:
        console.warn(`[LLM Brain] Unknown provider: ${PROVIDER}`);
        return fallbackAnalysis(context);
    }
  } catch (error) {
    console.error(`[LLM Brain] Error calling ${PROVIDER}:`, error);
    return fallbackAnalysis(context);
  }
}

/**
 * Generate recommendations for specific question
 */
export async function llmRecommend(
  question: string,
  context: LLMContext
): Promise<LLMInsight> {
  const lowerQuestion = question.toLowerCase();
  
  // Pattern matching for common questions
  if (lowerQuestion.includes('traffic') || lowerQuestion.includes('calls')) {
    return {
      summary: `Current traffic: ${context.metrics?.calls24h || 0} calls in 24h`,
      confidence: 0.8,
      suggestions: [
        'Traffic patterns within normal range',
        'Set up alerts for unusual spikes',
        'Consider auto-scaling if approaching limits'
      ]
    };
  }
  
  if (lowerQuestion.includes('error') || lowerQuestion.includes('failure')) {
    const errorRate = context.metrics?.errors24h && context.metrics?.calls24h
      ? (context.metrics.errors24h / context.metrics.calls24h) * 100
      : 0;
    
    return {
      summary: `Error rate: ${errorRate.toFixed(2)}% (${context.metrics?.errors24h || 0} errors)`,
      confidence: 0.85,
      suggestions: [
        'Check error logs for common patterns',
        'Review recent code deployments',
        'Verify external service health',
        'Consider implementing circuit breakers'
      ]
    };
  }
  
  if (lowerQuestion.includes('latency') || lowerQuestion.includes('slow')) {
    return {
      summary: `p95 latency: ${context.metrics?.p95 || 0}ms`,
      confidence: 0.8,
      suggestions: [
        'Review database query performance',
        'Check for N+1 query patterns',
        'Consider adding caching layers',
        'Monitor external API latencies'
      ]
    };
  }
  
  // Default analysis
  return llmAnalyze(context);
}

/**
 * Prepare context from Firestore data
 * Helper to fetch and format data for LLM
 */
export function prepareContextForLLM(data: {
  totals?: any;
  anomalies?: any[];
  predictions?: any[];
}): LLMContext {
  return {
    metrics: {
      calls24h: data.totals?.calls24h,
      errors24h: data.totals?.errors24h,
      p95: data.totals?.p95
    },
    recentAnomalies: data.anomalies?.map(a => ({
      ts: a.ts,
      metric: a.metric,
      severity: a.severity,
      score: a.score
    })),
    predictions: data.predictions?.map(p => ({
      metric: p.metric,
      forecast: p.forecast,
      upper: p.upper
    }))
  };
}

/**
 * Format insight for display
 */
export function formatInsightForDisplay(insight: LLMInsight): string {
  const lines: string[] = [];
  
  lines.push(`📊 ${insight.summary}`);
  lines.push('');
  lines.push(`🎯 Confidence: ${(insight.confidence * 100).toFixed(0)}%`);
  lines.push('');
  
  if (insight.analysis?.trends && insight.analysis.trends.length > 0) {
    lines.push('📈 Trends:');
    insight.analysis.trends.forEach(t => lines.push(`  • ${t}`));
    lines.push('');
  }
  
  if (insight.analysis?.risks && insight.analysis.risks.length > 0) {
    lines.push('⚠️  Risks:');
    insight.analysis.risks.forEach(r => lines.push(`  • ${r}`));
    lines.push('');
  }
  
  if (insight.suggestions.length > 0) {
    lines.push('💡 Recommendations:');
    insight.suggestions.forEach(s => lines.push(`  • ${s}`));
  }
  
  return lines.join('\n');
}

/**
 * Health check endpoint for LLM configuration
 */
export const llmHealth = functions.https.onRequest((_req, res) => {
  res.status(200).json({
    provider: PROVIDER ?? 'fallback',
    model: MODEL,
    configured: !!(PROVIDER && API_KEY),
    timestamp: Date.now()
  });
});
