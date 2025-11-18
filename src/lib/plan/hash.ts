/**
 * Simple deterministic hash function for browser environments
 * Creates consistent IDs from strings to ensure idempotency
 */
export function simpleHash(str: string): string {
  let hash = 0;
  const normalized = str.trim().toLowerCase();

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Generate deterministic phase ID from title
 */
export function phaseIdFromTitle(title: string): string {
  return `ph_${simpleHash(title)}`;
}

/**
 * Generate deterministic task ID from phase title + task title
 */
export function taskIdFromTitle(phaseTitle: string, taskTitle: string): string {
  return `tk_${simpleHash(`${phaseTitle}::${taskTitle}`)}`;
}

/**
 * Create fingerprint of entire plan structure for change detection
 */
export function planFingerprint(phases: Array<{ title: string; tasks: any[] }>): string {
  return simpleHash(JSON.stringify(
    phases.map(p => ({
      title: p.title,
      tasks: p.tasks.map(t => typeof t === 'string' ? t : t.title)
    }))
  ));
}
