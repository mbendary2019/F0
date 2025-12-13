/**
 * POST /api/billing/create-checkout-session
 * Create a Stripe checkout session for subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { createCheckoutSession } from '@/lib/server/stripe';
import type {
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
} from '@/types/billing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const user = await requireUser(req);

    // Parse request body
    const body: CreateCheckoutSessionRequest = await req.json();
    const { plan, successUrl, cancelUrl } = body;

    // Validate plan
    if (!plan || !['starter', 'pro', 'ultimate'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be starter, pro, or ultimate.' },
        { status: 400 }
      );
    }

    // Validate URLs
    if (!successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: 'successUrl and cancelUrl are required' },
        { status: 400 }
      );
    }

    // Create Stripe checkout session
    const session = await createCheckoutSession({
      plan,
      userId: user.uid,
      userEmail: user.email,
      successUrl,
      cancelUrl,
    });

    const response: CreateCheckoutSessionResponse = {
      sessionId: session.id,
      url: session.url || '',
    };

    console.log(
      `[API Billing] Created checkout session ${session.id} for user ${user.uid}, plan: ${plan}`
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[API Billing] Create checkout session failed:', error);

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
