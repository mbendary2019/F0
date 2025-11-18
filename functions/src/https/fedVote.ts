/**
 * Phase 42 - Federated Vote Endpoint
 * HTTPS endpoint for receiving votes from federation peers
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { castVote } from '../consensus/builder';

const db = admin.firestore();

export const fedVote = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      // Only accept POST
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      const {
        proposalId,
        peer,
        vote,
        reason,
        signature,
      } = req.body as {
        proposalId: string;
        peer: string;
        vote: 'accept' | 'reject' | 'abstain';
        reason?: string;
        signature?: string;
      };

      // Validate required fields
      if (!proposalId || !peer || !vote) {
        res.status(400).json({ error: 'Missing required fields: proposalId, peer, vote' });
        return;
      }

      // Validate vote value
      if (!['accept', 'reject', 'abstain'].includes(vote)) {
        res.status(400).json({ error: 'Invalid vote value. Must be: accept, reject, or abstain' });
        return;
      }

      // Verify peer is allowed
      const peerSnap = await db.collection('fed_peers').doc(peer).get();
      if (!peerSnap.exists) {
        res.status(403).json({ error: 'Unknown peer' });
        return;
      }

      const peerData = peerSnap.data() as any;
      if (!peerData.allow) {
        res.status(403).json({ error: 'Peer not allowed' });
        return;
      }

      // TODO: Verify signature using peer's pubKey
      // For MVP, skip signature verification
      if (signature && peerData.pubKey) {
        // const valid = await verifySignature(proposalId, vote, signature, peerData.pubKey);
        // if (!valid) {
        //   res.status(403).json({ error: 'Invalid signature' });
        //   return;
        // }
      }

      // Cast vote
      await castVote(proposalId, peer, vote, reason, signature);

      // Log audit
      await db.collection('ops_audit').add({
        ts: Date.now(),
        actor: 'fedVote',
        action: 'vote_received',
        details: {
          proposalId,
          peer,
          vote,
          reason,
        },
      });

      // Award incentive credit for voting
      await db.collection('incentive_credits').add({
        id: `vote_${Date.now()}_${peer}`,
        ts: Date.now(),
        peer,
        action: 'vote_cast',
        credits: 1,
        meta: { proposalId, vote },
      });

      res.status(200).json({
        success: true,
        proposalId,
        peer,
        vote,
      });
    } catch (error: any) {
      console.error('[fedVote] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
);
