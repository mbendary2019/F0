// src/lib/server/templateKickoff.ts
/**
 * Phase 98.3: Template-Aware Agent Kickoff
 *
 * Helper functions for managing template kickoff state and building
 * template context for the agent system prompt.
 */

import { getFirestoreAdmin } from './firebase';

// Get Firestore instance
const adminDb = getFirestoreAdmin();

// ============================================
// Types
// ============================================

export interface TemplateKickoffState {
  createdFromTemplate: string | null;
  kickoff: {
    done: boolean;
    doneAt: number | null;
    lastSuggestionHash: string | null;
  };
}

export interface TemplateContextArgs {
  templateSlug: string;
  templateTitle: string;
  templateTitleAr?: string;
  templateSummary: string;
  templateSummaryAr?: string;
  templatePlan?: string;
  templatePlanAr?: string;
  targetUsers?: string[];
  platforms: string[];
  techStack: string[];
  phases?: Array<{ id: string; title: string; goals: string[] }>;
  category?: string;
  difficulty?: string;
  estimatedMvpDays?: number;
}

// ============================================
// Firestore Operations
// ============================================

/**
 * Get template kickoff state for a project
 * Reads from ops_projects/{projectId}
 */
export async function getTemplateKickoffState(
  projectId: string
): Promise<TemplateKickoffState | null> {
  try {
    console.log('[templateKickoff] Getting state for project:', projectId);
    const projectRef = adminDb.collection('ops_projects').doc(projectId);
    const projectDoc = await projectRef.get();
    console.log('[templateKickoff] Doc exists:', projectDoc.exists);

    if (!projectDoc.exists) {
      console.log('[templateKickoff] Project not found in ops_projects');
      return null;
    }

    const data = projectDoc.data();
    if (!data) return null;

    console.log('[templateKickoff] Project data keys:', Object.keys(data));
    console.log('[templateKickoff] templateSlug:', data.templateSlug);
    console.log('[templateKickoff] createdFromTemplate:', data.createdFromTemplate);

    // Check if project was created from template
    const templateSlug = data.templateSlug || data.createdFromTemplate || null;
    console.log('[templateKickoff] Resolved templateSlug:', templateSlug);

    if (!templateSlug) {
      return null;
    }

    // Get kickoff state from _meta/template subcollection or inline field
    const kickoffData = data.templateKickoff || {
      done: false,
      doneAt: null,
      lastSuggestionHash: null,
    };

    return {
      createdFromTemplate: templateSlug,
      kickoff: {
        done: kickoffData.done ?? false,
        doneAt: kickoffData.doneAt ?? null,
        lastSuggestionHash: kickoffData.lastSuggestionHash ?? null,
      },
    };
  } catch (error) {
    console.error('[templateKickoff] Error getting state:', error);
    return null;
  }
}

/**
 * Mark template kickoff as done
 * Updates ops_projects/{projectId}
 */
export async function markTemplateKickoffDone(projectId: string): Promise<boolean> {
  try {
    const projectRef = adminDb.collection('ops_projects').doc(projectId);

    await projectRef.update({
      'templateKickoff.done': true,
      'templateKickoff.doneAt': Date.now(),
      updatedAt: Date.now(),
    });

    console.log('[templateKickoff] Marked kickoff done for project:', projectId);
    return true;
  } catch (error) {
    console.error('[templateKickoff] Error marking done:', error);
    return false;
  }
}

/**
 * Get full template data from marketplace
 */
export async function getTemplateData(templateSlug: string) {
  try {
    const templateRef = adminDb.collection('ops_marketplace_apps').doc(templateSlug);
    const templateDoc = await templateRef.get();

    if (!templateDoc.exists) {
      console.warn('[templateKickoff] Template not found:', templateSlug);
      return null;
    }

    return { slug: templateDoc.id, ...templateDoc.data() };
  } catch (error) {
    console.error('[templateKickoff] Error getting template:', error);
    return null;
  }
}

// ============================================
// Context Building
// ============================================

/**
 * Build template context instructions for the agent system prompt
 */
export function buildTemplateKickoffInstructions(args: TemplateContextArgs): string {
  const {
    templateSlug,
    templateTitle,
    templateTitleAr,
    templateSummary,
    templateSummaryAr,
    templatePlan,
    platforms,
    techStack,
    phases,
    category,
    difficulty,
    estimatedMvpDays,
  } = args;

  const parts: string[] = [];

  // Header
  parts.push(`## TEMPLATE CONTEXT (CRITICAL - DO NOT IGNORE)`);
  parts.push(``);
  parts.push(`This project was created from a marketplace template. You MUST respect this template context unless the user explicitly asks to change it.`);
  parts.push(``);

  // Template Info
  parts.push(`### Template Information`);
  parts.push(`- **Template:** ${templateTitle}${templateTitleAr ? ` (${templateTitleAr})` : ''}`);
  parts.push(`- **Slug:** ${templateSlug}`);
  if (category) parts.push(`- **Category:** ${category}`);
  if (difficulty) parts.push(`- **Difficulty:** ${difficulty}`);
  if (estimatedMvpDays) parts.push(`- **Estimated MVP Days:** ${estimatedMvpDays}`);
  parts.push(``);

  // Summary
  parts.push(`### Project Summary`);
  parts.push(templateSummary);
  if (templateSummaryAr) {
    parts.push(``);
    parts.push(`(Arabic: ${templateSummaryAr})`);
  }
  parts.push(``);

  // Platforms & Tech Stack
  parts.push(`### Target Platforms`);
  parts.push(platforms.map(p => `- ${p}`).join('\n'));
  parts.push(``);

  parts.push(`### Tech Stack`);
  parts.push(techStack.map(t => `- ${t}`).join('\n'));
  parts.push(``);

  // Full Plan (if available)
  if (templatePlan) {
    parts.push(`### Template Plan / Full Description`);
    parts.push(templatePlan);
    parts.push(``);
  }

  // Pre-defined Phases (if available)
  if (phases && phases.length > 0) {
    parts.push(`### Suggested Phases`);
    phases.forEach((phase, i) => {
      parts.push(`**Phase ${i + 1}: ${phase.title}**`);
      if (phase.goals && phase.goals.length > 0) {
        phase.goals.forEach(goal => {
          parts.push(`  - ${goal}`);
        });
      }
      parts.push(``);
    });
  }

  // Instructions
  parts.push(`### Agent Instructions for Template Projects`);
  parts.push(`1. When the user first opens this project, IMMEDIATELY present a summary of the template plan.`);
  parts.push(`2. Show the suggested phases and tasks in a clear, structured format.`);
  parts.push(`3. Offer the user two options:`);
  parts.push(`   - "Start executing the plan as-is"`);
  parts.push(`   - "Review and customize the plan first"`);
  parts.push(`4. If the user wants to customize, enter a collaborative plan editing mode.`);
  parts.push(`5. Once confirmed, save the plan and begin execution.`);
  parts.push(`6. Always maintain the template's core architecture unless explicitly changed.`);
  parts.push(``);

  return parts.join('\n');
}

/**
 * Build a shorter template context for ongoing conversations
 * (after kickoff is done)
 */
export function buildTemplateReferenceContext(args: Pick<TemplateContextArgs, 'templateSlug' | 'templateTitle' | 'techStack' | 'platforms'>): string {
  const { templateSlug, templateTitle, techStack, platforms } = args;

  return `
## Template Reference
This project is based on the "${templateTitle}" template (${templateSlug}).
- Platforms: ${platforms.join(', ')}
- Tech Stack: ${techStack.join(', ')}

Maintain consistency with the template's architecture and patterns.
`.trim();
}
