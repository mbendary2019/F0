/**
 * Phase 85.4.3: Simple SHA-256 hashing for content comparison
 * Used by heatmap cache to detect file changes
 */

export function sha256(content: string): string {
  // Simple hash function for caching purposes
  // In production, you might want to use a proper crypto library
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}
