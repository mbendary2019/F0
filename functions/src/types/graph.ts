/**
 * Phase 38 - Cognitive Knowledge Graph
 * Type definitions for graph nodes and edges
 */

export type NodeKind =
  | 'component'      // e.g., Router, AutoScaler, Watchdog
  | 'policy'         // policy id (router-core)
  | 'policy_version' // router-core@1.0.1
  | 'decision'       // ops_decisions entry
  | 'metric_window'  // ops_stats window pointer (component:24h)
  | 'incident'       // incident record (optional / Phase 22)
  | 'config'         // config docs (reward_config, ops_cadence)
  | 'model'          // model identity (gpt-5, claude, gemini)
  | 'confidence';    // confidence snapshot

export interface GraphNode {
  id: string;         // stable key, e.g., 'policy:router-core@1.0.1'
  kind: NodeKind;
  label: string;      // short label for UI
  props: Record<string, any>;
  ts: number;         // last updated
}

export type EdgeKind =
  | 'AFFECTS'
  | 'DERIVED_FROM'
  | 'GOVERNED_BY'
  | 'VIOLATES'
  | 'TRIGGERS'
  | 'ROLLED_BACK_BY'
  | 'USES'
  | 'SEES'
  | 'IMPROVES'
  | 'DEGRADES';

export interface GraphEdge {
  id: string;       // `${src}->${kind}->${dst}`
  kind: EdgeKind;
  src: string;      // node id
  dst: string;      // node id
  weight?: number;  // 0..1 confidence/strength
  props?: Record<string, any>;
  ts: number;
}

export interface GraphTraverseRequest {
  from: string;
  maxDepth?: number;
  edgeKinds?: EdgeKind[];
}

export interface GraphTraverseResponse {
  nodes: string[];
  edges: GraphEdge[];
}
