/**
 * Phase 38 - Graph Triggers
 * Real-time graph updates on Firestore writes
 */

import { onDocumentWritten, onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { upsertNode, upsertEdge } from '../graph/graphBuilder';
import { GraphNode } from '../types/graph';

const db = admin.firestore();

/**
 * Trigger on ops_stats write
 * Updates component and metric_window nodes
 */
export const onStatsWrite = onDocumentWritten(
  'ops_stats/{id}',
  async (event) => {
    try {
      const id = event.params.id; // e.g., Router:24h
      const [component, window] = id.split(':');

      if (!component || !window) {
        console.log(`[onStatsWrite] Invalid document ID: ${id}`);
        return;
      }

      // Create/update component node
      await upsertNode({
        id: `component:${component}`,
        kind: 'component',
        label: component,
        props: {},
        ts: Date.now(),
      });

      // Get current stats data
      const statsDoc = await db.doc(`ops_stats/${id}`).get();
      const s = (statsDoc.exists ? statsDoc.data() : {}) as any;

      // Create/update metric window node
      await upsertNode({
        id: `metric_window:${component}:${window}`,
        kind: 'metric_window',
        label: `${component}:${window}`,
        props: {
          successRate: s.successRate,
          p50Latency: s.p50Latency,
          p95Latency: s.p95Latency,
          avgCostUsd: s.avgCostUsd,
          avgReward: s.avgReward,
          n: s.n,
        },
        ts: Date.now(),
      });

      // Create edge
      await upsertEdge({
        kind: 'DERIVED_FROM',
        src: `metric_window:${component}:${window}`,
        dst: `component:${component}`,
        weight: 0.9,
        ts: Date.now(),
        id: '',
      });

      console.log(`[onStatsWrite] Updated graph for ${id}`);
    } catch (error) {
      console.error('[onStatsWrite] Error:', error);
    }
  }
);

/**
 * Trigger on ops_policies write
 * Updates policy and policy_version nodes
 */
export const onPolicyWrite = onDocumentWritten(
  'ops_policies/{verId}',
  async (event) => {
    try {
      const after = event.data?.after;
      const before = event.data?.before;

      if (!after?.exists && !before?.exists) return;

      const p: any = after?.exists ? after.data() : before?.data();
      const base = p.id;
      const ver = p.version;

      // Create/update policy node
      await upsertNode({
        id: `policy:${base}`,
        kind: 'policy',
        label: base,
        props: {},
        ts: Date.now(),
      });

      // Create/update policy version node
      await upsertNode({
        id: `policy_version:${base}@${ver}`,
        kind: 'policy_version',
        label: `${base}@${ver}`,
        props: {
          status: p.status,
          params: p.params,
          createdBy: p.createdBy,
        },
        ts: Date.now(),
      });

      // Create edge
      await upsertEdge({
        kind: 'DERIVED_FROM',
        src: `policy_version:${base}@${ver}`,
        dst: `policy:${base}`,
        weight: 1.0,
        ts: Date.now(),
        id: '',
      });

      console.log(`[onPolicyWrite] Updated graph for ${base}@${ver}`);
    } catch (error) {
      console.error('[onPolicyWrite] Error:', error);
    }
  }
);

/**
 * Trigger on ops_decisions create
 * Creates decision node and relationships
 */
export const onDecisionCreate = onDocumentCreated(
  'ops_decisions/{id}',
  async (event) => {
    try {
      const r: any = event.data?.data();
      if (!r) return;

      const decId = `decision:${event.params.id}`;

      // Create decision node
      await upsertNode({
        id: decId,
        kind: 'decision',
        label: `${r.actor}:${r.component}`,
        props: {
          confidence: r.confidence,
          reasons: r.reasons,
          guardrail: r.guardrail,
          abBucket: r.abBucket,
        },
        ts: Date.now(),
      });

      // Link to component
      if (r.component) {
        await upsertEdge({
          kind: 'AFFECTS',
          src: decId,
          dst: `component:${r.component}`,
          weight: r.confidence || 0.5,
          ts: Date.now(),
          id: '',
        });
      }

      console.log(`[onDecisionCreate] Created graph node for decision ${event.params.id}`);
    } catch (error) {
      console.error('[onDecisionCreate] Error:', error);
    }
  }
);

/**
 * Trigger on ops_confidence write
 * Updates confidence node and relationships
 */
export const onConfidenceWrite = onDocumentWritten(
  'ops_confidence/{id}',
  async (event) => {
    try {
      const after = event.data?.after;
      if (!after?.exists) return;

      const v: any = after.data();
      const comp = v.component;
      const win = v.window;

      // Create/update confidence node
      await upsertNode({
        id: `confidence:${comp}:${win}`,
        kind: 'confidence',
        label: `conf:${comp}:${win}`,
        props: {
          score: v.score,
          reasons: v.reasons,
          sampleSize: v.sampleSize,
          metrics: v.metrics,
        },
        ts: Date.now(),
      });

      // Link to metric window
      await upsertEdge({
        kind: 'SEES',
        src: `confidence:${comp}:${win}`,
        dst: `metric_window:${comp}:${win}`,
        weight: v.score || 0.5,
        ts: Date.now(),
        id: '',
      });

      console.log(`[onConfidenceWrite] Updated graph for confidence ${comp}:${win}`);
    } catch (error) {
      console.error('[onConfidenceWrite] Error:', error);
    }
  }
);
