// src/lib/agent/projectMemoryUpdate.ts
/**
 * Phase 94.2: Agent-Driven Memory Updates
 *
 * This module enables the agent to automatically update project memory
 * based on conversations, without manual intervention.
 */

import {
  MemorySectionId,
  ProjectMemorySection,
  getProjectMemory,
  upsertMemorySection,
} from './projectMemory';
import { buildProjectMemorySystemPrompt } from './projectMemoryPrompt';
import { askAgent } from '../agents';

// ============================================================================
// Types
// ============================================================================

export type MemoryUpdateMode =
  | 'REPLACE_SECTION'   // استبدال كامل النص
  | 'APPEND_NOTE'       // إضافة سطر جديد في نفس السكشن
  | 'ADD_DECISION'      // يضيف نقطة جديدة في DONE_DECISIONS
  | 'ADD_QUESTION';     // يضيف نقطة في OPEN_QUESTIONS

export interface MemoryUpdateAction {
  sectionId: MemorySectionId;
  mode: MemoryUpdateMode;
  content: string;   // النص اللي هنضيفه/نستبدله
}

export interface MemoryUpdateResult {
  applied: number;
  actions: MemoryUpdateAction[];
}

// ============================================================================
// Memory Update Analysis
// ============================================================================

interface AnalyzeForMemoryUpdatesParams {
  projectId: string;
  lastUserMessage: string;
  lastAssistantMessage: string;
}

/**
 * Analyze conversation and determine what memory updates are needed
 *
 * Uses a lightweight AI call to detect:
 * - New tech stack decisions
 * - Scope changes
 * - Design preferences
 * - Open questions
 * - Final decisions
 */
export async function analyzeForMemoryUpdates(
  params: AnalyzeForMemoryUpdatesParams
): Promise<MemoryUpdateAction[]> {
  const { projectId, lastUserMessage, lastAssistantMessage } = params;

  try {
    // Load current memory for context
    const memory = await getProjectMemory(projectId);
    const memorySummary = memory
      ? buildProjectMemorySystemPrompt(memory)
      : '(No memory yet - this is a new project)';

    // System prompt for Memory Update Agent
    const systemPrompt = `
You are a Memory Update Assistant for a software project.

Your ONLY job is to analyze conversations and decide what important information should be saved to project memory.

CRITICAL RULES:
1. Output ONLY valid JSON array, nothing else
2. If nothing important to save, return empty array: []
3. Use ONLY these sectionId values:
   - "PROJECT_SUMMARY"
   - "AGREED_SCOPE"
   - "TECH_STACK"
   - "DESIGN_LANGUAGE"
   - "AGENT_RULES"
   - "OPEN_QUESTIONS"
   - "DONE_DECISIONS"

4. Use ONLY these mode values:
   - "REPLACE_SECTION" (replace entire section content)
   - "APPEND_NOTE" (add new line to existing content)
   - "ADD_DECISION" (add to DONE_DECISIONS with ✅)
   - "ADD_QUESTION" (add to OPEN_QUESTIONS with ❓)

5. Extract ONLY important decisions, NOT general conversation

Output format (TypeScript-compatible JSON):
[
  {
    "sectionId": "TECH_STACK",
    "mode": "APPEND_NOTE",
    "content": "- Added: Stripe as payment provider"
  }
]

Remember: Output ONLY the JSON array, no markdown, no explanations!
`;

    // User prompt with context
    const userPrompt = `
Current Project Memory (for context):
${memorySummary}

---

Last User Message:
"${lastUserMessage}"

Last Assistant Response:
"${lastAssistantMessage}"

---

Analyze the conversation above and output JSON array of memory updates.
If nothing important to save, output: []
`;

    // Call agent to analyze
    const response = await askAgent(userPrompt, {
      projectId: `memory-update-${projectId}`,
    });

    // Extract JSON from response
    const rawText = response.visible || '';

    // Try to find JSON array in response
    const jsonMatch = rawText.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      console.log('[MemoryUpdate] No JSON found in response, assuming no updates');
      return [];
    }

    const jsonText = jsonMatch[0];
    const parsed = JSON.parse(jsonText);

    if (!Array.isArray(parsed)) {
      console.warn('[MemoryUpdate] Response is not an array:', parsed);
      return [];
    }

    // Validate each action
    const validActions: MemoryUpdateAction[] = [];
    for (const action of parsed) {
      if (
        action &&
        typeof action.sectionId === 'string' &&
        typeof action.mode === 'string' &&
        typeof action.content === 'string'
      ) {
        validActions.push(action as MemoryUpdateAction);
      } else {
        console.warn('[MemoryUpdate] Invalid action skipped:', action);
      }
    }

    if (validActions.length > 0) {
      console.log(`[MemoryUpdate] Found ${validActions.length} memory updates for project ${projectId}`);
    }

    return validActions;
  } catch (error) {
    console.error('[MemoryUpdate] Error analyzing for updates:', error);
    return [];
  }
}

// ============================================================================
// Apply Memory Updates
// ============================================================================

/**
 * Apply memory update actions to Firestore
 *
 * Processes each action and updates the corresponding memory section
 */
export async function applyMemoryUpdates(params: {
  projectId: string;
  actions: MemoryUpdateAction[];
}): Promise<MemoryUpdateResult> {
  const { projectId, actions } = params;

  if (actions.length === 0) {
    return { applied: 0, actions: [] };
  }

  let applied = 0;

  try {
    for (const action of actions) {
      const { sectionId, mode, content } = action;

      await upsertMemorySection({
        projectId,
        sectionId,
        updater: (prev) => {
          const base: ProjectMemorySection = prev || {
            id: sectionId,
            title: sectionId.replace(/_/g, ' '),
            content: '',
            updatedAt: Date.now(),
          };

          let nextContent = base.content || '';

          switch (mode) {
            case 'REPLACE_SECTION':
              // Replace entire section content
              nextContent = content.trim();
              break;

            case 'APPEND_NOTE':
              // Add new line to existing content
              if (nextContent && !nextContent.endsWith('\n')) {
                nextContent += '\n';
              }
              nextContent += content;
              break;

            case 'ADD_DECISION':
              // Add to DONE_DECISIONS with checkmark
              if (nextContent && !nextContent.endsWith('\n')) {
                nextContent += '\n';
              }
              nextContent += `✅ ${content}`;
              break;

            case 'ADD_QUESTION':
              // Add to OPEN_QUESTIONS with question mark
              if (nextContent && !nextContent.endsWith('\n')) {
                nextContent += '\n';
              }
              nextContent += `❓ ${content}`;
              break;

            default:
              console.warn(`[MemoryUpdate] Unknown mode: ${mode}`);
              break;
          }

          applied++;

          return {
            ...base,
            content: nextContent.trim(),
            updatedAt: Date.now(),
          };
        },
      });
    }

    console.log(`[MemoryUpdate] Applied ${applied} updates to project ${projectId}`);

    return { applied, actions };
  } catch (error) {
    console.error('[MemoryUpdate] Error applying updates:', error);
    throw error;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick test: analyze and apply in one call (for testing)
 */
export async function analyzeAndApplyMemoryUpdates(params: {
  projectId: string;
  lastUserMessage: string;
  lastAssistantMessage: string;
}): Promise<MemoryUpdateResult> {
  const actions = await analyzeForMemoryUpdates(params);

  if (actions.length === 0) {
    return { applied: 0, actions: [] };
  }

  return await applyMemoryUpdates({
    projectId: params.projectId,
    actions,
  });
}

/**
 * Enable/disable auto-memory for specific project (future feature)
 */
export interface ProjectMemorySettings {
  autoMemoryEnabled: boolean;
  updateFrequency: 'every_message' | 'on_decision' | 'manual';
}

// Placeholder for future settings management
export async function getProjectMemorySettings(
  projectId: string
): Promise<ProjectMemorySettings> {
  // Future: load from Firestore
  // For now, return defaults
  return {
    autoMemoryEnabled: true,
    updateFrequency: 'every_message',
  };
}
