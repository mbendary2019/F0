// F0 Functions Export - Phase 35 Cognitive Ops Enabled

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {setGlobalOptions} from 'firebase-functions/v2/options';

// Set global options for all v2 functions
setGlobalOptions({region: 'us-central1'});

// Initialize Firebase Admin (once)
if (!admin.apps.length) {
  admin.initializeApp();
}

// ============================================================
// PHASE 53: COLLABORATIVE EDITING (Days 5-7)
// ============================================================

// Chat summarization (Day 5)
export { summarizeRoom } from './collab/summarizeChat';

// Memory timeline (Day 6)
export { commitSummaryToMemory } from './collab/commitSummaryToMemory';

// Semantic search with embeddings (Day 7)
export { generateMemoryEmbedding } from './collab/generateMemoryEmbedding';

// Semantic search API (Phase 56 Day 2)
export { searchMemories } from './collab/searchMemories';

// ============================================================
// PHASE 57: AI MEMORY SYSTEM - SNIPPET CACHE COMPACTION
// ============================================================

// Weekly scheduled compaction of duplicate snippets (Phase 57.3)
export { weeklyCompactSnippets } from './schedules/compactSnippets';

// ============================================================
// PHASE 59: COGNITIVE MEMORY MESH - GRAPH REBUILD
// ============================================================

// Weekly scheduled graph rebuild for all active workspaces
export { weeklyRebuildMemoryGraphs } from './memory/rebuildGraph';

// Manual graph rebuild (admin only)
export { rebuildMemoryGraph } from './memory/rebuildGraph';

// Get graph statistics
export { getMemoryGraphStats } from './memory/rebuildGraph';

// ============================================================
// PHASE 64: AGENT-DRIVEN DEVELOPMENT - PREFLIGHT CHECKS
// ============================================================

// Preflight environment checks before task execution
export { onPreflightCheck } from './agents/preflight';

// Run plan without duplication (deterministic IDs)
export { onRunPlan } from './agents/runPlan';

// Delete graph for workspace (admin only)
export { deleteMemoryGraph } from './memory/rebuildGraph';

// ============================================================
// PHASE 35: COGNITIVE OPS FUNCTIONS
// ============================================================

// Auto-scaling based on load
export { autoScaler } from './ops/autoScaler';

// Self-healing health checks
export { watchdog } from './ops/watchdog';

// Cognitive feedback loop
export { feedbackLoop } from './ops/feedbackLoop';

// Canary deployment manager
export { canaryManager } from './ops/canaryManager';

// ============================================================
// PHASE 36: SELF-LEARNING ORCHESTRATOR
// ============================================================

// Score observations worker
export { scoreObservations } from './schedules/scoreObservations';

// Auto-tune policies worker
export { autoTunePolicies } from './schedules/autoTunePolicies';

// ============================================================
// PHASE 37: META-LEARNING & ADAPTIVE POLICIES
// ============================================================

// Confidence estimation
export { refreshConfidence } from './learning/confidenceEstimator';

// Adaptive router
export { adaptiveRouter } from './schedules/adaptiveRouter';

// Self-tuning scheduler
export { selfTuningScheduler } from './learning/selfTuningScheduler';

// ============================================================
// PHASE 38: COGNITIVE KNOWLEDGE GRAPH
// ============================================================

// Graph sync scheduler
export { graphSync } from './schedules/graphSync';

// Entity extractor
export { graphExtract } from './schedules/graphExtract';

// Real-time graph triggers
export {
  onStatsWrite,
  onPolicyWrite,
  onDecisionCreate,
  onConfidenceWrite,
} from './triggers/graphOnWrite';

// ============================================================
// PHASE 39: SELF-GOVERNANCE & ETHICAL AI
// ============================================================

// Policy guard
export { policyGuard } from './https/policyGuard';

// Governance sweep scheduler
export { governanceSweep } from './schedules/governanceSweep';

// Ethical auditor
export { ethicalAuditor } from './schedules/ethicalAuditor';

// ============================================================
// PHASE 40: AUTONOMOUS ECOSYSTEM
// ============================================================

// Auto-deploy agent
export { autoDeploy } from './auto/autoDeploy';

// Auto-verify & recovery
export { autoVerify } from './auto/autoVerify';

// Economic optimizer
export { economicOptimizer } from './auto/economicOptimizer';

// AI-to-AI collaboration bus
export { onBusMessage } from './bus/handlers';

// ============================================================
// PHASE 42: FEDERATED CONSENSUS & COLLECTIVE OPTIMIZATION
// ============================================================

// Federated vote endpoint
export { fedVote } from './https/fedVote';

// Consensus sweep
export { consensusSweep } from './schedules/consensusSweep';

// Consensus apply
export { consensusApply } from './schedules/consensusApply';

// Federated economics
export { fedEconomics } from './schedules/fedEconomics';

// Trust score sweep
export { trustSweep } from './schedules/trustSweep';

// Incentive system
export { incentives } from './schedules/incentives';

// API endpoints
export { apiConsensus } from './api/consensus';
export { apiEconomics } from './api/economics';
export { apiTrust } from './api/trust';
export { apiIncentives } from './api/incentives';

// ============================================================
// PHASE 43: GLOBAL COGNITIVE MESH
// ============================================================

// Bootstrap & Gossip endpoints
export { meshBeacon } from './https/meshBeacon';
export { meshGossip } from './https/meshGossip';

// Schedulers
export { meshReduce } from './schedules/meshReduce';
export { trustFlow } from './schedules/trustFlow';

// API endpoints
export { apiMesh } from './api/mesh';
export { meshView } from './https/meshView';

// ============================================================
// PHASE 43.1: WEBRTC & WEIGHTED GOSSIP
// ============================================================

// Weighted gossip scheduler
export { gossipPush } from './schedules/gossipPush';

// WebRTC signaling API
export { apiMeshRtc } from './api/meshRtc';

// ============================================================
// PHASE 44: ADD-ONS PACK (QUOTA + FIGMA + MARKETPLACE)
// ============================================================

// Billing & Quota
export { resetDailyQuotas } from './billing/quota';

// Figma Integration
export { figmaScheduledPull, figmaPullOnDemand } from './integrations/figmaPull';

// Marketplace
export { requestInstall } from './marketplace/install';

// ============================================================
// PHASE 45: MONETIZATION & PREMIUM UPGRADES
// ============================================================

// Stripe Checkout & Portal
export { createCheckoutSession } from './billing/checkout';
export { createPortalSession } from './billing/portal';

// Stripe Webhook Handler
export { stripeWebhook as stripeWebhookV2 } from './billing/stripeWebhook';

// Phase 45.2: Subscription Reconciliation
export { reconcileSubscriptions } from './billing/reconcile';

// Phase 45.2: Paid Marketplace
export { installPaidItem, checkMarketplaceAccess } from './marketplace/paidInstalls';

// Phase 46: Usage Metering & Invoices
export { recordUsage } from './usage/record';
export { lowQuotaAlert } from './usage/lowQuotaAlert';
export { listInvoices } from './invoices/list';

// Phase 47: Teams, Seats & RBAC
export { createOrg, updateOrg, deleteOrg } from './orgs/management';
export { inviteMember, acceptInvite, removeMember, updateRole } from './orgs/members';
export { updateSeats } from './orgs/seats';

// Phase 48: Analytics & Audit Trail
export { recordEvent } from './analytics/recordEvent';
export { logAudit } from './analytics/logAudit';
export { aggregateDailyMetrics, aggregateDailyMetricsBackfill } from './analytics/aggregateDailyMetrics';
export { getAnalytics } from './analytics/getAnalytics';
export { exportAuditCsv } from './analytics/exportAuditCsv';
export { aggregateKpisOnEvent } from './analytics/aggregateKpis';

// ============================================================
// PHASE 49: ERROR TRACKING & INCIDENT MANAGEMENT
// ============================================================

// Log ingestion endpoint
export { log } from './http/log';

// Incident detection trigger
export { onEventWrite } from './incidents/onEventWrite';

// Incident CSV export (callable & HTTP)
export { exportIncidentsCsv, exportIncidentsCsvCallable } from './exportIncidentsCsv';

// ============================================================
// PHASE 50: AI STUDIO WEBHOOKS
// ============================================================

// Studio webhook endpoints
export { runwayWebhook, veoWebhook, studioWebhook, onJobComplete } from './studio/webhooks';

// ============================================================
// PHASE 51: ONE-CLICK DEPLOY ANYWHERE
// ============================================================

// Deploy functions
export { triggerDeploy } from './deploy/triggerDeploy';
export { pollDeployStatus, getDeployHistory } from './deploy/pollDeployStatus';
export { exportDeployLogs, exportDeployLogsCallable } from './deploy/exportDeployLogs';

// ============================================================
// HEALTH CHECK (Essential)
// ============================================================

export const readyz = functions.https.onRequest((_req, res) => {
  res.status(200).json({ 
    ok: true, 
    ts: Date.now(),
    service: 'f0-functions',
    version: '1.0.0',
    phase: 'health-check-only',
    message: 'Phase 35 & 36 functions will be deployed after API updates'
  });
});

// ============================================================
// AUDIT TEST (Phase 36 - Safe)
// ============================================================

export const auditTest = functions.https.onRequest(async (req, res) => {
  const db = admin.firestore();
  const now = Date.now();
  
  try {
    // Simple audit log write test
    await db.collection('admin_activity').add({
      ts: admin.firestore.FieldValue.serverTimestamp(),
      action: 'test.audit',
      actor: {
        uid: 'system',
        ip: req.ip || 'unknown',
        userAgent: req.get('user-agent'),
      },
      target: {
        type: 'system',
        id: 'health-check',
      },
      metadata: {
        test: true,
        endpoint: req.path,
      },
    });

    res.json({ 
      ok: true, 
      message: 'Audit test successful - Event logged to admin_activity',
      timestamp: now,
      collection: 'admin_activity'
    });
  } catch (error: any) {
    console.error('Audit test failed:', error);
    res.status(500).json({ 
      ok: false, 
      message: 'Audit system error',
      error: error.message
    });
  }
});

// ============================================================
// USER INFO (Simple test endpoint)
// ============================================================

export const userInfo = functions.https.onRequest(async (req, res) => {
  const uid = req.query.uid as string;
  
  if (!uid) {
    res.status(400).json({ error: 'Missing uid parameter' });
    return;
  }

  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      ok: true,
      uid,
      data: userDoc.data(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// LEGACY SUPPORT (Stub)
// ============================================================

export const stripeWebhook = functions.https.onRequest((req, res) => {
  res.status(200).json({
    ok: false,
    message: 'This endpoint has been moved. Use /api/webhooks/stripe in the Next.js app instead.',
    redirect: '/api/webhooks/stripe'
  });
});

// ============================================================
// PHASE 52: GITHUB INTEGRATION
// ============================================================

// OAuth Functions
export { exchangeOAuthCode } from './github/oauth';
export { revokeGitHubConnection } from './github/oauth';
export { getGitHubAccount } from './github/oauth';

// Repository Management Functions
export { listRepositories } from './github/repos';
export { connectRepository } from './github/repos';
export { disconnectRepository } from './github/repos';
export { getConnectedRepositories } from './github/repos';
export { updateRepositorySettings } from './github/repos';

// ============================================================
// PHASE 53: REALTIME COLLABORATION
// ============================================================

// Collaboration room management
export { requestJoin as collabRequestJoin } from './collab/requestJoin';
export { leave as collabLeave } from './collab/leave';
export { snapshot as collabSnapshot } from './collab/snapshot';

// Collaboration triggers
export {
  onSessionWrite as collabOnSessionWrite,
  cleanupOldSessions as collabCleanupOldSessions,
  monitorRoomActivity as collabMonitorRoomActivity
} from './collab/triggers';

// ============================================================
// PHASE 63: ANALYTICS & REPORTS
// ============================================================

// Development tools for seeding test data
export { seedOpsEvents } from './dev/seedOpsEvents';

// Daily report generation (scheduled + backfill)
export { generateDailyReport, generateDailyReportBackfill } from './reports/generateDailyReport';

// Trend insights generation (AI summary - scheduled + backfill)
export { generateTrendInsights, generateTrendInsightsBackfill } from './reports/generateTrendInsights';

// ============================================================
// PHASE 71: INTEGRATION VAULT
// ============================================================

export {
  saveIntegrationToken,
  getIntegrationStatus,
  disconnectIntegration
} from './integrations/vault';

// ============================================================
// PHASE 72: VERCEL INTEGRATION (Manual Token Mode)
// ============================================================

export { testVercelToken, listVercelProjects } from './integrations/vercel-setup';

// ============================================================
// PHASE 72: FIREBASE AUTO-SETUP
// ============================================================

export {
  createFirebaseWebApp,
  enableAuthProviders,
  setFirestoreRules,
  listFirebaseProjects,
  testFirebaseAdmin,
  autoSetupFirebase
} from './integrations/firebase-setup';

// ============================================================
// PHASE 72: GODADDY DNS MANAGEMENT
// ============================================================

export {
  getGoDaddyDomains,
  getDNSRecords,
  createDNSRecord,
  deleteDNSRecord
} from './integrations/godaddy';

// ============================================================
// PHASE 72: DOMAIN MANAGEMENT
// ============================================================

export {
  attachDomainToProject,
  generateDomainDns,
  getProjectDomains,
  deleteDomainConfig
} from './integrations/domains';

// ============================================================
// PHASE 73: PROJECT ENVIRONMENT VARIABLES
// ============================================================

export {
  getProjectEnvVars,
  saveProjectEnvVar,
  deleteProjectEnvVar
} from './projects/env';

// ============================================================
// PHASE 72.C: PROJECT INTEGRATIONS (GitHub, Firebase, etc.)
// ============================================================

export { saveProjectIntegrations } from './projects/saveProjectIntegrations';

// ============================================================
// PHASE 75: GITHUB PUSH & SYNC INTEGRATION
// ============================================================

export { pushProjectToGitHub } from './integrations/githubPush';
export { syncProjectFromGitHub } from './integrations/githubSync';

// ============================================================
// PHASE 75: GITHUB BRANCHES MANAGEMENT
// ============================================================

export { listGitHubBranches, createGitHubBranch, setCurrentGitHubBranch } from './integrations/githubBranches';

// ============================================================
// PHASE 75: GITHUB ACTIONS DEPLOY
// ============================================================

export { triggerGitHubDeploy } from './integrations/githubDeploy';

// ============================================================
// PHASE 74: PROJECT ANALYSIS & TECH STACK DETECTION
// ============================================================

export { saveProjectAnalysis } from './projects/analyzer';

// ============================================================
// PHASE 75: PROJECT MEMORY SYSTEM
// ============================================================

export { updateProjectMemory } from './projects/memory';

console.log('✅ F0 Functions loaded (Phase 75: Project Memory | Phase 74: Project Analysis)');
