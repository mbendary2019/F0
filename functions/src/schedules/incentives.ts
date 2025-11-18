/**
 * Phase 42 - Incentive Credit System
 * Aggregates and reports incentive credits earned by federation peers
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { IncentiveCredit } from '../types/consensus';

const db = admin.firestore();

export const incentives = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'UTC',
    retryCount: 2,
  },
  async (event) => {
    try {
      console.log('[incentives] Starting daily incentive aggregation...');

      // Get all peers
      const peersSnap = await db.collection('fed_peers').where('allow', '==', true).get();
      console.log(`[incentives] Processing incentives for ${peersSnap.size} peers`);

      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      for (const peerDoc of peersSnap.docs) {
        const peer = peerDoc.data() as any;
        const peerId = peer.id || peerDoc.id;

        try {
          // Get all credits earned in last 24 hours
          const creditsSnap = await db
            .collection('incentive_credits')
            .where('peer', '==', peerId)
            .where('ts', '>=', oneDayAgo)
            .get();

          let totalCredits = 0;
          const actionBreakdown: Record<string, { count: number; credits: number }> = {};

          for (const creditDoc of creditsSnap.docs) {
            const credit = creditDoc.data() as IncentiveCredit;

            totalCredits += credit.credits || 0;

            const action = credit.action || 'unknown';
            if (!actionBreakdown[action]) {
              actionBreakdown[action] = { count: 0, credits: 0 };
            }
            actionBreakdown[action].count++;
            actionBreakdown[action].credits += credit.credits || 0;
          }

          console.log(
            `[incentives] ${peerId}: ${totalCredits} credits (${creditsSnap.size} actions in last 24h)`
          );

          // Log detailed breakdown
          for (const [action, data] of Object.entries(actionBreakdown)) {
            console.log(`  - ${action}: ${data.count}x = ${data.credits} credits`);
          }

          // Create daily incentive report
          await db.collection('incentive_reports').add({
            peer: peerId,
            date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
            ts: now,
            totalCredits,
            actionBreakdown,
            period: '24h',
          });

          // Award bonus credits for high performers
          if (totalCredits >= 20) {
            await db.collection('incentive_credits').add({
              id: `bonus_${now}_${peerId}`,
              ts: now,
              peer: peerId,
              action: 'improvement_validated',
              credits: 10,
              meta: { reason: 'High daily contribution', totalDailyCredits: totalCredits },
            });

            console.log(`[incentives] BONUS: Awarded 10 credits to ${peerId} for high contribution`);
          }
        } catch (error) {
          console.error(`[incentives] Error processing incentives for ${peerId}:`, error);
        }
      }

      // Generate federation-wide leaderboard
      const allReportsSnap = await db
        .collection('incentive_reports')
        .where('date', '==', new Date().toISOString().split('T')[0])
        .get();

      const leaderboard = allReportsSnap.docs
        .map((d) => {
          const data = d.data() as any;
          return { peer: data.peer, credits: data.totalCredits || 0 };
        })
        .sort((a, b) => b.credits - a.credits)
        .slice(0, 10);

      await db.collection('incentive_leaderboard').doc('daily').set({
        date: new Date().toISOString().split('T')[0],
        ts: now,
        top10: leaderboard,
      });

      console.log('[incentives] Leaderboard (Top 3):');
      leaderboard.slice(0, 3).forEach((entry, i) => {
        console.log(`  ${i + 1}. ${entry.peer}: ${entry.credits} credits`);
      });

      console.log('[incentives] Complete');
    } catch (error) {
      console.error('[incentives] Error:', error);
      throw error;
    }
  }
);
