// src/lib/agent/actions/runner/utils/logger.ts

/**
 * Simple logger for Action Runner events.
 * Prefixes all logs with timestamp and runner identifier.
 */
export function logRunnerEvent(message: string): void {
  const ts = new Date().toISOString();
  console.log(`[F0-ActionRunner ${ts}] ${message}`);
}
