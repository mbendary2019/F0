/**
 * Runbooks Utilities
 * Helper functions and types for automated playbooks
 */

export type Runbook = {
  id?: string;
  name: string;
  trigger: string;
  steps: string[];
  cooldown?: number;
  enabled: boolean;
  lastTriggered?: number;
  triggerCount?: number;
  createdBy?: string;
  createdAt?: number;
  updatedBy?: string;
  updatedAt?: number;
};

/**
 * Parse trigger condition for display
 */
export function parseTrigger(trigger: string): {
  metric: string;
  operator: string;
  threshold: string;
} | null {
  const match = trigger.match(/^(\w+)(>|<|>=|<=|==)(\d+\.?\d*)$/);
  
  if (!match) {
    return null;
  }
  
  const [, metric, operator, threshold] = match;
  
  return {
    metric: formatMetricName(metric),
    operator,
    threshold
  };
}

/**
 * Format metric name for display
 */
function formatMetricName(metric: string): string {
  const names: Record<string, string> = {
    error_rate: 'Error Rate (%)',
    errors_per_min: 'Errors/Min',
    errors24h: 'Errors (24h)',
    calls24h: 'Calls (24h)',
    p95: 'p95 Latency (ms)'
  };
  
  return names[metric] || metric;
}

/**
 * Format step for display
 */
export function formatStep(step: string): {
  action: string;
  target?: string;
} {
  const [action, target] = step.split(':').map(s => s.trim());
  
  return {
    action: formatActionName(action),
    target
  };
}

/**
 * Format action name for display
 */
function formatActionName(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Get runbook status badge
 */
export function getRunbookStatus(runbook: Runbook): {
  label: string;
  color: string;
} {
  if (!runbook.enabled) {
    return {
      label: 'Disabled',
      color: 'bg-gray-100 text-gray-800'
    };
  }
  
  if (runbook.lastTriggered && runbook.cooldown) {
    const timeSince = Date.now() - runbook.lastTriggered;
    const cooldownMs = runbook.cooldown * 60 * 1000;
    
    if (timeSince < cooldownMs) {
      return {
        label: 'Cooldown',
        color: 'bg-yellow-100 text-yellow-800'
      };
    }
  }
  
  return {
    label: 'Active',
    color: 'bg-green-100 text-green-800'
  };
}

/**
 * Calculate cooldown remaining time
 */
export function getCooldownRemaining(runbook: Runbook): number | null {
  if (!runbook.lastTriggered || !runbook.cooldown) {
    return null;
  }
  
  const timeSince = Date.now() - runbook.lastTriggered;
  const cooldownMs = runbook.cooldown * 60 * 1000;
  const remaining = cooldownMs - timeSince;
  
  return remaining > 0 ? remaining : null;
}

/**
 * Format cooldown time
 */
export function formatCooldownTime(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  
  if (minutes < 60) {
    return `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours}h ${remainingMinutes}m`;
}


