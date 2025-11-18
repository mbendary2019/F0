/**
 * Scorer Plugin Registry
 *
 * Central registry for managing scorer plugins.
 * Allows hot-swapping of scoring models without code changes.
 */

import type { ScorerPlugin } from "./base";
import { LinearScorer } from "./linear";

/**
 * Current active scorer plugin
 */
let currentScorer: ScorerPlugin = new LinearScorer();

/**
 * Registry of available scorers
 */
const registry: Map<string, ScorerPlugin> = new Map();

// Register default scorers
registry.set("linear", new LinearScorer());

/**
 * Get the current active scorer
 */
export function getScorer(): ScorerPlugin {
  return currentScorer;
}

/**
 * Set the active scorer
 *
 * @param plugin - Scorer plugin to activate
 *
 * @example
 * ```typescript
 * const customScorer = new LinearScorer({ citation_count: 0.5 });
 * setScorer(customScorer);
 * ```
 */
export function setScorer(plugin: ScorerPlugin): void {
  currentScorer = plugin;
  console.log(`[registry] Active scorer set to: ${plugin.name} v${plugin.version}`);
}

/**
 * Register a new scorer plugin
 *
 * @param name - Plugin name
 * @param plugin - Plugin instance
 *
 * @example
 * ```typescript
 * registerScorer("xgboost", new XGBoostScorer());
 * ```
 */
export function registerScorer(name: string, plugin: ScorerPlugin): void {
  registry.set(name, plugin);
  console.log(`[registry] Registered scorer: ${name} (${plugin.name} v${plugin.version})`);
}

/**
 * Get a scorer by name
 *
 * @param name - Plugin name
 * @returns Scorer plugin or undefined if not found
 */
export function getNamedScorer(name: string): ScorerPlugin | undefined {
  return registry.get(name);
}

/**
 * List all registered scorers
 *
 * @returns Array of scorer names
 */
export function listScorers(): string[] {
  return Array.from(registry.keys());
}

/**
 * Switch to a registered scorer by name
 *
 * @param name - Plugin name
 * @returns true if switched successfully, false if not found
 *
 * @example
 * ```typescript
 * if (switchScorer("xgboost")) {
 *   console.log("Switched to XGBoost scorer");
 * }
 * ```
 */
export function switchScorer(name: string): boolean {
  const scorer = registry.get(name);
  if (!scorer) {
    console.warn(`[registry] Scorer not found: ${name}`);
    return false;
  }

  setScorer(scorer);
  return true;
}

/**
 * Get metadata for all registered scorers
 */
export function getScorerMetadata(): Array<{
  name: string;
  plugin: string;
  version: string;
  active: boolean;
}> {
  return Array.from(registry.entries()).map(([name, plugin]) => ({
    name,
    plugin: plugin.name,
    version: plugin.version,
    active: plugin === currentScorer,
  }));
}

/**
 * Reset to default scorer
 */
export function resetToDefault(): void {
  setScorer(new LinearScorer());
}
