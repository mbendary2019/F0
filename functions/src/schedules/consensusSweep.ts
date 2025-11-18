/**
 * Phase 42 - Consensus Sweep
 * Periodically checks open proposals for quorum and timeout
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { ConsensusProposal } from '../types/consensus';
import { checkQuorum, closeProposal } from '../consensus/builder';

const db = admin.firestore();

export const consensusSweep = onSchedule(
  {
    schedule: 'every 10 minutes',
    timeZone: 'UTC',
    retryCount: 2,
  },
  async (event) => {
    try {
      console.log('[consensusSweep] Starting sweep...');

      // Get all open proposals
      const openSnap = await db
        .collection('consensus_proposals')
        .where('status', '==', 'open')
        .get();

      console.log(`[consensusSweep] Found ${openSnap.size} open proposals`);

      const now = Date.now();
      let approved = 0;
      let rejected = 0;
      let expired = 0;

      for (const doc of openSnap.docs) {
        const proposal = doc.data() as ConsensusProposal;

        // Check if expired
        if (now - proposal.ts > proposal.ttlMs) {
          await closeProposal(proposal.id, 'expired');
          expired++;

          await db.collection('ops_audit').add({
            ts: Date.now(),
            actor: 'consensusSweep',
            action: 'proposal_expired',
            details: {
              proposalId: proposal.id,
              policyId: proposal.policyId,
              votes: proposal.votes.length,
            },
          });

          console.log(`[consensusSweep] Proposal ${proposal.id} expired`);
          continue;
        }

        // Check quorum
        const quorumResult = await checkQuorum(proposal.id);

        if (!quorumResult.reached) {
          console.log(
            `[consensusSweep] Proposal ${proposal.id}: ${quorumResult.totalVotes}/${quorumResult.requiredVotes} votes`
          );
          continue;
        }

        // Quorum reached - approve or reject based on votes
        if (quorumResult.approved) {
          await closeProposal(proposal.id, 'approved');
          approved++;

          await db.collection('ops_audit').add({
            ts: Date.now(),
            actor: 'consensusSweep',
            action: 'proposal_approved',
            details: {
              proposalId: proposal.id,
              policyId: proposal.policyId,
              acceptVotes: quorumResult.acceptCount,
              totalVotes: quorumResult.totalVotes,
            },
          });

          console.log(
            `[consensusSweep] Proposal ${proposal.id} APPROVED (${quorumResult.acceptCount}/${quorumResult.totalVotes})`
          );
        } else {
          await closeProposal(proposal.id, 'rejected');
          rejected++;

          await db.collection('ops_audit').add({
            ts: Date.now(),
            actor: 'consensusSweep',
            action: 'proposal_rejected',
            details: {
              proposalId: proposal.id,
              policyId: proposal.policyId,
              acceptVotes: quorumResult.acceptCount,
              rejectVotes: quorumResult.rejectCount,
              totalVotes: quorumResult.totalVotes,
            },
          });

          console.log(
            `[consensusSweep] Proposal ${proposal.id} REJECTED (${quorumResult.acceptCount} accept, ${quorumResult.rejectCount} reject)`
          );
        }
      }

      console.log(
        `[consensusSweep] Complete: ${approved} approved, ${rejected} rejected, ${expired} expired`
      );
    } catch (error) {
      console.error('[consensusSweep] Error:', error);
      throw error;
    }
  }
);
