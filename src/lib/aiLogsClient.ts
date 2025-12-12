/**
 * Phase 109.6: AI Logs Client Utilities
 * Client-side helpers for AI Logs display
 */

// Origin types for all AI operations
export type AiLogOrigin = 'desktop-ide' | 'web-ide' | 'auto-executor' | 'cloud-agent';

// Mode types
export type AiLogMode = 'chat' | 'refactor' | 'task' | 'plan' | 'explain';

/**
 * Get origin icon for display
 */
export function getOriginIcon(origin: AiLogOrigin): string {
  switch (origin) {
    case 'desktop-ide':
      return '💻';
    case 'web-ide':
      return '🏠';
    case 'auto-executor':
      return '🤖';
    case 'cloud-agent':
      return '☁️';
    default:
      return '📝';
  }
}

/**
 * Get origin display name
 */
export function getOriginLabel(origin: AiLogOrigin): string {
  switch (origin) {
    case 'desktop-ide':
      return 'Desktop IDE';
    case 'web-ide':
      return 'Web IDE';
    case 'auto-executor':
      return 'Auto Executor';
    case 'cloud-agent':
      return 'Cloud Agent';
    default:
      return origin;
  }
}

/**
 * Get mode icon
 */
export function getModeIcon(mode: AiLogMode): string {
  switch (mode) {
    case 'chat':
      return '💬';
    case 'refactor':
      return '🔧';
    case 'task':
      return '✅';
    case 'plan':
      return '📋';
    case 'explain':
      return '💡';
    default:
      return '📝';
  }
}
