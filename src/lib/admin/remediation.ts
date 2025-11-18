/**
 * Remediation Utilities
 * Helper functions for self-healing rules and actions
 */

export type RemediationRule = {
  id?: string;
  metric: 'calls' | 'errors' | 'latency_p95';
  comparator: '>=' | '>' | '<' | '<=';
  threshold: number;
  action: 'disable_endpoint' | 'reduce_rate' | 'restart_function';
  target?: string;
  reduceByPct?: number;
  enabled: boolean;
  createdBy?: string;
  createdAt?: number;
  lastTriggered?: number;
};

export type RemediationAction = 
  | { type: 'disable_endpoint'; target: string }
  | { type: 'reduce_rate'; target: string; reduceByPct: number }
  | { type: 'restart_function'; target: string };

/**
 * Validate remediation rule
 */
export function validateRule(rule: Partial<RemediationRule>): string[] {
  const errors: string[] = [];
  
  if (!rule.metric) {
    errors.push('Metric is required');
  }
  
  if (!rule.comparator) {
    errors.push('Comparator is required');
  }
  
  if (rule.threshold === undefined || rule.threshold < 0) {
    errors.push('Threshold must be >= 0');
  }
  
  if (!rule.action) {
    errors.push('Action is required');
  }
  
  if (rule.action === 'disable_endpoint' && !rule.target) {
    errors.push('Target endpoint is required for disable action');
  }
  
  if (rule.action === 'reduce_rate') {
    if (!rule.target) {
      errors.push('Target is required for rate reduction');
    }
    if (!rule.reduceByPct || rule.reduceByPct < 1 || rule.reduceByPct > 90) {
      errors.push('reduceByPct must be between 1 and 90');
    }
  }
  
  if (rule.action === 'restart_function' && !rule.target) {
    errors.push('Target function is required for restart action');
  }
  
  return errors;
}

/**
 * Format rule for display
 */
export function formatRule(rule: RemediationRule): string {
  const parts: string[] = [];
  
  parts.push(`IF ${rule.metric}`);
  parts.push(rule.comparator);
  parts.push(rule.threshold.toString());
  
  switch (rule.action) {
    case 'disable_endpoint':
      parts.push(`THEN disable endpoint ${rule.target}`);
      break;
    case 'reduce_rate':
      parts.push(`THEN reduce rate for ${rule.target} by ${rule.reduceByPct}%`);
      break;
    case 'restart_function':
      parts.push(`THEN restart function ${rule.target}`);
      break;
  }
  
  return parts.join(' ');
}

/**
 * Get action description
 */
export function getActionDescription(action: RemediationRule['action']): string {
  switch (action) {
    case 'disable_endpoint':
      return 'Temporarily disable API endpoint';
    case 'reduce_rate':
      return 'Reduce rate limit percentage';
    case 'restart_function':
      return 'Trigger function restart';
    default:
      return 'Unknown action';
  }
}

/**
 * Get severity color for rule
 */
export function getRuleSeverity(rule: RemediationRule): 'low' | 'medium' | 'high' {
  // Disabling endpoints is high severity
  if (rule.action === 'disable_endpoint') return 'high';
  
  // Restarting functions is medium severity
  if (rule.action === 'restart_function') return 'medium';
  
  // Rate limiting is low severity
  return 'low';
}

/**
 * Check if rule should trigger for given value
 */
export function shouldTrigger(rule: RemediationRule, value: number): boolean {
  switch (rule.comparator) {
    case '>=':
      return value >= rule.threshold;
    case '>':
      return value > rule.threshold;
    case '<=':
      return value <= rule.threshold;
    case '<':
      return value < rule.threshold;
    default:
      return false;
  }
}

/**
 * Calculate cooldown remaining (in minutes)
 */
export function cooldownRemaining(
  rule: RemediationRule,
  cooldownMinutes: number = 30
): number | null {
  if (!rule.lastTriggered) return null;
  
  const elapsed = Date.now() - rule.lastTriggered;
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const remaining = cooldownMs - elapsed;
  
  if (remaining <= 0) return null;
  
  return Math.ceil(remaining / 60000); // Convert to minutes
}

/**
 * Check if rule is in cooldown period
 */
export function isInCooldown(
  rule: RemediationRule,
  cooldownMinutes: number = 30
): boolean {
  return cooldownRemaining(rule, cooldownMinutes) !== null;
}

