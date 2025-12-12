// desktop/src/types/qualityStory.ts
// Phase 140.8: Quality Story Timeline Types
// Types for quality story events and timeline visualization

import type { PolicyStatus } from '../lib/quality/policyEngine';

/**
 * Quality status for story display
 */
export type QualityStatus = 'OK' | 'CAUTION' | 'BLOCK';

/**
 * Event types for quality story timeline
 */
export type QualityStoryEventType =
  | 'HEALTH_DROP'
  | 'HEALTH_RISE'
  | 'SECURITY_ALERT'
  | 'SECURITY_CLEAR'
  | 'COVERAGE_RISE'
  | 'COVERAGE_DROP'
  | 'ATP_RUN'
  | 'AUTO_IMPROVE'
  | 'DEPLOY'
  | 'INFO';

/**
 * Extended quality snapshot for story timeline
 * Compatible with existing QualitySnapshot from qualityHistoryTypes
 */
export interface QualityStorySnapshot {
  id: string;
  timestamp: string; // ISO (maps to createdAt in original)
  health: number; // 0 - 100
  issues: number; // totalIssues in original

  // Policy status mapped from original
  status: QualityStatus;
  policyStatus?: PolicyStatus;

  // Coverage fields (optional - added in Phase 140.8)
  coverage?: number | null;
  coverageDelta?: number | null;
  highRiskUntested?: number | null;

  // Security fields
  securityAlerts?: number | null;
  blockingSecurityAlerts?: number | null;

  // Source/label for event generation
  source?: 'scan' | 'deploy' | 'auto_improve' | 'manual' | string;
  label?: string | null;

  // Test info
  testPassRate?: number | null;
  failingSuites?: number | null;
}

/**
 * Quality story event for timeline display
 */
export interface QualityStoryEvent {
  id: string;
  type: QualityStoryEventType;
  timestamp: string;
  snapshotId: string;

  // Event display info
  title: string;
  description?: string;

  // Metrics at time of event
  health?: number;
  healthDelta?: number;
  coverage?: number | null;
  coverageDelta?: number | null;
  issues?: number;
  issuesDelta?: number;

  // Security info
  securityAlerts?: number | null;
  blockingSecurityAlerts?: number | null;

  // Index for chart positioning
  index: number;
}

/**
 * Convert PolicyStatus to QualityStatus
 */
export function policyStatusToQualityStatus(
  status: PolicyStatus | undefined
): QualityStatus {
  if (!status) return 'OK';
  switch (status) {
    case 'BLOCKED':
      return 'BLOCK';
    case 'WARNING':
      return 'CAUTION';
    case 'OK':
    default:
      return 'OK';
  }
}

/* -------------------------------------------------------------------------- */
/*  Phase 140.10: Quality Narrative Engine Types                              */
/* -------------------------------------------------------------------------- */

/**
 * Types of narrative sections that can be generated
 */
export type QualityNarrativeSectionType =
  | 'overview'
  | 'health_trend'
  | 'coverage_trend'
  | 'security_risks'
  | 'testing_activity'
  | 'auto_improve'
  | 'deploy_activity'
  | 'recommendation';

/**
 * Highlight level for narrative sections
 */
export type NarrativeHighlight = 'danger' | 'warning' | 'info' | 'success';

/**
 * Individual section in the quality narrative
 */
export interface QualityNarrativeSection {
  id: string;
  type: QualityNarrativeSectionType;
  title: string;
  body: string;
  highlight?: NarrativeHighlight;
}

/**
 * Complete quality narrative with all sections
 */
export interface QualityNarrative {
  status: QualityStatus;
  sections: QualityNarrativeSection[];
  generatedAt: string; // ISO timestamp
}

/**
 * Computed deltas between snapshots
 */
export interface QualityDeltas {
  healthDelta: number;
  coverageDelta: number;
  issuesDelta: number;
  daysCovered: number;
}
