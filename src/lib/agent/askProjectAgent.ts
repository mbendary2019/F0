// src/lib/agent/askProjectAgent.ts
/**
 * Phase 94.1: Project Memory System - Agent Wrapper
 * Phase 94.2: Added Auto-Memory Updates
 * Phase 98.3: Added Template Context Integration
 *
 * This wrapper automatically injects project memory into every agent call,
 * ensuring the agent remembers all project-specific decisions and context.
 * It can also automatically update memory based on conversations (Phase 94.2).
 */

import { askAgent, AgentReply } from '../agents';
import { TaskClassification } from '@/types/taskKind';
import { initProjectMemoryIfMissing } from './projectMemory';
import { buildProjectMemorySystemPrompt, isMemoryEmpty } from './projectMemoryPrompt';
import {
  analyzeForMemoryUpdates,
  applyMemoryUpdates,
} from './projectMemoryUpdate';

/**
 * Parameters for askProjectAgent
 * Extends the standard askAgent parameters with projectId requirement
 */
export interface AskProjectAgentParams {
  projectId: string;
  userText: string;
  brief?: string;
  techStack?: any;
  lang?: 'ar' | 'en';
  taskClassification?: TaskClassification;
  // Optional: pass your own memory object if already loaded (performance optimization)
  memoryOverride?: any;
  // Phase 94.2: Auto-update memory based on conversation (default: true)
  autoMemory?: boolean;
  // Phase 98.3: Template context to inject into system prompt
  templateContext?: string;
}

/**
 * Ask the agent with automatic project memory injection
 *
 * This function:
 * 1. Loads project memory from Firestore (or creates default if missing)
 * 2. Builds memory system prompt
 * 3. Merges it with any existing context (brief, techStack)
 * 4. Calls the standard askAgent with enhanced context
 *
 * Usage:
 * ```typescript
 * const response = await askProjectAgent({
 *   projectId: 'abc123',
 *   userText: 'عايز أضيف نظام دفع بالفيزا',
 *   brief: 'This is a SaaS platform...',
 *   lang: 'ar'
 * });
 * ```
 */
export async function askProjectAgent(
  params: AskProjectAgentParams
): Promise<AgentReply> {
  const {
    projectId,
    userText,
    brief,
    techStack,
    lang,
    taskClassification,
    memoryOverride,
    autoMemory = true, // Phase 94.2: Default to true
    templateContext, // Phase 98.3: Template context
  } = params;

  try {
    // 1) Load or initialize project memory
    const memory = memoryOverride || await initProjectMemoryIfMissing(projectId);

    // 2) Build memory system prompt
    const memoryPrompt = buildProjectMemorySystemPrompt(memory);

    // 3) Check if memory is mostly empty (needs initialization)
    const isEmpty = isMemoryEmpty(memory);

    // 4) Build enhanced memory object for askAgent
    // The existing askAgent expects ctx.memory in a specific format,
    // but we want to inject our new memory system as a separate context.
    // We'll pass it as part of the brief for now (simplest integration).

    // Phase 98.3: Merge template context, memory prompt, and brief
    // Template context comes FIRST (highest priority for template projects)
    const enhancedBrief = [
      templateContext || '', // Template context comes FIRST if present
      memoryPrompt, // Memory comes second (high priority)
      brief || '',  // Then project brief
    ]
      .filter(Boolean)
      .join('\n\n---\n\n');

    // 5) Call the existing askAgent with enhanced context
    const response = await askAgent(userText, {
      projectId,
      brief: enhancedBrief,
      techStack,
      lang,
      taskClassification,
      // Keep the old memory format for backward compatibility
      // (askAgent might still use ctx.memory for other purposes)
      memory: {
        revision: memory.version,
        summary: memory.sections.find(s => s.id === 'PROJECT_SUMMARY')?.content || '',
        lastUpdated: new Date(memory.lastUpdatedAt).toISOString(),
      },
    });

    // 6) Log memory usage for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[askProjectAgent] Memory injected:', {
        projectId,
        memoryTokens: memory.approxTokens || 0,
        isEmpty,
        sectionsCount: memory.sections.length,
      });
    }

    // 7) Phase 94.2: Auto-memory updates (background logic)
    if (autoMemory) {
      try {
        // Extract assistant's response text
        const assistantText = response.visible || '';

        // Only proceed if we have both user and assistant messages
        if (userText && assistantText) {
          console.log('[askProjectAgent] Analyzing conversation for memory updates...');

          const actions = await analyzeForMemoryUpdates({
            projectId,
            lastUserMessage: userText,
            lastAssistantMessage: assistantText,
          });

          if (actions.length > 0) {
            console.log(`[askProjectAgent] Applying ${actions.length} memory updates...`);
            await applyMemoryUpdates({ projectId, actions });
            console.log('[askProjectAgent] Memory updates applied successfully');
          } else {
            console.log('[askProjectAgent] No memory updates needed');
          }
        }
      } catch (e) {
        console.warn('[askProjectAgent] autoMemory failed (non-critical):', e);
        // Don't throw - memory update failure should not break the main flow
      }
    }

    return response;
  } catch (error) {
    console.error('[askProjectAgent] Error:', error);

    // Fallback: call askAgent without memory if there's an error
    console.warn('[askProjectAgent] Falling back to askAgent without memory');
    return askAgent(userText, {
      projectId,
      brief,
      techStack,
      lang,
      taskClassification,
    });
  }
}

/**
 * Utility: Get project memory without making agent call
 * Useful for pre-loading memory or checking memory state
 */
export async function getProjectMemoryForAgent(projectId: string) {
  const memory = await initProjectMemoryIfMissing(projectId);
  return {
    memory,
    isEmpty: isMemoryEmpty(memory),
    prompt: buildProjectMemorySystemPrompt(memory),
  };
}
