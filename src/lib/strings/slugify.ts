/**
 * String utilities for generating slugs and IDs
 */

/**
 * Converts a string to a URL-safe slug
 * Handles Arabic and English text
 *
 * @param str - Input string
 * @returns URL-safe slug
 *
 * @example
 * slugify("Phase 1: Project Setup") // "phase-1-project-setup"
 * slugify("المرحلة الأولى") // "المرحلة-الأولى"
 */
export function slugify(str: string): string {
  if (!str) return '';

  return str
    .toString()
    .trim()
    .toLowerCase()
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Remove special characters except Arabic, alphanumeric, and hyphens
    .replace(/[^\u0600-\u06FFa-z0-9\-]/gi, '')
    // Replace multiple hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-|-$/g, '');
}

/**
 * Generates a deterministic ID from title
 * Uses slugify for consistency
 *
 * @param prefix - ID prefix (e.g., "phase", "task")
 * @param title - Title to convert to ID
 * @returns Deterministic ID
 *
 * @example
 * generateId("phase", "Setup Database") // "phase-setup-database"
 */
export function generateId(prefix: string, title: string): string {
  const slug = slugify(title);
  return `${prefix}-${slug}`;
}

/**
 * Generates a task ID from phase and task titles
 *
 * @param phaseTitle - Phase title
 * @param taskTitle - Task title
 * @returns Deterministic task ID
 *
 * @example
 * generateTaskId("Phase 1", "Install dependencies") // "task-phase-1-install-dependencies"
 */
export function generateTaskId(phaseTitle: string, taskTitle: string): string {
  const phaseSlug = slugify(phaseTitle);
  const taskSlug = slugify(taskTitle);
  return `task-${phaseSlug}-${taskSlug}`;
}
