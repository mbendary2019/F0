/**
 * Deterministic ID Generation System
 * Prevents task/phase duplication using stable keys
 */

/**
 * Slugify text to create stable identifiers
 * Supports Arabic and English characters
 */
export function slugify(s: string): string {
  if (!s) return '';

  return s
    .toLowerCase()
    .trim()
    // Keep Arabic, English, numbers, spaces, and hyphens
    .replace(/[^\u0600-\u06FF\w\s-]/g, '')
    // Replace multiple spaces with single hyphen
    .replace(/\s+/g, '-')
    // Replace multiple hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-|-$/g, '')
    // Limit length to prevent extremely long IDs
    .slice(0, 50);
}

/**
 * Generate deterministic phase key
 * Format: phase-{slug}
 */
export function phaseKey(title: string): string {
  const slug = slugify(title);
  return `phase-${slug || 'untitled'}`;
}

/**
 * Generate deterministic task key
 * Format: {phaseKey}__{taskSlug}
 * Example: phase-4__تهيئة-stripe
 */
export function taskKey(phaseKey: string, title: string): string {
  const slug = slugify(title);
  return `${phaseKey}__${slug || 'untitled'}`;
}

/**
 * Legacy compatibility - generate phase ID
 * @deprecated Use phaseKey instead
 */
export function generateId(prefix: string, title: string): string {
  return phaseKey(title);
}

/**
 * Legacy compatibility - generate task ID
 * @deprecated Use taskKey instead
 */
export function generateTaskId(phaseTitle: string, taskTitle: string): string {
  const pKey = phaseKey(phaseTitle);
  return taskKey(pKey, taskTitle);
}
