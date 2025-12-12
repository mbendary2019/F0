// src/lib/agent/projectMemoryPrompt.ts
/**
 * Phase 94.1: Project Memory System - Prompt Builder
 *
 * This module builds system prompts from project memory,
 * injecting all relevant context into the agent's knowledge.
 */

import { ProjectMemoryDocument, ProjectMemorySection } from './projectMemory';

/**
 * Build system prompt from project memory
 * This will be injected into every agent call for this project
 */
export function buildProjectMemorySystemPrompt(
  memory: ProjectMemoryDocument
): string {
  const lines: string[] = [];

  // Header
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('📋 PROJECT MEMORY — Read and Respect All Sections Below');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('You are the F0 Project Agent for this specific project.');
  lines.push('');
  lines.push('CRITICAL INSTRUCTIONS:');
  lines.push('- You MUST obey and respect all project-specific decisions stored below');
  lines.push('- NEVER contradict these decisions unless the user explicitly requests changes');
  lines.push('- DO NOT repeat questions about things already decided');
  lines.push('- If a section says "not defined yet", you can ask about it');
  lines.push('- If a section has content, treat it as LOCKED and AGREED upon');
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────');
  lines.push('');

  // Add each non-empty section
  for (const section of memory.sections) {
    // Skip empty sections (except AGENT_RULES which should always show)
    if (!section.content?.trim() && section.id !== 'AGENT_RULES') {
      continue;
    }

    lines.push(`## ${section.title} [${section.id}]`);
    lines.push('');

    const content = section.content.trim();
    if (content) {
      lines.push(content);
    } else {
      lines.push('(No content yet)');
    }

    lines.push('');
    lines.push('───────────────────────────────────────────────────────────');
    lines.push('');
  }

  // Footer
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('END OF PROJECT MEMORY');
  lines.push(`Last Updated: ${new Date(memory.lastUpdatedAt).toISOString()}`);
  if (memory.approxTokens) {
    lines.push(`Approx Memory Size: ~${memory.approxTokens} tokens`);
  }
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  return lines.join('\n');
}

/**
 * Build a compact version of memory prompt (for token-limited scenarios)
 * Only includes sections with actual content
 */
export function buildCompactMemoryPrompt(
  memory: ProjectMemoryDocument
): string {
  const lines: string[] = [];

  lines.push('📋 PROJECT MEMORY (Respect all decisions below):');
  lines.push('');

  for (const section of memory.sections) {
    const content = section.content?.trim();
    if (!content) continue;

    lines.push(`**${section.title}:**`);
    lines.push(content);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get a human-readable summary of memory sections
 * Useful for debugging or showing to users
 */
export function getMemorySummary(memory: ProjectMemoryDocument): string {
  const lines: string[] = [];

  lines.push(`Project: ${memory.projectId}`);
  lines.push(`Last Updated: ${new Date(memory.lastUpdatedAt).toLocaleString()}`);
  lines.push(`Version: ${memory.version}`);

  if (memory.approxTokens) {
    lines.push(`Estimated Size: ~${memory.approxTokens} tokens`);
  }

  lines.push('');
  lines.push('Sections:');

  for (const section of memory.sections) {
    const hasContent = section.content && section.content.trim().length > 0;
    const contentLength = section.content?.length || 0;
    const status = hasContent ? `✓ ${contentLength} chars` : '✗ Empty';

    lines.push(`  - ${section.title} (${section.id}): ${status}`);
  }

  return lines.join('\n');
}

/**
 * Check if memory is mostly empty (needs initialization)
 */
export function isMemoryEmpty(memory: ProjectMemoryDocument): boolean {
  // Check if most sections are empty or have default "not defined" text
  let emptyCount = 0;

  for (const section of memory.sections) {
    const content = section.content?.trim().toLowerCase() || '';

    if (
      !content ||
      content.includes('not defined yet') ||
      content.includes('no summary yet') ||
      content.includes('scope not defined') ||
      content.includes('tech stack not defined') ||
      content.includes('design preferences not defined')
    ) {
      emptyCount++;
    }
  }

  // If more than half sections are empty, consider memory empty
  return emptyCount > memory.sections.length / 2;
}

/**
 * Suggest which sections need to be filled based on memory state
 */
export function getSuggestedSectionsToFill(
  memory: ProjectMemoryDocument
): string[] {
  const suggestions: string[] = [];

  for (const section of memory.sections) {
    const content = section.content?.trim().toLowerCase() || '';

    // Skip OPEN_QUESTIONS and DONE_DECISIONS (they can be empty)
    if (section.id === 'OPEN_QUESTIONS' || section.id === 'DONE_DECISIONS') {
      continue;
    }

    // Check if section is empty or has placeholder text
    if (
      !content ||
      content.includes('not defined yet') ||
      content.includes('no summary yet') ||
      content.includes('not defined')
    ) {
      suggestions.push(section.id);
    }
  }

  return suggestions;
}

/**
 * Format memory section for display to user (markdown)
 */
export function formatSectionForDisplay(section: ProjectMemorySection): string {
  const lines: string[] = [];

  lines.push(`### ${section.title}`);
  lines.push('');

  if (section.content && section.content.trim()) {
    lines.push(section.content.trim());
  } else {
    lines.push('_No content yet_');
  }

  lines.push('');
  lines.push(`_Last updated: ${new Date(section.updatedAt).toLocaleString()}_`);

  return lines.join('\n');
}

/**
 * Format entire memory for display to user
 */
export function formatMemoryForDisplay(memory: ProjectMemoryDocument): string {
  const lines: string[] = [];

  lines.push('# Project Memory');
  lines.push('');
  lines.push(`**Project ID:** ${memory.projectId}`);
  lines.push(`**Last Updated:** ${new Date(memory.lastUpdatedAt).toLocaleString()}`);

  if (memory.approxTokens) {
    lines.push(`**Estimated Size:** ~${memory.approxTokens} tokens`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  for (const section of memory.sections) {
    lines.push(formatSectionForDisplay(section));
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
