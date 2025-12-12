// orchestrator/core/multiAgent/basicSafetyChecker.ts
// =============================================================================
// Phase 156.1 – Mode-Aware SafetyChecker
// Phase 156.4 – Git & Shell Guardrails
// Evaluates agent messages based on user mode and command patterns
// =============================================================================

import {
  AgentMessage,
  SafetyChecker,
  UserMode,
} from './types';

// Phase 156.4: Absolutely blocked patterns (no mode can bypass)
const DESTRUCTIVE_PATTERNS = [
  /rm\s+-rf\s+\//i,           // rm -rf /
  /rm\s+-rf\s+~/i,            // rm -rf ~
  /rm\s+-rf\s+\.\./i,         // rm -rf ..
  /rm\s+-rf\s+\*/i,           // rm -rf *
  /drop\s+database/i,          // SQL drop
  /truncate\s+table/i,         // SQL truncate
  /delete\s+from\s+\w+\s*;?$/i, // DELETE without WHERE
  /mkfs/i,                     // Format disk
  /shutdown/i,                 // Shutdown
  /reboot/i,                   // Reboot
  /:\s*\(\s*\)\s*\{/,          // Fork bomb
  />\s*\/dev\/sd/i,            // Write to disk
  /dd\s+if=/i,                 // dd commands
  /format\s+c:/i,              // Windows format
  /deltree/i,                  // Windows delete tree
];

// Git destructive patterns
const GIT_DESTRUCTIVE_PATTERNS = [
  /git\s+push\s+--force/i,           // Force push
  /git\s+push\s+-f/i,                // Force push shorthand
  /git\s+reset\s+--hard/i,           // Hard reset
  /git\s+clean\s+-fd/i,              // Force clean
  /git\s+checkout\s+--\s+\./i,       // Discard all changes
];

// Commands that require confirmation (depending on mode)
const CONFIRM_REQUIRED_PATTERNS = [
  /^npm\s+test/,
  /^npm\s+run\s+build/,
  /^npm\s+run\s+db:/,
  /^npm\s+run\s+migrate/,
  /^pnpm\s+test/,
  /^pnpm\s+run\s+build/,
  /^pnpm\s+run\s+db:/,
  /^yarn\s+test/,
  /^yarn\s+build/,
  /^prisma\s+migrate/,
  /^prisma\s+db\s+push/,
  /^node\s+.*migrate/i,
];

// Safe commands that beginners can run
const BEGINNER_SAFE_PATTERNS = [
  /^npm\s+run\s+lint/,
  /^npm\s+run\s+format/,
  /^pnpm\s+lint/,
  /^prettier/,
  /^eslint/,
];

function isDestructiveCommand(cmd: string): boolean {
  return DESTRUCTIVE_PATTERNS.some((p) => p.test(cmd));
}

function isGitDestructive(cmd: string): boolean {
  return GIT_DESTRUCTIVE_PATTERNS.some((p) => p.test(cmd));
}

function requiresConfirmation(cmd: string): boolean {
  return CONFIRM_REQUIRED_PATTERNS.some((p) => p.test(cmd));
}

function isBeginnerSafe(cmd: string): boolean {
  return BEGINNER_SAFE_PATTERNS.some((p) => p.test(cmd));
}

function isProductionUrl(url: string): boolean {
  const prodPatterns = /prod|production|\.com|\.io|\.app|\.net|\.org/i;
  const localPatterns = /localhost|127\.0\.0\.1|0\.0\.0\.0/i;
  return prodPatterns.test(url) && !localPatterns.test(url);
}

function isStagingUrl(url: string): boolean {
  return /staging|stage|dev\.|test\.|preview\./i.test(url);
}

export class BasicSafetyChecker implements SafetyChecker {
  async evaluate(
    message: AgentMessage
  ): Promise<{
    allowed: boolean;
    requiresUserConfirm?: boolean;
    reason?: string;
  }> {
    const mode: UserMode = message.context.userMode ?? 'beginner';

    // ===============================================
    // SHELL COMMANDS
    // ===============================================
    if (message.to === 'shell' && message.kind === 'TASK_ASSIGNMENT') {
      const payload = message.payload as { task?: { input?: { command?: string } } };
      const cmd = payload?.task?.input?.command ?? '';

      // 1) Block absolutely destructive commands (ALL modes)
      if (isDestructiveCommand(cmd)) {
        return {
          allowed: false,
          reason: `[BLOCKED] Destructive shell command: ${cmd}`,
        };
      }

      // 2) Mode-specific rules
      switch (mode) {
        case 'beginner':
          // Beginner: Only safe commands allowed, everything else requires confirm
          if (isBeginnerSafe(cmd)) {
            return {
              allowed: true,
              requiresUserConfirm: true,
              reason: `[BEGINNER] Safe command, but requires confirmation: ${cmd}`,
            };
          }
          return {
            allowed: false,
            requiresUserConfirm: true,
            reason: `[BEGINNER] Shell commands restricted – requires approval: ${cmd}`,
          };

        case 'pro':
          // Pro: Confirm for important commands, allow others
          if (requiresConfirmation(cmd)) {
            return {
              allowed: true,
              requiresUserConfirm: true,
              reason: `[PRO] Command requires confirmation: ${cmd}`,
            };
          }
          return { allowed: true };

        case 'expert':
          // Expert: Allow most, but still block destructive
          return { allowed: true };

        default:
          return {
            allowed: true,
            requiresUserConfirm: true,
            reason: `Unknown mode – requires confirmation: ${cmd}`,
          };
      }
    }

    // ===============================================
    // GIT OPERATIONS
    // ===============================================
    if (message.to === 'git') {
      const payload = message.payload as {
        task?: { input?: { command?: string } };
        decision?: string;
      };
      const cmd = payload?.task?.input?.command ?? '';
      const decision = payload?.decision;

      // Block destructive git commands (ALL modes)
      if (isGitDestructive(cmd)) {
        return {
          allowed: false,
          reason: `[BLOCKED] Destructive git command: ${cmd}`,
        };
      }

      // ROLLBACK decision handling
      if (decision === 'ROLLBACK') {
        switch (mode) {
          case 'beginner':
            return {
              allowed: false,
              requiresUserConfirm: true,
              reason: `[BEGINNER] Rollback requires explicit approval + warning`,
            };
          case 'pro':
            return {
              allowed: true,
              requiresUserConfirm: true,
              reason: `[PRO] Rollback requires confirmation`,
            };
          case 'expert':
            return { allowed: true };
        }
      }

      // Auto-commit is allowed for all modes after APPROVE
      if (decision === 'APPROVE') {
        return { allowed: true };
      }

      // Regular git commands (commit, push without force)
      switch (mode) {
        case 'beginner':
          return {
            allowed: true,
            requiresUserConfirm: true,
            reason: `[BEGINNER] Git operation requires confirmation`,
          };
        case 'pro':
        case 'expert':
          return { allowed: true };
      }
    }

    // ===============================================
    // BROWSER FLOWS
    // ===============================================
    if (message.to === 'browser' && message.kind === 'TASK_ASSIGNMENT') {
      const payload = message.payload as { task?: { input?: { url?: string } } };
      const url = payload?.task?.input?.url ?? '';

      switch (mode) {
        case 'beginner':
          // Localhost only without confirm, production requires confirm
          if (isProductionUrl(url)) {
            return {
              allowed: true,
              requiresUserConfirm: true,
              reason: `[BEGINNER] Production URL requires confirmation: ${url}`,
            };
          }
          if (isStagingUrl(url)) {
            return {
              allowed: true,
              requiresUserConfirm: true,
              reason: `[BEGINNER] Staging URL requires confirmation: ${url}`,
            };
          }
          return { allowed: true };

        case 'pro':
          // Staging allowed, production requires confirm
          if (isProductionUrl(url)) {
            return {
              allowed: true,
              requiresUserConfirm: true,
              reason: `[PRO] Production URL requires confirmation: ${url}`,
            };
          }
          return { allowed: true };

        case 'expert':
          // All allowed but production gets logged
          if (isProductionUrl(url)) {
            console.log(`[156][SAFETY] Expert mode: Production browser flow: ${url}`);
          }
          return { allowed: true };
      }
    }

    // ===============================================
    // CODE CHANGES
    // ===============================================
    if (message.to === 'code' && message.kind === 'TASK_ASSIGNMENT') {
      // Code changes are allowed but logged
      console.log('[156][SAFETY] Code task allowed:', message.context.taskId);
      return { allowed: true };
    }

    // ===============================================
    // DEFAULT: ALLOW
    // ===============================================
    return { allowed: true };
  }
}

console.log('[156][ORCHESTRATOR][SAFETY] Mode-Aware BasicSafetyChecker loaded');
