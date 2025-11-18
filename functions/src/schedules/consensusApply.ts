/**
 * Phase 42 - Consensus Apply
 * Applies approved consensus proposals to the system
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { ConsensusProposal } from '../types/consensus';

const db = admin.firestore();

export const consensusApply = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'UTC',
    retryCount: 2,
  },
  async (event) => {
    try {
      console.log('[consensusApply] Starting apply process...');

      // Get all approved but not yet applied proposals
      const approvedSnap = await db
        .collection('consensus_proposals')
        .where('status', '==', 'approved')
        .orderBy('ts', 'asc')
        .limit(5)
        .get();

      console.log(`[consensusApply] Found ${approvedSnap.size} approved proposals to apply`);

      for (const doc of approvedSnap.docs) {
        const proposal = doc.data() as ConsensusProposal;

        try {
          // Apply the policy parameters
          const policyRef = db.collection('ops_policies').doc(`${proposal.policyId}@${proposal.baseVersion}`);
          const policySnap = await policyRef.get();

          if (!policySnap.exists) {
            console.error(`[consensusApply] Policy not found: ${proposal.policyId}@${proposal.baseVersion}`);

            await db.collection('consensus_proposals').doc(proposal.id).update({
              status: 'rejected',
              error: 'Policy not found',
            });
            continue;
          }

          const existingPolicy = policySnap.data() as any;

          // Create new version with consensus params
          const newVersion = bumpVersion(proposal.baseVersion);
          const newPolicyRef = db.collection('ops_policies').doc(`${proposal.policyId}@${newVersion}`);

          await newPolicyRef.set({
            ...existingPolicy,
            version: newVersion,
            params: {
              ...existingPolicy.params,
              ...proposal.params,
            },
            status: 'active',
            consensus: {
              proposalId: proposal.id,
              from: proposal.from,
              votes: proposal.votes.length,
              appliedAt: Date.now(),
            },
            createdAt: Date.now(),
            createdBy: 'consensus',
          });

          // Mark proposal as applied
          await db.collection('consensus_proposals').doc(proposal.id).update({
            status: 'applied',
            appliedAt: Date.now(),
            appliedVersion: newVersion,
          });

          // Log audit
          await db.collection('ops_audit').add({
            ts: Date.now(),
            actor: 'consensusApply',
            action: 'consensus_applied',
            details: {
              proposalId: proposal.id,
              policyId: proposal.policyId,
              fromVersion: proposal.baseVersion,
              toVersion: newVersion,
              votes: proposal.votes.length,
            },
          });

          // Award incentive credits for successful consensus
          await db.collection('incentive_credits').add({
            id: `consensus_${Date.now()}_${proposal.from}`,
            ts: Date.now(),
            peer: proposal.from,
            action: 'consensus_reached',
            credits: 5,
            meta: { proposalId: proposal.id, policyId: proposal.policyId },
          });

          console.log(
            `[consensusApply] Applied proposal ${proposal.id}: ${proposal.policyId} ${proposal.baseVersion} → ${newVersion}`
          );
        } catch (error: any) {
          console.error(`[consensusApply] Error applying proposal ${proposal.id}:`, error);

          await db.collection('consensus_proposals').doc(proposal.id).update({
            status: 'rejected',
            error: error.message || 'Application failed',
          });
        }
      }

      console.log('[consensusApply] Complete');
    } catch (error) {
      console.error('[consensusApply] Error:', error);
      throw error;
    }
  }
);

function bumpVersion(version: string): string {
  const [major, minor, patch] = version.split('.').map((n) => parseInt(n, 10));
  return `${major}.${minor}.${(patch || 0) + 1}`;
}
