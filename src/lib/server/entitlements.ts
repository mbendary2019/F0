/**
 * Entitlements Helper
 * Manages user plan entitlements and limits checking
 */

import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import type { UserBilling, PlanEntitlements, BillingPlan } from '@/types/billing';
import { PLAN_CONFIGS } from './stripe';

const db = getFirestore(adminApp);

/**
 * Get user's billing document
 * Returns null if no billing document exists (defaults to free plan)
 */
export async function getUserBilling(uid: string): Promise<UserBilling | null> {
  try {
    const docRef = db.collection('users').doc(uid).collection('billing').doc('current');
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as any;

    return {
      uid: data.uid || uid,
      plan: data.plan || 'free',
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      currentPeriodEnd: data.currentPeriodEnd,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Entitlements] Error fetching user billing:', error);
    return null;
  }
}

/**
 * Get user's plan (defaults to 'free' if no billing document)
 */
export async function getUserPlan(uid: string): Promise<BillingPlan> {
  const billing = await getUserBilling(uid);
  return billing?.plan || 'free';
}

/**
 * Get user's entitlements based on their plan
 */
export async function getUserEntitlements(uid: string): Promise<PlanEntitlements> {
  const plan = await getUserPlan(uid);
  const config = PLAN_CONFIGS[plan];
  return config.entitlements;
}

/**
 * Check if user can create a new project
 */
export async function canCreateProject(uid: string): Promise<{
  allowed: boolean;
  reason?: string;
  current: number;
  max: number;
}> {
  const entitlements = await getUserEntitlements(uid);

  // Count user's current projects
  const projectsSnapshot = await db
    .collection('projects')
    .where('ownerUid', '==', uid)
    .where('status', '==', 'active')
    .get();

  const currentProjects = projectsSnapshot.size;

  const allowed = currentProjects < entitlements.maxProjects;

  return {
    allowed,
    reason: allowed
      ? undefined
      : `You have reached your plan limit of ${entitlements.maxProjects} projects`,
    current: currentProjects,
    max: entitlements.maxProjects,
  };
}

/**
 * Check if user can execute IDE job today
 */
export async function canExecuteIdeJob(uid: string): Promise<{
  allowed: boolean;
  reason?: string;
  current: number;
  max: number;
}> {
  const entitlements = await getUserEntitlements(uid);

  // Count IDE jobs executed today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const jobsSnapshot = await db
    .collection('users')
    .doc(uid)
    .collection('ideJobs')
    .where('createdAt', '>=', today)
    .get();

  const currentJobs = jobsSnapshot.size;

  const allowed = currentJobs < entitlements.maxIdeJobsPerDay;

  return {
    allowed,
    reason: allowed
      ? undefined
      : `You have reached your daily limit of ${entitlements.maxIdeJobsPerDay} IDE jobs`,
    current: currentJobs,
    max: entitlements.maxIdeJobsPerDay,
  };
}

/**
 * Check if user can consume tokens this month
 */
export async function canConsumeTokens(
  uid: string,
  requestedTokens: number
): Promise<{
  allowed: boolean;
  reason?: string;
  current: number;
  max: number;
}> {
  const entitlements = await getUserEntitlements(uid);

  // Count tokens used this month
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const usageSnapshot = await db
    .collection('users')
    .doc(uid)
    .collection('tokenUsage')
    .where('createdAt', '>=', firstDayOfMonth)
    .get();

  let currentTokens = 0;
  usageSnapshot.forEach((doc) => {
    const data = doc.data();
    currentTokens += data.tokens || 0;
  });

  const allowed = currentTokens + requestedTokens <= entitlements.maxTokensPerMonth;

  return {
    allowed,
    reason: allowed
      ? undefined
      : `You have reached your monthly token limit of ${entitlements.maxTokensPerMonth}`,
    current: currentTokens,
    max: entitlements.maxTokensPerMonth,
  };
}

/**
 * Record IDE job execution (for tracking daily limits)
 */
export async function recordIdeJob(uid: string, metadata?: any): Promise<void> {
  try {
    await db
      .collection('users')
      .doc(uid)
      .collection('ideJobs')
      .add({
        uid,
        createdAt: new Date(),
        metadata: metadata || {},
      });
  } catch (error) {
    console.error('[Entitlements] Error recording IDE job:', error);
  }
}

/**
 * Record token usage (for tracking monthly limits)
 */
export async function recordTokenUsage(
  uid: string,
  tokens: number,
  metadata?: any
): Promise<void> {
  try {
    await db
      .collection('users')
      .doc(uid)
      .collection('tokenUsage')
      .add({
        uid,
        tokens,
        createdAt: new Date(),
        metadata: metadata || {},
      });
  } catch (error) {
    console.error('[Entitlements] Error recording token usage:', error);
  }
}

/**
 * Create or update user billing document
 */
export async function setUserBilling(
  uid: string,
  billing: Partial<UserBilling>
): Promise<void> {
  try {
    const docRef = db.collection('users').doc(uid).collection('billing').doc('current');

    const now = new Date();

    await docRef.set(
      {
        uid,
        ...billing,
        updatedAt: now,
        createdAt: now, // Only set on creation
      },
      { merge: true }
    );

    console.log(`[Entitlements] Updated billing for user ${uid} to plan: ${billing.plan}`);
  } catch (error) {
    console.error('[Entitlements] Error setting user billing:', error);
    throw error;
  }
}
