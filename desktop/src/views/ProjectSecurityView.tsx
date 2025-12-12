// desktop/src/views/ProjectSecurityView.tsx
// Phase 136.2: Project Security View - Wrapper for Security Center Panel
// Phase 136.3: Updated to use Security Recipes for prompts
// Provides context integration and agent action handlers

'use client';

import React, { useCallback } from 'react';
import { SecurityCenterPanel } from '../components/security';
import { buildSecurityPrompt } from '../lib/security/securityRecipes';
import type { SecurityAlert } from '../lib/security/securityEngine';

interface ProjectSecurityViewProps {
  /** Locale for labels */
  locale?: 'en' | 'ar';
  /** Project ID (optional) */
  projectId?: string | null;
  /** Project name for context */
  projectName?: string;
  /** Callback when requesting agent fix for a file */
  onRequestAgentFix?: (prompt: string) => void;
  /** Additional class names */
  className?: string;
}

/**
 * ProjectSecurityView
 * Wraps SecurityCenterPanel with project context and agent integration
 * Phase 136.3: Uses Security Recipes for consistent prompt building
 */
export const ProjectSecurityView: React.FC<ProjectSecurityViewProps> = ({
  locale = 'en',
  projectId,
  projectName,
  onRequestAgentFix,
  className,
}) => {
  // Handle fix file with agent - using Security Recipes
  const handleFixFile = useCallback(
    (filePath: string, alerts: SecurityAlert[]) => {
      if (!onRequestAgentFix) {
        console.log('[ProjectSecurityView] No agent fix handler provided');
        return;
      }

      // Use Security Recipe for consistent prompt
      const prompt = buildSecurityPrompt('FIX_FILE_VULNS', locale, {
        filePath,
        alerts,
        projectName,
      });

      onRequestAgentFix(prompt);
      console.log('[ProjectSecurityView] Sent fix request for file:', filePath);
    },
    [onRequestAgentFix, locale, projectName]
  );

  // Handle fix all with agent - using Security Recipes
  const handleFixAll = useCallback(
    (alerts: SecurityAlert[]) => {
      if (!onRequestAgentFix) {
        console.log('[ProjectSecurityView] No agent fix handler provided');
        return;
      }

      // Use Security Recipe for consistent prompt
      const prompt = buildSecurityPrompt('FULL_PROJECT_AUDIT', locale, {
        alerts,
        projectName,
      });

      onRequestAgentFix(prompt);
      console.log('[ProjectSecurityView] Sent fix all request:', {
        totalAlerts: alerts.length,
        uniqueFiles: new Set(alerts.map((a) => a.filePath)).size,
      });
    },
    [onRequestAgentFix, locale, projectName]
  );

  return (
    <SecurityCenterPanel
      locale={locale}
      onFixFile={onRequestAgentFix ? handleFixFile : undefined}
      onFixAll={onRequestAgentFix ? handleFixAll : undefined}
      className={className}
    />
  );
};

export default ProjectSecurityView;
