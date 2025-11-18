/**
 * Phase 38 - Entity Extractor
 * AI-assisted relationship detection from audit logs and text
 */

import * as admin from 'firebase-admin';
import { upsertEdge, upsertNode } from './graphBuilder';
import { GraphNode } from '../types/graph';

const db = admin.firestore();

/**
 * Extract relationships from audit logs
 * Uses heuristic pattern matching (MVP)
 * Can be enhanced with LLM in future phases
 */
export async function extractFromAudit(): Promise<void> {
  console.log('[entityExtractor] Extracting from ops_audit...');

  try {
    const audits = await db
      .collection('ops_audit')
      .orderBy('ts', 'desc')
      .limit(500)
      .get();

    let relationshipsExtracted = 0;

    for (const doc of audits.docs) {
      const v: any = doc.data();
      const note = (v.note || '').toLowerCase();
      const action = (v.action || '').toLowerCase();
      const base = String(v.id || 'unknown');
      const toVer = String(v.to || '');
      const fromVer = String(v.from || '');

      // Create audit decision node
      const auditDecisionId = `decision:audit:${doc.id}`;
      const auditNode: GraphNode = {
        id: auditDecisionId,
        kind: 'decision',
        label: `audit:${action}`,
        props: {
          action,
          actor: v.actor,
          note: v.note,
        },
        ts: v.ts || Date.now(),
      };

      await upsertNode(auditNode);

      // 1) Link audit -> policy_version (TRIGGERS)
      if (toVer && toVer !== 'null' && toVer !== 'undefined') {
        await upsertEdge({
          kind: 'TRIGGERS',
          src: auditDecisionId,
          dst: `policy_version:${base}@${toVer}`,
          weight: 0.7,
          props: { actor: v.actor, action },
          ts: Date.now(),
          id: '',
        });
        relationshipsExtracted++;
      }

      // 2) Rollback relationship
      if (action.includes('rollback') && fromVer && toVer) {
        await upsertEdge({
          kind: 'ROLLED_BACK_BY',
          src: `policy_version:${base}@${fromVer}`,
          dst: `policy_version:${base}@${toVer}`,
          weight: 0.9,
          props: { reason: note },
          ts: Date.now(),
          id: '',
        });
        relationshipsExtracted++;
      }

      // 3) Infer VIOLATES if note contains violation cues
      if (note.includes('violation') || note.includes('slo') || note.includes('error')) {
        // Try to extract component from note
        const componentMatch = extractComponentFromText(note);
        if (componentMatch) {
          await upsertEdge({
            kind: 'VIOLATES',
            src: `policy_version:${base}@${toVer || fromVer}`,
            dst: `component:${componentMatch}`,
            weight: 0.6,
            props: { reason: 'audit_cue', note: v.note },
            ts: Date.now(),
            id: '',
          });
          relationshipsExtracted++;
        }
      }

      // 4) Infer IMPROVES if note contains positive cues
      if (note.includes('improv') || note.includes('better') || note.includes('optimiz')) {
        const componentMatch = extractComponentFromText(note);
        if (componentMatch) {
          await upsertEdge({
            kind: 'IMPROVES',
            src: `policy_version:${base}@${toVer || fromVer}`,
            dst: `component:${componentMatch}`,
            weight: 0.6,
            props: { reason: 'audit_cue', note: v.note },
            ts: Date.now(),
            id: '',
          });
          relationshipsExtracted++;
        }
      }

      // 5) Activation relationship
      if (action.includes('activate') && toVer) {
        await upsertEdge({
          kind: 'TRIGGERS',
          src: auditDecisionId,
          dst: `policy_version:${base}@${toVer}`,
          weight: 0.95,
          props: { action: 'activation', actor: v.actor },
          ts: Date.now(),
          id: '',
        });
        relationshipsExtracted++;
      }
    }

    console.log(`[entityExtractor] Extracted ${relationshipsExtracted} relationships from audit logs`);
  } catch (error) {
    console.error('[entityExtractor] Extract error:', error);
    throw error;
  }
}

/**
 * Helper: Extract component name from free text
 * Uses simple pattern matching (can be enhanced with NER/LLM)
 */
function extractComponentFromText(text: string): string | null {
  const knownComponents = [
    'router',
    'autoscaler',
    'watchdog',
    'feedbackloop',
    'canarymanager',
  ];

  const lowerText = text.toLowerCase();

  for (const comp of knownComponents) {
    if (lowerText.includes(comp)) {
      // Return capitalized version
      return comp.charAt(0).toUpperCase() + comp.slice(1);
    }
  }

  return null;
}

/**
 * Extract model relationships from policy params
 */
export async function extractModelRelationships(): Promise<void> {
  console.log('[entityExtractor] Extracting model relationships...');

  try {
    const policies = await db.collection('ops_policies').get();
    let relationshipsExtracted = 0;

    for (const doc of policies.docs) {
      const pol: any = doc.data();
      const weights = pol.params?.modelWeights;

      if (!weights || typeof weights !== 'object') continue;

      const policyVerionId = `policy_version:${pol.id}@${pol.version}`;

      // Create model nodes and USES edges
      for (const [modelName, weight] of Object.entries(weights)) {
        const modelId = `model:${modelName}`;

        // Create model node
        await upsertNode({
          id: modelId,
          kind: 'model',
          label: modelName,
          props: {},
          ts: Date.now(),
        });

        // Create USES edge
        await upsertEdge({
          kind: 'USES',
          src: policyVerionId,
          dst: modelId,
          weight: Number(weight) || 0.5,
          props: { modelWeight: weight },
          ts: Date.now(),
          id: '',
        });
        relationshipsExtracted++;
      }
    }

    console.log(`[entityExtractor] Extracted ${relationshipsExtracted} model relationships`);
  } catch (error) {
    console.error('[entityExtractor] Model extraction error:', error);
    throw error;
  }
}
