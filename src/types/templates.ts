/**
 * Phase 78: Developer Mode Assembly - Template Types
 * Types for project templates and blueprints
 */

export type TemplateVisibility = 'public' | 'private' | 'unlisted';

export type TemplateCategory =
  | 'saas'
  | 'landing'
  | 'ecommerce'
  | 'crypto'
  | 'portfolio'
  | 'internal';

export interface F0Template {
  /** Unique template ID */
  id: string;

  /** URL-friendly slug (e.g., "cashoutswap-starter") */
  slug: string;

  /** Display name (e.g., "CashoutSwap Starter") */
  name: string;

  /** Template description */
  description: string;

  /** Template category */
  category: TemplateCategory;

  /** Complexity level */
  complexity: 'beginner' | 'intermediate' | 'advanced';

  /** Technology stack (e.g., ["Next.js", "Firebase", "Tailwind"]) */
  techStack: string[];

  /** Visibility setting */
  visibility: TemplateVisibility;

  /** Recommended plan for this template */
  recommendedPlan: 'free' | 'starter' | 'pro' | 'ultimate';

  /** Creator user ID */
  createdBy: string;

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;

  /** Optional demo URL */
  demoUrl?: string;

  /** Optional screenshot URL */
  screenshotUrl?: string;

  /** Optional tags for searching */
  tags?: string[];
}

export interface TemplateFile {
  /** File path relative to project root (e.g., "src/app/page.tsx") */
  path: string;

  /** Full file content */
  content: string;

  /** Whether file is binary (reserved for future use) */
  isBinary?: boolean;
}

/**
 * Request to create project from template
 */
export interface CreateProjectFromTemplateRequest {
  /** Template ID to use */
  templateId: string;

  /** New project name */
  name: string;

  /** Optional: Create GitHub repo automatically */
  createGitHubRepo?: boolean;

  /** Optional: GitHub repo name (if createGitHubRepo is true) */
  githubRepoName?: string;
}

/**
 * Response from creating project from template
 */
export interface CreateProjectFromTemplateResponse {
  /** New project ID */
  id: string;

  /** Project name */
  name: string;

  /** Template ID used */
  templateId: string;

  /** Template slug */
  templateSlug: string;

  /** Optional: GitHub repo URL (if created) */
  githubRepoUrl?: string;

  /** Number of files copied */
  fileCount?: number;
}
