// src/lib/agents/federation/safety.ts
// =============================================================================
// Phase 155.1 – Safety Envelope Utilities
// Risk assessment and approval tracking for agent actions
// =============================================================================

import type { SafetyEnvelope, AgentMessage, AgentRole, AgentTask } from './types';

// =============================================================================
// Risk Assessment Rules
// =============================================================================

/**
 * Actions considered high risk
 */
const HIGH_RISK_ACTIONS = [
  'delete_file',
  'delete_directory',
  'git_push',
  'git_force_push',
  'deploy',
  'database_migration',
  'credentials_update',
  'env_modification',
];

/**
 * Actions considered critical (always require human approval)
 */
const CRITICAL_ACTIONS = [
  'delete_database',
  'production_deploy',
  'git_force_push',
  'credentials_delete',
  'user_data_delete',
];

/**
 * File patterns that require extra caution
 */
const SENSITIVE_FILE_PATTERNS = [
  /\.env/i,
  /secrets?\./i,
  /credentials?\./i,
  /\.pem$/i,
  /\.key$/i,
  /firebase\.json$/i,
  /firestore\.rules$/i,
  /storage\.rules$/i,
];

// =============================================================================
// Risk Assessment Functions
// =============================================================================

/**
 * Assess risk level for a task
 */
export function assessTaskRisk(task: AgentTask): SafetyEnvelope['riskLevel'] {
  const title = task.title.toLowerCase();
  const desc = task.description.toLowerCase();
  const combined = `${title} ${desc}`;

  // Check for critical actions
  for (const action of CRITICAL_ACTIONS) {
    if (combined.includes(action.replace(/_/g, ' '))) {
      console.log('[155.1][AGENTS][SAFETY] Critical risk detected:', action);
      return 'critical';
    }
  }

  // Check for high risk actions
  for (const action of HIGH_RISK_ACTIONS) {
    if (combined.includes(action.replace(/_/g, ' '))) {
      console.log('[155.1][AGENTS][SAFETY] High risk detected:', action);
      return 'high';
    }
  }

  // Check for destructive keywords
  if (/\b(delete|remove|drop|destroy|wipe|erase)\b/i.test(combined)) {
    return 'high';
  }

  // Check for deployment keywords
  if (/\b(deploy|publish|release|production)\b/i.test(combined)) {
    return 'high';
  }

  // Check for database operations
  if (/\b(migrate|migration|schema|alter)\b/i.test(combined)) {
    return 'medium';
  }

  // Check for git operations
  if (/\b(push|merge|rebase|reset)\b/i.test(combined)) {
    return 'medium';
  }

  // Default to low risk
  return 'low';
}

/**
 * Assess risk for file operations
 */
export function assessFileRisk(filePath: string, operation: 'read' | 'write' | 'delete'): SafetyEnvelope['riskLevel'] {
  // Check sensitive file patterns
  for (const pattern of SENSITIVE_FILE_PATTERNS) {
    if (pattern.test(filePath)) {
      console.log('[155.1][AGENTS][SAFETY] Sensitive file detected:', filePath);
      return operation === 'delete' ? 'critical' : 'high';
    }
  }

  // Delete operations are generally higher risk
  if (operation === 'delete') {
    return 'medium';
  }

  // Write operations to config files
  if (/\.(json|yaml|yml|toml|config\.\w+)$/i.test(filePath)) {
    return 'medium';
  }

  return 'low';
}

/**
 * Assess risk based on agent role
 */
export function assessAgentRoleRisk(role: AgentRole): SafetyEnvelope['riskLevel'] {
  switch (role) {
    case 'shell':
      return 'high'; // Shell commands can be dangerous
    case 'git':
      return 'medium'; // Git operations need caution
    case 'code':
      return 'low'; // Code generation is generally safe
    case 'test':
      return 'low'; // Tests are safe
    case 'review':
      return 'low'; // Review is read-only
    case 'planner':
      return 'low'; // Planning is safe
    case 'browser':
      return 'medium'; // Browser actions could leak data
    default:
      return 'medium';
  }
}

// =============================================================================
// Envelope Creation
// =============================================================================

/**
 * Create a safety envelope for a task
 */
export function createTaskEnvelope(task: AgentTask): SafetyEnvelope {
  const riskLevel = assessTaskRisk(task);

  return {
    approvedBy: riskLevel === 'low' ? 'auto' : 'human',
    riskLevel,
    requiresHumanApproval: riskLevel === 'high' || riskLevel === 'critical',
    timestamp: Date.now(),
    reason: `Task "${task.title}" assessed as ${riskLevel} risk`,
  };
}

/**
 * Create a safety envelope for a file operation
 */
export function createFileEnvelope(
  filePath: string,
  operation: 'read' | 'write' | 'delete'
): SafetyEnvelope {
  const riskLevel = assessFileRisk(filePath, operation);

  return {
    approvedBy: riskLevel === 'low' ? 'auto' : 'human',
    riskLevel,
    requiresHumanApproval: riskLevel === 'high' || riskLevel === 'critical',
    timestamp: Date.now(),
    reason: `File ${operation} on "${filePath}" assessed as ${riskLevel} risk`,
  };
}

/**
 * Create a default low-risk envelope
 */
export function createLowRiskEnvelope(reason?: string): SafetyEnvelope {
  return {
    approvedBy: 'auto',
    riskLevel: 'low',
    requiresHumanApproval: false,
    timestamp: Date.now(),
    reason: reason || 'Auto-approved low-risk action',
  };
}

/**
 * Create an envelope requiring human approval
 */
export function createHumanApprovalEnvelope(
  riskLevel: SafetyEnvelope['riskLevel'],
  reason: string
): SafetyEnvelope {
  return {
    approvedBy: 'human',
    riskLevel,
    requiresHumanApproval: true,
    timestamp: Date.now(),
    reason,
  };
}

/**
 * Create an envelope approved by review agent
 */
export function createReviewApprovedEnvelope(reason?: string): SafetyEnvelope {
  return {
    approvedBy: 'review_agent',
    riskLevel: 'medium',
    requiresHumanApproval: false,
    timestamp: Date.now(),
    reason: reason || 'Approved by review agent',
  };
}

// =============================================================================
// Envelope Validation
// =============================================================================

/**
 * Check if an envelope allows execution
 */
export function canExecute(envelope: SafetyEnvelope, hasHumanApproval: boolean = false): boolean {
  // Critical always needs human approval
  if (envelope.riskLevel === 'critical' && envelope.approvedBy !== 'human') {
    console.log('[155.1][AGENTS][SAFETY] Critical action blocked - requires human approval');
    return false;
  }

  // If requires human approval, check if we have it
  if (envelope.requiresHumanApproval && !hasHumanApproval && envelope.approvedBy !== 'human') {
    console.log('[155.1][AGENTS][SAFETY] Action blocked - requires human approval');
    return false;
  }

  return true;
}

/**
 * Upgrade envelope to human-approved
 */
export function approveByHuman(envelope: SafetyEnvelope): SafetyEnvelope {
  return {
    ...envelope,
    approvedBy: 'human',
    requiresHumanApproval: false,
    timestamp: Date.now(),
    reason: envelope.reason ? `${envelope.reason} (human approved)` : 'Human approved',
  };
}

/**
 * Get risk level display info
 */
export function getRiskDisplay(riskLevel: SafetyEnvelope['riskLevel']): {
  label: string;
  labelAr: string;
  color: string;
  icon: string;
} {
  switch (riskLevel) {
    case 'low':
      return { label: 'Low Risk', labelAr: 'منخفض الخطورة', color: 'green', icon: '✅' };
    case 'medium':
      return { label: 'Medium Risk', labelAr: 'متوسط الخطورة', color: 'yellow', icon: '⚠️' };
    case 'high':
      return { label: 'High Risk', labelAr: 'عالي الخطورة', color: 'orange', icon: '🔶' };
    case 'critical':
      return { label: 'Critical Risk', labelAr: 'خطورة حرجة', color: 'red', icon: '🛑' };
  }
}

console.log('[155.1][AGENTS][SAFETY] Safety utilities loaded');
