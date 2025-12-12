/**
 * Phase 94.3: Project Memory System
 *
 * Stores and retrieves structured project memory in Firestore
 * Memory sections persist decisions, scope, tech stack, etc.
 *
 * Schema:
 *   ops_projects/{projectId}/_meta/memory
 *     sections.AGREED_SCOPE.text = "..."
 *     sections.TECH_STACK.text = "..."
 *     ...
 */

import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

const db = adminDb;

// ============================================
// Types
// ============================================

export type MemorySectionKey =
  | 'AGREED_SCOPE'
  | 'TECH_STACK'
  | 'ARCHITECTURE'
  | 'RISKS'
  | 'CONSTRAINTS'
  | 'USER_PREFS';

export interface MemorySection {
  text: string;
  updatedAt: Timestamp;
  updatedBy?: string;
}

export interface ProjectMemory {
  sections: Partial<Record<MemorySectionKey, MemorySection>>;
}

export interface MemoryUpdateJson {
  section: MemorySectionKey;
  op: 'replace' | 'append';
  text: string;
}

// ============================================
// Helpers
// ============================================

function getProjectRef(projectId: string, collectionName: string = 'ops_projects') {
  return db.collection(collectionName).doc(projectId);
}

function getMemoryRef(projectId: string, collectionName: string = 'ops_projects') {
  return getProjectRef(projectId, collectionName).collection('_meta').doc('memory');
}

// ============================================
// Get Project Memory
// ============================================

/**
 * Get the full project memory document
 */
export async function getProjectMemory(
  projectId: string,
  collectionName: string = 'ops_projects'
): Promise<ProjectMemory> {
  const ref = getMemoryRef(projectId, collectionName);
  const snap = await ref.get();

  if (!snap.exists) {
    return { sections: {} };
  }

  const data = snap.data() as any;
  return {
    sections: data.sections ?? {},
  };
}

// ============================================
// Update Memory Section (replace)
// ============================================

/**
 * Replace a memory section with new text
 */
export async function updateMemorySection(params: {
  projectId: string;
  section: MemorySectionKey;
  text: string;
  updatedBy?: string;
  collectionName?: string;
}): Promise<void> {
  const { projectId, section, text, updatedBy, collectionName = 'ops_projects' } = params;
  const ref = getMemoryRef(projectId, collectionName);

  const now = Timestamp.now();

  await ref.set(
    {
      sections: {
        [section]: {
          text,
          updatedAt: now,
          ...(updatedBy ? { updatedBy } : {}),
        },
      },
    },
    { merge: true }
  );

  console.log(`[Project Memory] Updated section ${section} for project ${projectId}`);
}

// ============================================
// Append to Memory Section
// ============================================

/**
 * Append text to an existing memory section
 */
export async function appendToMemorySection(params: {
  projectId: string;
  section: MemorySectionKey;
  delta: string;
  separator?: string;
  updatedBy?: string;
  collectionName?: string;
}): Promise<void> {
  const {
    projectId,
    section,
    delta,
    separator = '\n\n',
    updatedBy,
    collectionName = 'ops_projects',
  } = params;
  const ref = getMemoryRef(projectId, collectionName);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Timestamp.now();

    const current = (snap.data()?.sections ?? {})[section] as MemorySection | undefined;

    const newText = current?.text ? `${current.text}${separator}${delta}` : delta;

    tx.set(
      ref,
      {
        sections: {
          [section]: {
            text: newText,
            updatedAt: now,
            ...(updatedBy
              ? { updatedBy }
              : current?.updatedBy
                ? { updatedBy: current.updatedBy }
                : {}),
          },
        },
      },
      { merge: true }
    );
  });

  console.log(`[Project Memory] Appended to section ${section} for project ${projectId}`);
}

// ============================================
// Format Memory for Prompt
// ============================================

/**
 * Convert project memory to a formatted string for inclusion in system prompt
 */
export function formatMemoryForPrompt(memory: ProjectMemory): string {
  const { sections } = memory;

  const lines: string[] = [];

  if (sections.AGREED_SCOPE?.text) {
    lines.push(`AGREED_SCOPE:\n${sections.AGREED_SCOPE.text}`);
  }
  if (sections.TECH_STACK?.text) {
    lines.push(`TECH_STACK:\n${sections.TECH_STACK.text}`);
  }
  if (sections.ARCHITECTURE?.text) {
    lines.push(`ARCHITECTURE:\n${sections.ARCHITECTURE.text}`);
  }
  if (sections.RISKS?.text) {
    lines.push(`RISKS:\n${sections.RISKS.text}`);
  }
  if (sections.CONSTRAINTS?.text) {
    lines.push(`CONSTRAINTS:\n${sections.CONSTRAINTS.text}`);
  }
  if (sections.USER_PREFS?.text) {
    lines.push(`USER_PREFS:\n${sections.USER_PREFS.text}`);
  }

  if (!lines.length) {
    return 'No prior project memory.';
  }

  return lines.join('\n\n');
}

// ============================================
// Apply Memory Updates from F0_JSON
// ============================================

/**
 * Apply memory updates from agent's F0_JSON response
 *
 * Expected format in F0_JSON:
 * "memory_updates": [
 *   { "section": "TECH_STACK", "op": "replace", "text": "Next.js 14 + Firebase..." },
 *   { "section": "RISKS", "op": "append", "text": "- Vendor lock-in on Firebase" }
 * ]
 */
export async function applyMemoryUpdatesFromJson(params: {
  projectId: string;
  updates: MemoryUpdateJson[];
  updatedBy?: string;
  collectionName?: string;
}): Promise<number> {
  const { projectId, updates, updatedBy, collectionName = 'ops_projects' } = params;

  let appliedCount = 0;

  for (const u of updates) {
    if (!u.section || !u.text) {
      console.warn('[Project Memory] Skipping invalid update:', u);
      continue;
    }

    // Validate section key
    const validSections: MemorySectionKey[] = [
      'AGREED_SCOPE',
      'TECH_STACK',
      'ARCHITECTURE',
      'RISKS',
      'CONSTRAINTS',
      'USER_PREFS',
    ];

    if (!validSections.includes(u.section)) {
      console.warn(`[Project Memory] Invalid section key: ${u.section}`);
      continue;
    }

    if (u.op === 'replace') {
      await updateMemorySection({
        projectId,
        section: u.section,
        text: u.text,
        updatedBy,
        collectionName,
      });
      appliedCount++;
    } else if (u.op === 'append') {
      await appendToMemorySection({
        projectId,
        section: u.section,
        delta: u.text,
        updatedBy,
        collectionName,
      });
      appliedCount++;
    } else {
      console.warn(`[Project Memory] Unknown op: ${u.op}`);
    }
  }

  console.log(`[Project Memory] Applied ${appliedCount} memory updates for project ${projectId}`);
  return appliedCount;
}

// ============================================
// Get Memory Section
// ============================================

/**
 * Get a specific memory section
 */
export async function getMemorySection(
  projectId: string,
  section: MemorySectionKey,
  collectionName: string = 'ops_projects'
): Promise<MemorySection | null> {
  const memory = await getProjectMemory(projectId, collectionName);
  return memory.sections[section] ?? null;
}

// ============================================
// Clear Memory Section
// ============================================

/**
 * Clear a specific memory section
 */
export async function clearMemorySection(params: {
  projectId: string;
  section: MemorySectionKey;
  collectionName?: string;
}): Promise<void> {
  const { projectId, section, collectionName = 'ops_projects' } = params;
  const ref = getMemoryRef(projectId, collectionName);

  // Use FieldValue.delete() to remove the section
  const { FieldValue } = await import('firebase-admin/firestore');

  await ref.update({
    [`sections.${section}`]: FieldValue.delete(),
  });

  console.log(`[Project Memory] Cleared section ${section} for project ${projectId}`);
}

// ============================================
// Initialize Default Memory
// ============================================

/**
 * Initialize project memory with default sections based on F0_JSON
 */
export async function initializeMemoryFromF0Json(params: {
  projectId: string;
  summary?: string;
  target_users?: string[];
  platforms?: string[];
  assumptions?: Record<string, string>;
  collectionName?: string;
}): Promise<void> {
  const {
    projectId,
    summary,
    target_users,
    platforms,
    assumptions,
    collectionName = 'ops_projects',
  } = params;

  const updates: MemoryUpdateJson[] = [];

  // Build AGREED_SCOPE from summary and target users
  if (summary || target_users?.length) {
    const scopeLines: string[] = [];
    if (summary) scopeLines.push(summary);
    if (target_users?.length) {
      scopeLines.push(`Target Users: ${target_users.join(', ')}`);
    }
    if (platforms?.length) {
      scopeLines.push(`Platforms: ${platforms.join(', ')}`);
    }
    updates.push({
      section: 'AGREED_SCOPE',
      op: 'replace',
      text: scopeLines.join('\n'),
    });
  }

  // Build TECH_STACK from assumptions
  if (assumptions) {
    const techLines: string[] = [];
    if (assumptions.frontend) techLines.push(`Frontend: ${assumptions.frontend}`);
    if (assumptions.backend) techLines.push(`Backend: ${assumptions.backend}`);
    if (assumptions.db) techLines.push(`Database: ${assumptions.db}`);
    if (assumptions.auth) techLines.push(`Auth: ${assumptions.auth}`);
    if (assumptions.payments) techLines.push(`Payments: ${assumptions.payments}`);
    if (assumptions.realtime_data) techLines.push(`Realtime: ${assumptions.realtime_data}`);

    if (techLines.length) {
      updates.push({
        section: 'TECH_STACK',
        op: 'replace',
        text: techLines.join('\n'),
      });
    }
  }

  if (updates.length) {
    await applyMemoryUpdatesFromJson({
      projectId,
      updates,
      updatedBy: 'system',
      collectionName,
    });
  }
}
