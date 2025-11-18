/**
 * Source Reputation System
 *
 * Assigns reputation scores (0-1) to different source types.
 * Higher scores indicate more trustworthy/authoritative sources.
 *
 * Can be extended to pull from Firestore or external reputation DB.
 */

const DEFAULT = 0.5;

const MAP: Record<string, number> = {
  kb: 0.8,        // Knowledge base articles
  cluster: 0.7,   // Cluster/workspace docs
  link: 0.6,      // External links
  fallback: 0.2   // Unknown sources
};

/**
 * Get reputation score for a source type
 * @param source - Source type identifier
 * @returns Reputation score between 0 and 1
 */
export function sourceReputation(source?: string): number {
  if (!source) return DEFAULT;
  return MAP[source] ?? DEFAULT;
}

/**
 * Register a new source type with reputation score
 * Useful for runtime configuration or testing
 */
export function registerSourceType(type: string, score: number): void {
  if (score < 0 || score > 1) {
    throw new Error("Reputation score must be between 0 and 1");
  }
  MAP[type] = score;
}

/**
 * Get all registered source types
 */
export function getSourceTypes(): Record<string, number> {
  return { ...MAP };
}
