/**
 * Phase 42 - Consensus Proposal Builder
 * Creates and submits consensus proposals for federated policy optimization
 */

import * as admin from 'firebase-admin';
import { v4 as uuid } from 'uuid';
import { ConsensusProposal } from '../types/consensus';

const db = admin.firestore();

export interface ProposalInput {
  policyId: string;
  baseVersion: string;
  params: Record<string, any>;
  from: string; // peer id
  evidence?: {
    rewardDelta?: number;
    latencyDeltaMs?: number;
    sampleSize?: number;
  };
  quorum?: number;
  ttlMs?: number;
}

/**
 * Build and submit a consensus proposal
 */
export async function buildProposal(input: ProposalInput): Promise<ConsensusProposal> {
  const proposal: ConsensusProposal = {
    id: uuid(),
    ts: Date.now(),
    policyId: input.policyId,
    baseVersion: input.baseVersion,
    params: input.params,
    from: input.from,
    quorum: input.quorum ?? 0.67, // Default: ⅔ majority
    ttlMs: input.ttlMs ?? 3600000, // Default: 1 hour
    votes: [],
    status: 'open',
    evidence: input.evidence,
  };

  // Persist to Firestore
  await db.collection('consensus_proposals').doc(proposal.id).set(proposal);

  console.log(`[buildProposal] Created proposal ${proposal.id} for ${input.policyId}@${input.baseVersion}`);

  return proposal;
}

/**
 * Cast a vote on an existing proposal
 */
export async function castVote(
  proposalId: string,
  peer: string,
  vote: 'accept' | 'reject' | 'abstain',
  reason?: string,
  signature?: string
): Promise<void> {
  const ref = db.collection('consensus_proposals').doc(proposalId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  const proposal = snap.data() as ConsensusProposal;

  if (proposal.status !== 'open') {
    throw new Error(`Proposal ${proposalId} is not open (status: ${proposal.status})`);
  }

  // Check if peer already voted
  const existing = proposal.votes.find((v) => v.peer === peer);
  if (existing) {
    console.log(`[castVote] Peer ${peer} already voted on ${proposalId}`);
    return;
  }

  // Add vote
  proposal.votes.push({
    peer,
    vote,
    reason,
    ts: Date.now(),
    sig: signature,
  });

  await ref.update({ votes: proposal.votes });

  console.log(`[castVote] Peer ${peer} voted ${vote} on ${proposalId}`);
}

/**
 * Check if proposal has reached quorum
 */
export async function checkQuorum(proposalId: string): Promise<{
  reached: boolean;
  approved: boolean;
  acceptCount: number;
  rejectCount: number;
  totalVotes: number;
  requiredVotes: number;
}> {
  const snap = await db.collection('consensus_proposals').doc(proposalId).get();
  if (!snap.exists) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  const proposal = snap.data() as ConsensusProposal;

  // Get total peer count
  const peersSnap = await db.collection('fed_peers').where('allow', '==', true).get();
  const totalPeers = peersSnap.size;

  const acceptCount = proposal.votes.filter((v) => v.vote === 'accept').length;
  const rejectCount = proposal.votes.filter((v) => v.vote === 'reject').length;
  const totalVotes = proposal.votes.length;

  const requiredVotes = Math.ceil(totalPeers * proposal.quorum);
  const reached = totalVotes >= requiredVotes;
  const approved = acceptCount >= requiredVotes;

  return {
    reached,
    approved,
    acceptCount,
    rejectCount,
    totalVotes,
    requiredVotes,
  };
}

/**
 * Close proposal (expire, approve, or reject)
 */
export async function closeProposal(
  proposalId: string,
  status: 'approved' | 'rejected' | 'expired'
): Promise<void> {
  const ref = db.collection('consensus_proposals').doc(proposalId);
  await ref.update({ status, closedAt: Date.now() });

  console.log(`[closeProposal] Proposal ${proposalId} closed with status: ${status}`);
}
