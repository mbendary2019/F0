/**
 * AI Insights Generator
 * Generates actionable insights from anomaly events
 */

export type Metric = 'errors' | 'calls' | 'latency_p95';
export type Severity = 'low' | 'medium' | 'high';

export type Insight = {
  title: string;
  severity: Severity;
  description: string;
  possibleCauses: string[];
  suggestedActions: string[];
  affectedEndpoints?: string[];
  meta?: Record<string, any>;
};

/**
 * Build insight from anomaly context
 */
export function buildInsight(
  metric: Metric,
  severity: Severity,
  ctx: {
    score?: number;
    window?: string;
    endpoint?: string;
    delta?: number;
    n?: number;
    last?: number;
  }
): Insight {
  const insights = getInsightTemplates();
  const template = insights[metric];

  // Calculate impact message
  const deltaMsg = ctx.delta ? ` (${ctx.delta > 0 ? '+' : ''}${ctx.delta.toFixed(1)}%)` : '';
  const windowMsg = ctx.window ? ` over ${ctx.window}` : '';

  return {
    title: `${template.title}${windowMsg}`,
    severity,
    description: `${template.description}${deltaMsg}. Detected with score ${ctx.score?.toFixed(2) || 'N/A'}.`,
    possibleCauses: template.causes,
    suggestedActions: template.actions,
    affectedEndpoints: ctx.endpoint ? [ctx.endpoint] : undefined,
    meta: ctx
  };
}

/**
 * Get insight templates for each metric
 */
function getInsightTemplates() {
  return {
    errors: {
      title: 'Error Rate Spike',
      description: 'Unusual increase in error responses detected',
      causes: [
        'Recent deployment with bugs',
        'Authentication/authorization issues',
        'External service failures',
        'Database connection problems',
        'Rate limiting triggered',
        'Invalid input from clients'
      ],
      actions: [
        'Check recent deployments and rollback if needed',
        'Review error logs for common patterns',
        'Verify external service health',
        'Check database connection pool',
        'Review rate limiting rules',
        'Monitor most affected endpoints'
      ]
    },
    calls: {
      title: 'Traffic Surge',
      description: 'Unusual increase in request volume detected',
      causes: [
        'Legitimate traffic spike (marketing campaign, viral content)',
        'DDoS or bot attack',
        'Client retry storms',
        'Webhook loops',
        'Scheduled job running unexpectedly',
        'Mobile app release'
      ],
      actions: [
        'Verify traffic source (IPs, user agents)',
        'Apply stricter rate limiting if needed',
        'Scale infrastructure if legitimate',
        'Block suspicious IPs',
        'Check for retry loops in client code',
        'Monitor top endpoints and users'
      ]
    },
    latency_p95: {
      title: 'Latency Degradation',
      description: 'Unusual increase in response time detected',
      causes: [
        'Slow database queries',
        'External API latency',
        'Memory/CPU pressure',
        'Network issues',
        'Inefficient code in hot path',
        'Cold start issues (serverless)'
      ],
      actions: [
        'Review slow query logs',
        'Check external service latency',
        'Monitor server resources (CPU, memory)',
        'Review recent code changes',
        'Enable caching for heavy operations',
        'Consider adding indexes to database',
        'Use queue for async operations'
      ]
    }
  };
}

/**
 * Generate correlation hints
 */
export function generateCorrelations(
  metric: Metric,
  recentEvents: Array<{ metric: Metric; endpoint?: string; ts: number }>
): string[] {
  const hints: string[] = [];

  // Check for related metrics
  const errorEvents = recentEvents.filter(e => e.metric === 'errors');
  const callEvents = recentEvents.filter(e => e.metric === 'calls');
  const latencyEvents = recentEvents.filter(e => e.metric === 'latency_p95');

  if (metric === 'errors' && callEvents.length > 0) {
    hints.push('Correlated with traffic increase - may indicate capacity issues');
  }

  if (metric === 'latency_p95' && errorEvents.length > 0) {
    hints.push('Correlated with error spike - services may be timing out');
  }

  if (metric === 'calls' && latencyEvents.length > 0) {
    hints.push('Correlated with latency increase - system may be overwhelmed');
  }

  // Check for endpoint patterns
  const endpoints = recentEvents
    .filter(e => e.endpoint)
    .map(e => e.endpoint)
    .filter((e, i, arr) => arr.indexOf(e) === i);

  if (endpoints.length === 1) {
    hints.push(`Isolated to endpoint: ${endpoints[0]}`);
  } else if (endpoints.length > 1 && endpoints.length <= 3) {
    hints.push(`Affecting multiple endpoints: ${endpoints.join(', ')}`);
  } else if (endpoints.length > 3) {
    hints.push('System-wide issue affecting many endpoints');
  }

  return hints;
}

/**
 * Calculate priority score for insight
 */
export function calculatePriority(
  severity: Severity,
  duration: number, // milliseconds
  frequency: number // occurrences
): number {
  const severityWeight = { low: 1, medium: 2, high: 3 }[severity];
  const durationWeight = Math.min(duration / (5 * 60 * 1000), 3); // Cap at 5 min
  const frequencyWeight = Math.min(frequency / 5, 3); // Cap at 5 occurrences

  return severityWeight * 0.5 + durationWeight * 0.3 + frequencyWeight * 0.2;
}

/**
 * Format insight for Slack notification
 */
export function formatSlackMessage(insight: Insight): any {
  const emoji = {
    low: '⚠️',
    medium: '🔶',
    high: '🚨'
  }[insight.severity];

  return {
    text: `${emoji} ${insight.title}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${insight.title}`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Description:*\n${insight.description}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Severity:* ${insight.severity.toUpperCase()}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Possible Causes:*\n${insight.possibleCauses.slice(0, 3).map(c => `• ${c}`).join('\n')}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Suggested Actions:*\n${insight.suggestedActions.slice(0, 3).map(a => `• ${a}`).join('\n')}`
        }
      }
    ]
  };
}

