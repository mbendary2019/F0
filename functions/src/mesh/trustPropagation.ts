/**
 * Phase 43 - Trust Propagation
 * Graph-based trust flow using personalized PageRank
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Propagate trust through mesh using PageRank-like algorithm
 */
export async function propagateTrust(): Promise<void> {
  console.log('[trustPropagation] Starting trust flow calculation...');

  // Get all peers
  const peersSnap = await db.collection('mesh_peers').get();
  const peers = peersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (peers.length === 0) {
    console.log('[trustPropagation] No peers found');
    return;
  }

  // Get all healthy links
  const linksSnap = await db.collection('mesh_links').get();
  const links = linksSnap.docs.map((d) => d.data() as any);

  // Build adjacency graph (only healthy links)
  const G = new Map<string, Set<string>>();
  for (const peer of peers) {
    G.set(peer.id, new Set<string>());
  }

  for (const link of links) {
    if (link.health === 'down') continue;

    // Bidirectional edges
    G.get(link.a)?.add(link.b);
    G.get(link.b)?.add(link.a);
  }

  console.log(`[trustPropagation] Graph: ${G.size} nodes, ${links.length} links`);

  // PageRank parameters
  const dampingFactor = 0.85; // (1 - teleport probability)
  const teleport = 1 - dampingFactor;
  const iterations = 20;

  // Initialize uniform trust scores
  const initialTrust = 1 / G.size;
  const trust = new Map<string, number>(
    Array.from(G.keys()).map((k) => [k, initialTrust])
  );

  // Power iteration
  for (let iter = 0; iter < iterations; iter++) {
    const nextTrust = new Map<string, number>();

    for (const [node, neighbors] of G) {
      const currentTrust = trust.get(node) || 0;
      const outDegree = Math.max(neighbors.size, 1);
      const sharePerNeighbor = (currentTrust * dampingFactor) / outDegree;

      // Distribute trust to neighbors (or self if isolated)
      const targets = neighbors.size > 0 ? neighbors : new Set([node]);
      for (const neighbor of targets) {
        nextTrust.set(neighbor, (nextTrust.get(neighbor) || 0) + sharePerNeighbor);
      }
    }

    // Add teleport probability (uniform distribution)
    const teleportShare = teleport / G.size;
    for (const node of G.keys()) {
      nextTrust.set(node, (nextTrust.get(node) || 0) + teleportShare);
    }

    // Normalize
    let sum = 0;
    for (const value of nextTrust.values()) {
      sum += value;
    }

    if (sum > 0) {
      for (const [node, value] of nextTrust) {
        nextTrust.set(node, value / sum);
      }
    }

    // Update trust scores
    trust.clear();
    for (const [node, value] of nextTrust) {
      trust.set(node, value);
    }
  }

  // Write trust scores back to Firestore
  let updated = 0;
  for (const [peerId, score] of trust) {
    const normalizedScore = Number(score.toFixed(4));

    await db.collection('mesh_peers').doc(peerId).set(
      { trust: normalizedScore },
      { merge: true }
    );

    console.log(`[trustPropagation] ${peerId}: trust=${normalizedScore}`);
    updated++;
  }

  console.log(`[trustPropagation] Updated ${updated} peer trust scores`);

  // Log summary stats
  const scores = Array.from(trust.values());
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  console.log(
    `[trustPropagation] Stats: min=${min.toFixed(4)}, max=${max.toFixed(4)}, avg=${avg.toFixed(4)}`
  );
}
