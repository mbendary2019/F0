/**
 * Phase 43.1 - Weighted Gossip
 * Trust-aware peer selection for gossip propagation
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

export interface PeerWeight {
  id: string;
  trust: number;
  weight: number;
}

/**
 * Select peers for gossip fanout weighted by trust scores
 * Higher trust = higher probability of selection
 */
export async function pickFanout(from: string, maxFanout = 3): Promise<string[]> {
  try {
    const peersSnap = await db.collection('mesh_peers').get();

    // Filter out self and get all peers with trust scores
    const items = peersSnap.docs
      .map((d) => d.data() as any)
      .filter((p) => p.id !== from);

    if (items.length === 0) {
      console.log('[pickFanout] No peers available');
      return [];
    }

    // Calculate total trust sum
    const sum = items.reduce((acc, curr) => acc + (curr.trust || 0.5), 0) || 1;

    // Create weighted list (normalize by sum)
    const weighted: PeerWeight[] = items.map((p) => ({
      id: p.id,
      trust: p.trust || 0.5,
      weight: (p.trust || 0.5) / sum,
    }));

    // Sort by weight descending for better selection
    weighted.sort((a, b) => b.weight - a.weight);

    console.log(
      '[pickFanout] Weighted peers:',
      weighted.map((w) => `${w.id}:${w.weight.toFixed(3)}`)
    );

    // Roulette wheel selection
    const selected: string[] = [];
    const maxAttempts = maxFanout * 3; // Prevent infinite loops
    let attempts = 0;

    while (selected.length < Math.min(maxFanout, weighted.length) && attempts < maxAttempts) {
      attempts++;
      const r = Math.random();
      let acc = 0;

      for (const item of weighted) {
        acc += item.weight;
        if (acc >= r && !selected.includes(item.id)) {
          selected.push(item.id);
          break;
        }
      }
    }

    console.log(`[pickFanout] Selected ${selected.length}/${maxFanout} peers:`, selected);
    return selected;
  } catch (error) {
    console.error('[pickFanout] Error:', error);
    return [];
  }
}

/**
 * Calculate gossip rate limit based on peer trust
 * Higher trust = higher rate limit
 */
export function getRateLimit(trust: number): number {
  // Base rate: 10 msg/min for trust=0.5
  // Max rate: 50 msg/min for trust=1.0
  // Min rate: 2 msg/min for trust=0.0
  const baseRate = 10;
  const maxRate = 50;
  const minRate = 2;

  const rate = minRate + (maxRate - minRate) * trust;
  return Math.round(rate);
}

/**
 * Get peer endpoints for direct connection
 */
export async function getPeerEndpoints(peerId: string): Promise<{
  https?: string;
  webrtc?: string;
} | null> {
  try {
    const peerDoc = await db.collection('mesh_peers').doc(peerId).get();

    if (!peerDoc.exists) {
      console.warn(`[getPeerEndpoints] Peer ${peerId} not found`);
      return null;
    }

    const peer = peerDoc.data() as any;
    return peer.endpoints || null;
  } catch (error) {
    console.error('[getPeerEndpoints] Error:', error);
    return null;
  }
}
