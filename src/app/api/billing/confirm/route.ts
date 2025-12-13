/**
 * POST /api/billing/confirm
 * Confirm billing after successful Stripe checkout (Version B - No webhooks)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { getCheckoutSession, extractBillingFromSession } from '@/lib/server/stripe';
import { setUserBilling } from '@/lib/server/entitlements';
import type {

export const dynamic = 'force-dynamic';
  ConfirmBillingRequest,
  ConfirmBillingResponse,
} from '@/types/billing';

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const user = await requireUser(req);

    // Parse request body
    const body: ConfirmBillingRequest = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Retrieve checkout session from Stripe
    const session = await getCheckoutSession(sessionId);

    // Verify session belongs to this user
    if (session.client_reference_id !== user.uid) {
      return NextResponse.json(
        { error: 'Session does not belong to this user' },
        { status: 403 }
      );
    }

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        {
          error: 'Payment not completed',
          details: `Payment status: ${session.payment_status}`,
        },
        { status: 400 }
      );
    }

    // Extract billing info from session
    const billingInfo = extractBillingFromSession(session);

    // Update user's billing document in Firestore
    await setUserBilling(user.uid, {
      plan: billingInfo.plan,
      stripeCustomerId: billingInfo.stripeCustomerId,
      stripeSubscriptionId: billingInfo.stripeSubscriptionId,
      currentPeriodEnd: billingInfo.currentPeriodEnd,
    });

    const response: ConfirmBillingResponse = {
      success: true,
      plan: billingInfo.plan,
      message: `Successfully upgraded to ${billingInfo.plan} plan`,
    };

    console.log(
      `[API Billing] Confirmed billing for user ${user.uid}, plan: ${billingInfo.plan}, session: ${sessionId}`
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[API Billing] Confirm billing failed:', error);

    // Handle authentication errors
    if (error.message === 'NO_TOKEN' || error.message === 'INVALID_TOKEN') {
      return NextResponse.json(
        { error: 'Unauthorized', details: error.message },
        { status: 401 }
      );
    }

    // Handle Stripe errors
    if (error.type?.startsWith('Stripe')) {
      return NextResponse.json(
        { error: 'Stripe error', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
