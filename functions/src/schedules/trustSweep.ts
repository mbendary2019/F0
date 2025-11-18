/**
 * Phase 42 - Trust Score Sweep
 * Calculates and updates trust scores for federation peers
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { TrustScore } from '../types/consensus';

const db = admin.firestore();

export const trustSweep = onSchedule(
  {
    schedule: 'every 4 hours',
    timeZone: 'UTC',
    retryCount: 2,
  },
  async (event) => {
    try {
      console.log('[trustSweep] Starting trust score calculation...');

      // Get all peers
      const peersSnap = await db.collection('fed_peers').where('allow', '==', true).get();
      console.log(`[trustSweep] Calculating trust for ${peersSnap.size} peers`);

      for (const peerDoc of peersSnap.docs) {
        const peer = peerDoc.data() as any;
        const peerId = peer.id || peerDoc.id;

        try {
          // Calculate uptime ratio (last seen within 24h)
          const lastSeenAt = peer.lastSeenAt || 0;
          const hoursSinceLastSeen = (Date.now() - lastSeenAt) / (1000 * 60 * 60);
          const uptimeRatio = Math.max(0, 1 - hoursSinceLastSeen / 24);

          // Calculate good proposals ratio
          const proposalsSnap = await db
            .collection('consensus_proposals')
            .where('from', '==', peerId)
            .get();

          const totalProposals = proposalsSnap.size;
          const goodProposals = proposalsSnap.docs.filter(
            (d) => (d.data() as any).status === 'approved' || (d.data() as any).status === 'applied'
          ).length;

          const goodProposalsRatio = totalProposals > 0 ? goodProposals / totalProposals : 0.5;

          // Calculate voting accuracy (votes aligned with final outcome)
          const votesSnap = await db.collection('consensus_votes').where('peer', '==', peerId).get();

          let alignedVotes = 0;
          let totalVotes = 0;

          for (const voteDoc of votesSnap.docs) {
            const vote = voteDoc.data() as any;
            const proposalSnap = await db.collection('consensus_proposals').doc(vote.proposalId).get();

            if (proposalSnap.exists) {
              const proposal = proposalSnap.data() as any;

              if (proposal.status === 'approved' && vote.vote === 'accept') {
                alignedVotes++;
              } else if (proposal.status === 'rejected' && vote.vote === 'reject') {
                alignedVotes++;
              }

              totalVotes++;
            }
          }

          const votingAccuracy = totalVotes > 0 ? alignedVotes / totalVotes : 0.5;

          // Calculate contribution frequency (telemetry publishes in last 7 days)
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          const recentTelemetry = await db
            .collection('fed_inbox')
            .where('from', '==', peerId)
            .where('ts', '>=', sevenDaysAgo)
            .where('kind', '==', 'telemetry')
            .get();

          // Normalize: expect 1 per day = 7 total
          const contributionFrequency = Math.min(1, recentTelemetry.size / 7);

          // Weighted trust score
          const score =
            0.2 * uptimeRatio +
            0.3 * goodProposalsRatio +
            0.3 * votingAccuracy +
            0.2 * contributionFrequency;

          const trustScore: TrustScore = {
            peer: peerId,
            ts: Date.now(),
            score: Number(score.toFixed(3)),
            factors: {
              uptimeRatio: Number(uptimeRatio.toFixed(3)),
              goodProposalsRatio: Number(goodProposalsRatio.toFixed(3)),
              votingAccuracy: Number(votingAccuracy.toFixed(3)),
              contributionFrequency: Number(contributionFrequency.toFixed(3)),
            },
          };

          await db.collection('trust_scores').doc(peerId).set(trustScore);

          console.log(
            `[trustSweep] ${peerId}: score=${score.toFixed(3)} (uptime=${uptimeRatio.toFixed(2)}, proposals=${goodProposalsRatio.toFixed(2)}, voting=${votingAccuracy.toFixed(2)}, contrib=${contributionFrequency.toFixed(2)})`
          );

          // Auto-disable peers with low trust
          if (score < 0.3 && totalProposals > 5) {
            await db.collection('fed_peers').doc(peerDoc.id).update({ allow: false });

            await db.collection('ops_audit').add({
              ts: Date.now(),
              actor: 'trustSweep',
              action: 'peer_disabled',
              details: {
                peer: peerId,
                trustScore: score,
                reason: 'Low trust score',
              },
            });

            console.warn(`[trustSweep] DISABLED peer ${peerId} due to low trust: ${score.toFixed(3)}`);
          }
        } catch (error) {
          console.error(`[trustSweep] Error calculating trust for ${peerId}:`, error);
        }
      }

      console.log('[trustSweep] Complete');
    } catch (error) {
      console.error('[trustSweep] Error:', error);
      throw error;
    }
  }
);
