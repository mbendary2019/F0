/**
 * Agent Coordinator - Job Queue Processor
 * Processes agent jobs and delegates to appropriate handlers
 */

import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { guardianCheck, logGuardianDecision } from './guardian';
import { llmAnalyze, llmRecommend, prepareContextForLLM } from './llmBrain';
import type { AgentJob } from './types';

/**
 * Agent Coordinator Cloud Function
 * Runs every 2 minutes to process queued jobs
 */
export const agentCoordinator = functions.pubsub
  .schedule('every 2 minutes')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('[AgentCoordinator] Starting job processing');
    
    const db = getFirestore();
    
    // Fetch queued jobs
    const jobsSnap = await db
      .collection('agent_jobs')
      .where('status', '==', 'queued')
      .orderBy('createdAt', 'asc')
      .limit(10)
      .get();
    
    if (jobsSnap.empty) {
      console.log('[AgentCoordinator] No queued jobs');
      return null;
    }
    
    console.log(`[AgentCoordinator] Processing ${jobsSnap.size} jobs`);
    
    let processedCount = 0;
    let successCount = 0;
    let rejectedCount = 0;
    
    for (const doc of jobsSnap.docs) {
      const job = { id: doc.id, ...doc.data() } as AgentJob;
      
      try {
        // Mark as running
        await doc.ref.update({
          status: 'running',
          updatedAt: Date.now()
        });
        
        // Process based on job kind
        const result = await processJob(db, job);
        
        // Update with result
        await doc.ref.update({
          status: result.status,
          result: result.data,
          decision: result.decision,
          error: result.error,
          updatedAt: Date.now()
        });
        
        processedCount++;
        if (result.status === 'done') successCount++;
        if (result.status === 'rejected') rejectedCount++;
        
      } catch (error) {
        console.error(`[AgentCoordinator] Error processing job ${job.id}:`, error);
        
        await doc.ref.update({
          status: 'rejected',
          error: String(error),
          updatedAt: Date.now()
        });
        
        processedCount++;
        rejectedCount++;
      }
    }
    
    console.log(`[AgentCoordinator] Completed: ${processedCount} jobs (${successCount} success, ${rejectedCount} rejected)`);
    return null;
  });

/**
 * Process individual job based on kind
 */
async function processJob(
  db: FirebaseFirestore.Firestore,
  job: AgentJob
): Promise<{ status: 'done' | 'rejected'; data?: any; decision?: any; error?: string }> {
  
  switch (job.kind) {
    case 'guard':
      return await processGuardJob(db, job);
    
    case 'predict':
      return await processPredictJob(db, job);
    
    case 'report':
      return await processReportJob(db, job);
    
    case 'remediate':
      return await processRemediateJob(db, job);
    
    default:
      return {
        status: 'rejected',
        error: `Unknown job kind: ${job.kind}`
      };
  }
}

/**
 * Process Guard Job - Security validation
 */
async function processGuardJob(
  db: FirebaseFirestore.Firestore,
  job: AgentJob
): Promise<{ status: 'done' | 'rejected'; data?: any; decision?: any }> {
  
  const decision = await guardianCheck({
    actorUid: String(job.payload['actorUid'] || 'unknown'),
    action: String(job.payload['action'] || 'unknown'),
    target: job.payload['target'] as string | undefined,
    meta: job.payload
  });
  
  // Log decision
  await logGuardianDecision(
    {
      actorUid: String(job.payload['actorUid']),
      action: String(job.payload['action']),
      target: job.payload['target'] as string | undefined,
      meta: job.payload
    },
    decision
  );
  
  return {
    status: decision.allow ? 'done' : 'rejected',
    decision,
    data: { allow: decision.allow, reason: decision.reason }
  };
}

/**
 * Process Predict Job - Forecasting and analysis
 */
async function processPredictJob(
  db: FirebaseFirestore.Firestore,
  job: AgentJob
): Promise<{ status: 'done'; data: any }> {
  
  // Fetch context from various collections
  const totalsSnap = await db.collection('observability_cache').doc('totals').get();
  const totals = totalsSnap.exists ? totalsSnap.data() : {};
  
  const anomaliesSnap = await db
    .collection('anomaly_events')
    .orderBy('ts', 'desc')
    .limit(10)
    .get();
  const anomalies = anomaliesSnap.docs.map(d => d.data());
  
  const predictionsSnap = await db
    .collection('predictions_daily')
    .orderBy('t', 'desc')
    .limit(5)
    .get();
  const predictions = predictionsSnap.docs.map(d => d.data());
  
  // Prepare context
  const context = prepareContextForLLM({
    totals,
    anomalies,
    predictions
  });
  
  // Add question if provided
  if (job.payload['question']) {
    context.question = String(job.payload['question']);
  }
  
  // Generate insight
  const insight = job.payload['question']
    ? await llmRecommend(String(job.payload['question']), context)
    : await llmAnalyze(context);
  
  return {
    status: 'done',
    data: insight
  };
}

/**
 * Process Report Job - Generate operational reports
 */
async function processReportJob(
  db: FirebaseFirestore.Firestore,
  job: AgentJob
): Promise<{ status: 'done'; data: any }> {
  
  // Similar to predict, but focused on reporting
  const totalsSnap = await db.collection('observability_cache').doc('totals').get();
  const totals = totalsSnap.exists ? totalsSnap.data() : {};
  
  const anomaliesSnap = await db
    .collection('anomaly_events')
    .orderBy('ts', 'desc')
    .limit(5)
    .get();
  const anomalies = anomaliesSnap.docs.map(d => d.data());
  
  const context = prepareContextForLLM({ totals, anomalies });
  const insight = await llmAnalyze(context);
  
  // Generate report
  const report = {
    timestamp: Date.now(),
    period: '24h',
    metrics: totals,
    anomaliesCount: anomalies.length,
    insight,
    status: anomalies.some((a: any) => a.severity === 'high') ? 'warning' : 'healthy'
  };
  
  return {
    status: 'done',
    data: report
  };
}

/**
 * Process Remediate Job - Automated remediation with guardian check
 */
async function processRemediateJob(
  db: FirebaseFirestore.Firestore,
  job: AgentJob
): Promise<{ status: 'done' | 'rejected'; data?: any; decision?: any }> {
  
  // First, check with Guardian
  const guardDecision = await guardianCheck({
    actorUid: String(job.payload['actorUid'] || 'system'),
    action: String(job.payload['action'] || 'unknown'),
    target: job.payload['target'] as string | undefined,
    meta: job.payload
  });
  
  // Log guardian decision
  await logGuardianDecision(
    {
      actorUid: String(job.payload['actorUid'] || 'system'),
      action: String(job.payload['action']),
      target: job.payload['target'] as string | undefined,
      meta: job.payload
    },
    guardDecision
  );
  
  if (!guardDecision.allow) {
    return {
      status: 'rejected',
      decision: guardDecision,
      data: { reason: guardDecision.reason }
    };
  }
  
  // Execute remediation (placeholder - connect to real systems)
  const command = {
    ts: Date.now(),
    cmd: String(job.payload['action']),
    target: job.payload['target'] as string || null,
    by: String(job.payload['actorUid'] || 'system'),
    status: 'pending' as const
  };
  
  await db.collection('ops_commands').add(command);
  
  // Log to audit trail
  await db.collection('admin_audit').add({
    ts: Date.now(),
    action: 'agent_remediation',
    actorUid: String(job.payload['actorUid'] || 'system'),
    meta: {
      command: command.cmd,
      target: command.target,
      jobId: job.id,
      guardDecision: guardDecision.risk
    }
  });
  
  return {
    status: 'done',
    decision: guardDecision,
    data: {
      command: command.cmd,
      target: command.target,
      executedAt: command.ts
    }
  };
}
