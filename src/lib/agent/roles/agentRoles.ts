// src/lib/agent/roles/agentRoles.ts

/**
 * Phase 96: Specialized Agent Roles
 *
 * This file defines the core agent role types and base parameters
 * for all specialized agents in the F0 system.
 */

export type AgentRoleId =
  | 'ARCHITECT'
  | 'TASK_DECOMPOSER'
  | 'CODE_GENERATOR'
  | 'ANALYST'
  | 'MEMORY';

/**
 * Base parameters shared by all agent calls.
 * Each specialized agent can extend this interface with role-specific params.
 */
export interface BaseAgentCallParams {
  /** Project ID this agent is working on */
  projectId: string;

  /** User ID (for logging, auth, routing) */
  userId: string;

  /**
   * Original user request (could be Arabic/English mixed).
   */
  userInput: string;

  /**
   * Optional: locale hint ("ar", "en", ...).
   * Agents will still output structured data, but can reason in that language.
   */
  locale?: string;
}
