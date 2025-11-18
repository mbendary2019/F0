/**
 * Alert Rules Types and Helpers
 */

export type AlertMetric = 'errors_per_min' | 'calls_per_min' | 'latency_p95';
export type AlertWindow = '1m' | '5m' | '15m';
export type AlertAction = 'slack' | 'browser';

export type AlertRule = {
  id?: string;
  name: string;
  metric: AlertMetric;
  threshold: number;
  window: AlertWindow;
  action: AlertAction;
  enabled: boolean;
  createdBy?: string;
  createdAt?: number;
};

export type AlertTrigger = {
  id?: string;
  ruleId?: string;
  ruleName: string;
  metric: AlertMetric;
  value: number;
  threshold: number;
  window: AlertWindow;
  triggeredAt: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
};

/**
 * Get human-readable metric name
 */
export function getMetricLabel(metric: AlertMetric): string {
  switch (metric) {
    case 'errors_per_min': return 'Errors per Minute';
    case 'calls_per_min': return 'Calls per Minute';
    case 'latency_p95': return 'P95 Latency (ms)';
    default: return metric;
  }
}

/**
 * Get human-readable window label
 */
export function getWindowLabel(window: AlertWindow): string {
  switch (window) {
    case '1m': return '1 Minute';
    case '5m': return '5 Minutes';
    case '15m': return '15 Minutes';
    default: return window;
  }
}

/**
 * Get human-readable action label
 */
export function getActionLabel(action: AlertAction): string {
  switch (action) {
    case 'slack': return 'Slack';
    case 'browser': return 'Browser';
    default: return action;
  }
}

/**
 * Validate alert rule
 */
export function validateAlertRule(rule: Partial<AlertRule>): string[] {
  const errors: string[] = [];

  if (!rule.name || rule.name.length < 3) {
    errors.push('Name must be at least 3 characters');
  }

  if (!rule.metric) {
    errors.push('Metric is required');
  }

  if (rule.threshold === undefined || rule.threshold < 0) {
    errors.push('Threshold must be a positive number');
  }

  if (!rule.window) {
    errors.push('Window is required');
  }

  if (!rule.action) {
    errors.push('Action is required');
  }

  return errors;
}

