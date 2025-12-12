// src/lib/agent/projectMemory.ts
/**
 * Phase 94.1: Project Memory System
 *
 * This module handles persistent memory for each project, allowing the agent to:
 * - Remember project decisions, scope, tech stack
 * - Maintain context across sessions
 * - Avoid repeating questions or contradicting previous decisions
 */

import { adminDb as db } from '@/lib/firebaseAdmin';

// ============================================================================
// Types
// ============================================================================

export type MemorySectionId =
  | 'PROJECT_SUMMARY'      // ملخص المشروع الحالي
  | 'AGREED_SCOPE'         // اللي اتفقنا ننفّذه في النسخة دي
  | 'TECH_STACK'           // التكنولوجي الثابتة (Next, Firebase, Stripe...)
  | 'DESIGN_LANGUAGE'      // النيون، الماسكوت، الـ UX rules
  | 'AGENT_RULES'          // ازاي الوكيل يتصرف مع صاحب المشروع ده
  | 'OPEN_QUESTIONS'       // أسئلة/نقاط لسه معلّقة
  | 'DONE_DECISIONS';      // قرارات نهائية تم إغلاقها

export interface ProjectMemorySection {
  id: MemorySectionId;
  title: string;
  content: string;        // نص عادي (ملخّص مندمج مش مجرد لوج)
  updatedAt: number;      // Date.now()
}

export interface ProjectMemoryDocument {
  projectId: string;
  sections: ProjectMemorySection[];
  lastUpdatedAt: number;
  version: number;        // عشان لو حبينا نغيّر الـ format مستقبلاً
  approxTokens?: number;  // تقريب حجم الـ prompt لو حبيت تحسبه
}

// Future expansion (Phase 94.2+):
export type MemoryEventType =
  | 'USER_DECISION'
  | 'AGENT_SUMMARY'
  | 'SYSTEM_MIGRATION'
  | 'SCOPE_CHANGE';

export interface ProjectMemoryEvent {
  id: string;
  projectId: string;
  type: MemoryEventType;
  text: string;
  createdAt: number;
  createdBy: 'user' | 'agent' | 'system';
  sourcePhase?: string; // "84.1", "94.1" ...
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get Firestore document path for project memory
 */
const MEMORY_DOC_PATH = (projectId: string) =>
  `projects/${projectId}/meta/memory`;

/**
 * Get project memory from Firestore
 * Returns null if memory doesn't exist yet
 */
export async function getProjectMemory(
  projectId: string
): Promise<ProjectMemoryDocument | null> {
  try {
    const ref = db.doc(MEMORY_DOC_PATH(projectId));
    const snap = await ref.get();

    if (!snap.exists) {
      return null;
    }

    return snap.data() as ProjectMemoryDocument;
  } catch (error) {
    console.error('[getProjectMemory] Error fetching memory:', error);
    return null;
  }
}

/**
 * Initialize project memory with default sections if it doesn't exist
 * Returns existing memory if already present
 */
export async function initProjectMemoryIfMissing(
  projectId: string
): Promise<ProjectMemoryDocument> {
  // Check if memory already exists
  const existing = await getProjectMemory(projectId);
  if (existing) {
    return existing;
  }

  const now = Date.now();

  // Create default memory document
  const doc: ProjectMemoryDocument = {
    projectId,
    version: 1,
    lastUpdatedAt: now,
    sections: [
      {
        id: 'PROJECT_SUMMARY',
        title: 'Project Summary',
        content: 'No summary yet. The agent should update this after first setup.',
        updatedAt: now,
      },
      {
        id: 'AGREED_SCOPE',
        title: 'Agreed Scope',
        content: 'Scope not defined yet.',
        updatedAt: now,
      },
      {
        id: 'TECH_STACK',
        title: 'Tech Stack',
        content: 'Tech stack not defined yet.',
        updatedAt: now,
      },
      {
        id: 'DESIGN_LANGUAGE',
        title: 'Design Language',
        content: 'Design preferences not defined yet.',
        updatedAt: now,
      },
      {
        id: 'AGENT_RULES',
        title: 'Agent Behaviour Rules',
        content:
          'Always speak to the user as F0 Agent. Ask for clarification only when necessary. Respect previous decisions stored here.',
        updatedAt: now,
      },
      {
        id: 'OPEN_QUESTIONS',
        title: 'Open Questions',
        content: '',
        updatedAt: now,
      },
      {
        id: 'DONE_DECISIONS',
        title: 'Final Decisions',
        content: '',
        updatedAt: now,
      },
    ],
  };

  try {
    const ref = db.doc(MEMORY_DOC_PATH(projectId));
    await ref.set(doc);
    console.log(`[initProjectMemory] Created memory for project: ${projectId}`);
    return doc;
  } catch (error) {
    console.error('[initProjectMemory] Error creating memory:', error);
    throw error;
  }
}

/**
 * Update or insert a specific memory section
 * Uses transaction to ensure consistency
 */
export async function upsertMemorySection(params: {
  projectId: string;
  sectionId: MemorySectionId;
  updater: (prev: ProjectMemorySection | null) => ProjectMemorySection;
}): Promise<void> {
  const { projectId, sectionId, updater } = params;
  const ref = db.doc(MEMORY_DOC_PATH(projectId));

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();

      let doc: ProjectMemoryDocument;

      if (!snap.exists) {
        // Initialize if doesn't exist
        doc = await initProjectMemoryIfMissing(projectId);
        // Re-fetch to get the initialized doc
        const newSnap = await tx.get(ref);
        doc = newSnap.data() as ProjectMemoryDocument;
      } else {
        doc = snap.data() as ProjectMemoryDocument;
      }

      // Find existing section
      const idx = doc.sections.findIndex((s) => s.id === sectionId);
      const prev = idx >= 0 ? doc.sections[idx] : null;

      // Apply updater function
      const nextSection = updater(prev);

      // Ensure updatedAt is set
      if (!nextSection.updatedAt) {
        nextSection.updatedAt = now;
      }

      // Update or insert section
      if (idx >= 0) {
        doc.sections[idx] = nextSection;
      } else {
        doc.sections.push(nextSection);
      }

      // Update document timestamp
      doc.lastUpdatedAt = now;

      // Estimate token count (rough approximation: ~4 chars per token)
      const totalChars = doc.sections.reduce((sum, s) => sum + (s.content?.length || 0), 0);
      doc.approxTokens = Math.ceil(totalChars / 4);

      tx.set(ref, doc);
    });

    console.log(`[upsertMemorySection] Updated ${sectionId} for project: ${projectId}`);
  } catch (error) {
    console.error('[upsertMemorySection] Error updating section:', error);
    throw error;
  }
}

/**
 * Update multiple sections at once (more efficient than multiple upserts)
 */
export async function updateMultipleMemorySections(params: {
  projectId: string;
  updates: Array<{
    sectionId: MemorySectionId;
    updater: (prev: ProjectMemorySection | null) => ProjectMemorySection;
  }>;
}): Promise<void> {
  const { projectId, updates } = params;
  const ref = db.doc(MEMORY_DOC_PATH(projectId));

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();

      let doc: ProjectMemoryDocument;

      if (!snap.exists) {
        doc = await initProjectMemoryIfMissing(projectId);
        const newSnap = await tx.get(ref);
        doc = newSnap.data() as ProjectMemoryDocument;
      } else {
        doc = snap.data() as ProjectMemoryDocument;
      }

      // Apply all updates
      for (const { sectionId, updater } of updates) {
        const idx = doc.sections.findIndex((s) => s.id === sectionId);
        const prev = idx >= 0 ? doc.sections[idx] : null;
        const nextSection = updater(prev);

        if (!nextSection.updatedAt) {
          nextSection.updatedAt = now;
        }

        if (idx >= 0) {
          doc.sections[idx] = nextSection;
        } else {
          doc.sections.push(nextSection);
        }
      }

      doc.lastUpdatedAt = now;

      // Recalculate token estimate
      const totalChars = doc.sections.reduce((sum, s) => sum + (s.content?.length || 0), 0);
      doc.approxTokens = Math.ceil(totalChars / 4);

      tx.set(ref, doc);
    });

    console.log(`[updateMultipleMemorySections] Updated ${updates.length} sections for project: ${projectId}`);
  } catch (error) {
    console.error('[updateMultipleMemorySections] Error:', error);
    throw error;
  }
}

/**
 * Get a specific memory section
 */
export async function getMemorySection(
  projectId: string,
  sectionId: MemorySectionId
): Promise<ProjectMemorySection | null> {
  const memory = await getProjectMemory(projectId);
  if (!memory) return null;

  return memory.sections.find((s) => s.id === sectionId) || null;
}

/**
 * Clear/reset a specific memory section
 */
export async function clearMemorySection(
  projectId: string,
  sectionId: MemorySectionId
): Promise<void> {
  await upsertMemorySection({
    projectId,
    sectionId,
    updater: (prev) => ({
      id: sectionId,
      title: prev?.title || sectionId.replace(/_/g, ' '),
      content: '',
      updatedAt: Date.now(),
    }),
  });
}

/**
 * Delete entire project memory (careful!)
 */
export async function deleteProjectMemory(projectId: string): Promise<void> {
  try {
    const ref = db.doc(MEMORY_DOC_PATH(projectId));
    await ref.delete();
    console.log(`[deleteProjectMemory] Deleted memory for project: ${projectId}`);
  } catch (error) {
    console.error('[deleteProjectMemory] Error:', error);
    throw error;
  }
}
