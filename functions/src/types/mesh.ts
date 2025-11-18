/**
 * Phase 43 - Global Cognitive Mesh
 * Type definitions for P2P overlay, gossip replication, and trust propagation
 */

export type LinkHealth = 'up' | 'degraded' | 'down';

export interface MeshPeer {
  id: string; // fz-xx slug
  pubKey: string; // Ed25519 public key
  region?: string; // ISO region
  endpoints: { webrtc?: string; https?: string };
  lastSeenAt?: number;
  trust?: number; // 0..1
}

export interface MeshLink {
  id: string; // peerA<->peerB
  a: string;
  b: string; // peer ids
  rttMs?: number; // ping
  health: LinkHealth;
  ts: number;
}

export interface GossipEnvelope {
  id: string; // ge_{uuid}
  ts: number;
  kind: 'proposal' | 'vote' | 'risk' | 'telemetry';
  payload: any; // normalized payload
  from: string; // peer id
  sig: string; // signature over (kind,payload,ts)
  parents?: string[]; // DAG ancestry
}

export interface MeshSnapshot {
  ts: number;
  state: Record<string, any>; // key: kind:id -> latest gossip
}
