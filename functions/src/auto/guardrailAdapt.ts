/**
 * Guardrail Adapter
 * Dynamically adjusts guardrails based on risk patterns
 */

import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Adapt guardrails based on recent decision patterns
 * Runs every 12 hours
 */
export const guardrailAdapt = functions.pubsub
  .schedule('every 12 hours')
  .onRun(async () => {
    console.log('[Guardrail Adapter] Starting adaptation cycle');

    const db = getFirestore();
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    try {
      // Analyze recent decisions
      const decisionsSnap = await db
        .collection('rl_decisions')
        .where('timestamp', '>=', dayAgo)
        .get()
        .catch(() => null);

      if (!decisionsSnap || decisionsSnap.empty) {
        console.log('[Guardrail Adapter] No recent decisions to analyze');
        return;
      }

      // Calculate risk metrics
      let highRisk = 0;
      let mediumRisk = 0;
      let rejected = 0;
      let total = 0;

      decisionsSnap.forEach((doc) => {
        const data = doc.data();
        total++;
        
        if (data.risk === 'high') highRisk++;
        if (data.risk === 'medium') mediumRisk++;
        if (data.approval_status === 'rejected') rejected++;
      });

      const highRiskRate = total > 0 ? highRisk / total : 0;
      const rejectionRate = total > 0 ? rejected / total : 0;

      console.log('[Guardrail Adapter] Risk analysis:', {
        total,
        highRiskRate,
        rejectionRate
      });

      // Get current protected targets
      const guardrailRef = db.collection('ops_policies').doc('protected_targets');
      const guardrailDoc = await guardrailRef.get().catch(() => null);
      const guardrailData = guardrailDoc?.exists ? guardrailDoc.data() : {};
      
      const currentTargets: string[] = guardrailData?.targets || [
        'production',
        'main_api',
        'auth_service',
        'payment_api'
      ];

      const adaptationCount = Number(guardrailData?.adaptationCount || 0);
      let newTargets = [...currentTargets];
      let reason = '';
      const changes: string[] = [];

      // Adaptation logic
      if (highRiskRate > 0.2) {
        // High risk rate → Tighten guardrails
        const additionalTargets = [
          'production_critical',
          'user_data_api',
          'transaction_service'
        ];

        additionalTargets.forEach(target => {
          if (!newTargets.includes(target)) {
            newTargets.push(target);
            changes.push(`Added ${target} to protected targets`);
          }
        });

        reason = 'high_risk_rate';
        console.log('[Guardrail Adapter] Tightening guardrails');
        
      } else if (highRiskRate < 0.05 && rejectionRate < 0.1) {
        // Low risk rate → Can relax some guardrails
        const relaxableTargets = [
          'production_critical',
          'user_data_api',
          'transaction_service'
        ];

        newTargets = newTargets.filter(target => {
          const shouldRelax = relaxableTargets.includes(target);
          if (shouldRelax) {
            changes.push(`Removed ${target} from protected targets`);
          }
          return !shouldRelax;
        });

        reason = 'risk_low_stable';
        console.log('[Guardrail Adapter] Relaxing guardrails');
        
      } else {
        reason = 'no_change_needed';
        console.log('[Guardrail Adapter] No changes needed');
      }

      // Only update if there are changes
      if (changes.length > 0) {
        await guardrailRef.set(
          {
            targets: newTargets,
            lastAdapt: now,
            reason,
            highRiskRate,
            rejectionRate,
            adaptationCount: adaptationCount + 1,
            changes
          },
          { merge: true }
        );

        console.log('[Guardrail Adapter] Updated targets:', newTargets);

        // Audit log
        await db.collection('admin_audit').add({
          ts: now,
          action: 'guardrail_adapted',
          actorUid: 'system',
          meta: {
            highRiskRate,
            rejectionRate,
            oldTargets: currentTargets,
            newTargets,
            reason,
            changes
          }
        });
      }

      console.log('[Guardrail Adapter] Adaptation cycle complete');
    } catch (error) {
      console.error('[Guardrail Adapter] Error:', error);
    }
  });


