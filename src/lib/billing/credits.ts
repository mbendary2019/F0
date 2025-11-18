// F0 Billing v2 - Credits Management

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { PLANS, CREDIT_SINKS, type Plan, type UserCredits } from './types';

export class CreditsManager {
  private db = getFirestore();

  /**
   * Get user's current credit balance
   */
  async getCredits(uid: string): Promise<UserCredits> {
    const userDoc = await this.db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      // Create default user with free plan
      const defaultCredits: UserCredits = {
        available: PLANS.free.monthlyCredits,
        used: 0,
        renewedAt: Date.now(),
        plan: 'free',
      };

      await this.db.collection('users').doc(uid).set(
        {
          credits: defaultCredits,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return defaultCredits;
    }

    const data = userDoc.data();
    return (data?.credits as UserCredits) ?? {
      available: 0,
      used: 0,
      renewedAt: Date.now(),
      plan: 'free',
    };
  }

  /**
   * Consume credits for a specific action
   */
  async consumeCredits(uid: string, sinkId: string, quantity: number = 1): Promise<boolean> {
    const sink = CREDIT_SINKS[sinkId];
    if (!sink) {
      throw new Error(`Unknown credit sink: ${sinkId}`);
    }

    const creditsNeeded = sink.creditCost * quantity;

    return this.db.runTransaction(async (tx) => {
      const userRef = this.db.collection('users').doc(uid);
      const userDoc = await tx.get(userRef);

      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const credits: UserCredits = userDoc.data()?.credits ?? {
        available: 0,
        used: 0,
        renewedAt: Date.now(),
        plan: 'free',
      };

      // Check if user has enough credits
      if (credits.available < creditsNeeded) {
        return false; // Insufficient credits
      }

      // Deduct credits
      const updated: UserCredits = {
        ...credits,
        available: credits.available - creditsNeeded,
        used: credits.used + creditsNeeded,
      };

      tx.update(userRef, { credits: updated });

      // Log usage
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const usageRef = this.db.collection('usage').doc(uid).collection('daily').doc(today);

      tx.set(
        usageRef,
        {
          [`counters.${sinkId}.count`]: FieldValue.increment(quantity),
          [`counters.${sinkId}.credits`]: FieldValue.increment(creditsNeeded),
          totalCredits: FieldValue.increment(creditsNeeded),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return true;
    });
  }

  /**
   * Refill credits (called on subscription renewal or plan change)
   */
  async refillCredits(uid: string, plan: Plan): Promise<void> {
    const planDetails = PLANS[plan];

    await this.db.collection('users').doc(uid).update({
      'credits.available': planDetails.monthlyCredits,
      'credits.used': 0,
      'credits.renewedAt': Date.now(),
      'credits.plan': plan,
    });
  }

  /**
   * Add bonus credits (e.g., referral bonus, promotion)
   */
  async addBonusCredits(uid: string, amount: number, reason: string): Promise<void> {
    await this.db.runTransaction(async (tx) => {
      const userRef = this.db.collection('users').doc(uid);
      const userDoc = await tx.get(userRef);

      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      tx.update(userRef, {
        'credits.available': FieldValue.increment(amount),
      });

      // Log bonus
      tx.set(this.db.collection('billing').doc('bonuses').collection('entries').doc(), {
        uid,
        amount,
        reason,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  }

  /**
   * Check if user has enough credits
   */
  async hasCredits(uid: string, sinkId: string, quantity: number = 1): Promise<boolean> {
    const sink = CREDIT_SINKS[sinkId];
    if (!sink) {
      throw new Error(`Unknown credit sink: ${sinkId}`);
    }

    const credits = await this.getCredits(uid);
    const needed = sink.creditCost * quantity;

    return credits.available >= needed;
  }
}

export const creditsManager = new CreditsManager();


