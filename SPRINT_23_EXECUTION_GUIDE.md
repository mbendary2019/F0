# Sprint 23 Execution Guide - Marketplace & Creator Payouts
## v24.0.0 - Complete Implementation

> Comprehensive guide to transform F0 into a marketplace platform with Stripe Connect (15% platform fee), creator payouts, reviews, and full marketing interface. Integrates with Sprint 21/22 and supports refund scenarios from v20.1.0.

---

## Table of Contents

1. [Prerequisites & Setup](#1-prerequisites--setup)
2. [Stripe Connect Integration](#2-stripe-connect-integration)
3. [Orders & Platform Fees](#3-orders--platform-fees)
4. [Payout Lifecycle](#4-payout-lifecycle)
5. [Creator Console](#5-creator-console)
6. [Reviews & Ratings](#6-reviews--ratings)
7. [Marketplace Frontend](#7-marketplace-frontend)
8. [Security & Testing](#8-security--testing)

---

## 1) Prerequisites & Setup

### Dependencies Check

**Required Sprints:**
- ✅ Sprint 21: Paywall, Referrals, Emails, Notifications
- ✅ Sprint 22: Observability, Status, Incidents, Costs
- ✅ v20.1.0: Refund flow with unified `paymentIntentId`

### Environment Variables

**File**: `.env.local`

```bash
# Existing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# New for Connect
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_connect_...
STRIPE_PLATFORM_ACCOUNT_ID=acct_...

# Platform Configuration
PLATFORM_FEE_PCT=15
MIN_PAYOUT_USD=50
PAYOUT_CUTOFF_DAY=28        # Monthly cutoff day
PAYOUT_HOLD_DAYS=7          # Hold period for refunds
PAYOUT_SCHEDULE=monthly     # monthly | weekly | biweekly

# URLs
NEXT_PUBLIC_APP_URL=https://f0.ai
STRIPE_CONNECT_RETURN_URL=https://f0.ai/creator/onboarding/return
STRIPE_CONNECT_REFRESH_URL=https://f0.ai/creator/onboarding/refresh
```

### Feature Flags

**Firestore**: `config/feature_flags`

```json
{
  "marketplace": {
    "enabled": true,
    "require_kyc": true,
    "min_price_usd": 5,
    "max_price_usd": 999
  },
  "payouts": {
    "enabled": true,
    "auto_approve": false,
    "require_tax_info": true
  },
  "creator_uploads": {
    "enabled": true,
    "require_review": true,
    "max_size_mb": 10
  },
  "reviews": {
    "enabled": true,
    "spam_guard": true,
    "image_moderation": true,
    "max_images": 3
  },
  "featured": {
    "enabled": true,
    "rotation_hours": 24
  }
}
```

---

## 2) Stripe Connect Integration

### 2.1 Creator Account Creation

**File**: `src/app/api/connect/account/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServerSession } from 'next-auth';
import { adminDb } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20'
});

/**
 * Create or retrieve Stripe Connect account for creator
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const uid = session.user.id;
  const { country, email } = await req.json();

  try {
    // Check if creator already has account
    const creatorRef = adminDb.collection('creators').doc(uid);
    const creatorDoc = await creatorRef.get();

    let accountId: string;

    if (creatorDoc.exists && creatorDoc.data()?.connectAccountId) {
      accountId = creatorDoc.data()!.connectAccountId;
    } else {
      // Create new Connect account (Standard)
      const account = await stripe.accounts.create({
        type: 'standard',
        country: country || 'US',
        email: email || session.user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        metadata: {
          uid,
          created_via: 'f0_marketplace'
        }
      });

      accountId = account.id;

      // Save to Firestore
      await creatorRef.set({
        connectAccountId: accountId,
        connectStatus: 'pending',
        country: country || 'US',
        email: email || session.user.email,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }, { merge: true });
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: process.env.STRIPE_CONNECT_REFRESH_URL!,
      return_url: process.env.STRIPE_CONNECT_RETURN_URL!,
      type: 'account_onboarding'
    });

    return NextResponse.json({
      accountId,
      onboardingUrl: accountLink.url
    });

  } catch (err: any) {
    console.error('Connect account creation failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create account' },
      { status: 500 }
    );
  }
}

/**
 * Get creator account status
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const creatorDoc = await adminDb.collection('creators').doc(session.user.id).get();

  if (!creatorDoc.exists || !creatorDoc.data()?.connectAccountId) {
    return NextResponse.json({ status: 'not_created' });
  }

  const accountId = creatorDoc.data()!.connectAccountId;

  try {
    const account = await stripe.accounts.retrieve(accountId);

    const status = account.charges_enabled && account.payouts_enabled
      ? 'verified'
      : account.requirements?.currently_due?.length
      ? 'requirements_due'
      : account.requirements?.disabled_reason
      ? 'restricted'
      : 'pending';

    // Update Firestore if status changed
    if (status !== creatorDoc.data()?.connectStatus) {
      await creatorDoc.ref.update({
        connectStatus: status,
        updatedAt: Date.now()
      });
    }

    return NextResponse.json({
      accountId,
      status,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      requirements: account.requirements
    });

  } catch (err: any) {
    console.error('Failed to retrieve account:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve account' },
      { status: 500 }
    );
  }
}
```

### 2.2 Creator Onboarding Page

**File**: `src/app/(creator)/onboarding/connect/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

export default function ConnectOnboardingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'not_created' | 'pending' | 'verified' | 'requirements_due'>('loading');
  const [accountId, setAccountId] = useState<string>('');
  const [onboardingUrl, setOnboardingUrl] = useState<string>('');
  const [requirements, setRequirements] = useState<string[]>([]);

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      const res = await fetch('/api/connect/account');
      const data = await res.json();

      if (data.status === 'not_created') {
        setStatus('not_created');
      } else {
        setStatus(data.status);
        setAccountId(data.accountId);
        setRequirements(data.requirements?.currently_due || []);
      }
    } catch (err) {
      console.error('Failed to check status:', err);
    }
  }

  async function createAccount() {
    setStatus('loading');
    try {
      const res = await fetch('/api/connect/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: 'US' })
      });

      const data = await res.json();

      if (data.onboardingUrl) {
        // Redirect to Stripe onboarding
        window.location.href = data.onboardingUrl;
      }
    } catch (err) {
      console.error('Failed to create account:', err);
      setStatus('not_created');
    }
  }

  async function continueOnboarding() {
    try {
      const res = await fetch('/api/connect/account', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const data = await res.json();
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    } catch (err) {
      console.error('Failed to get onboarding link:', err);
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (status === 'verified') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Account Verified!</h1>
          <p className="text-gray-600 mb-6">
            Your creator account is fully verified and ready to receive payouts.
          </p>
          <button
            onClick={() => router.push('/creator/dashboard')}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (status === 'requirements_due') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-center">Additional Information Required</h1>
          <p className="text-gray-600 mb-4 text-center">
            Please complete your account setup to start receiving payouts.
          </p>

          {requirements.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-yellow-800 mb-2">Required information:</p>
              <ul className="text-sm text-yellow-700 space-y-1">
                {requirements.map((req, i) => (
                  <li key={i}>• {req.replace(/_/g, ' ')}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={continueOnboarding}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
          >
            Complete Setup
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-4">Become a Creator</h1>
        <p className="text-gray-600 mb-6">
          Set up your payout account to start selling agents on the F0 marketplace.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            ✓ Earn 85% of sales revenue<br />
            ✓ Monthly automatic payouts<br />
            ✓ Full sales analytics<br />
            ✓ Tax reporting included
          </p>
        </div>

        <button
          onClick={createAccount}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Start Setup
        </button>

        <p className="text-xs text-gray-500 mt-4 text-center">
          Powered by Stripe Connect. Your financial data is secured by Stripe.
        </p>
      </div>
    </div>
  );
}
```

### 2.3 Connect Webhook Handler

**File**: `functions/src/connect/webhook.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import * as express from 'express';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20'
});

const app = express();
app.use(express.raw({ type: 'application/json' }));

app.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const db = admin.firestore();

  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(db, account);
        break;
      }

      case 'account.external_account.created':
      case 'account.external_account.updated': {
        const externalAccount = event.data.object as any;
        await handleExternalAccountChange(db, externalAccount);
        break;
      }

      case 'payout.created':
      case 'payout.paid':
      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout;
        await handlePayoutEvent(db, payout, event.type);
        break;
      }

      case 'transfer.created':
      case 'transfer.reversed': {
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferEvent(db, transfer, event.type);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });

  } catch (err: any) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

async function handleAccountUpdated(db: admin.firestore.Firestore, account: Stripe.Account) {
  const uid = account.metadata?.uid;
  if (!uid) return;

  const status = account.charges_enabled && account.payouts_enabled
    ? 'verified'
    : account.requirements?.disabled_reason
    ? 'restricted'
    : account.requirements?.currently_due?.length
    ? 'requirements_due'
    : 'pending';

  await db.collection('creators').doc(uid).set({
    connectAccountId: account.id,
    connectStatus: status,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    country: account.country,
    default_currency: account.default_currency,
    requirements: account.requirements,
    updatedAt: Date.now()
  }, { merge: true });

  // Send notification if verified
  if (status === 'verified') {
    await db.collection('notifications').doc(uid).collection('items').add({
      type: 'connect_verified',
      title: 'Creator Account Verified',
      message: 'Your payout account is now active. You can start selling!',
      read: false,
      createdAt: Date.now()
    });
  }
}

async function handleExternalAccountChange(
  db: admin.firestore.Firestore,
  externalAccount: any
) {
  const accountId = externalAccount.account;

  // Find creator by account ID
  const creatorsSnap = await db.collection('creators')
    .where('connectAccountId', '==', accountId)
    .limit(1)
    .get();

  if (creatorsSnap.empty) return;

  const creatorDoc = creatorsSnap.docs[0];
  await creatorDoc.ref.update({
    hasExternalAccount: true,
    externalAccountType: externalAccount.object, // bank_account or card
    externalAccountLast4: externalAccount.last4,
    updatedAt: Date.now()
  });
}

async function handlePayoutEvent(
  db: admin.firestore.Firestore,
  payout: Stripe.Payout,
  eventType: string
) {
  const accountId = payout.destination as string;

  // Find payout document
  const payoutSnap = await db.collection('payouts')
    .where('stripePayoutId', '==', payout.id)
    .limit(1)
    .get();

  if (payoutSnap.empty) return;

  const payoutDoc = payoutSnap.docs[0];
  const updates: any = { updatedAt: Date.now() };

  if (eventType === 'payout.paid') {
    updates.status = 'paid';
    updates.paidAt = Date.now();
  } else if (eventType === 'payout.failed') {
    updates.status = 'failed';
    updates.failureCode = payout.failure_code;
    updates.failureMessage = payout.failure_message;
    updates.attempts = admin.firestore.FieldValue.increment(1);
  }

  await payoutDoc.ref.update(updates);
}

async function handleTransferEvent(
  db: admin.firestore.Firestore,
  transfer: Stripe.Transfer,
  eventType: string
) {
  // Log transfer events for reconciliation
  await db.collection('transfer_events').add({
    transferId: transfer.id,
    destination: transfer.destination,
    amount: transfer.amount / 100,
    currency: transfer.currency,
    eventType,
    metadata: transfer.metadata,
    createdAt: Date.now()
  });
}

export const connectWebhook = functions.https.onRequest(app);
```

---

## 3) Orders & Platform Fees

### 3.1 Enhanced Checkout with Application Fee

**File**: `src/app/api/marketplace/checkout/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServerSession } from 'next-auth';
import { adminDb } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20'
});

const PLATFORM_FEE_PCT = parseFloat(process.env.PLATFORM_FEE_PCT || '15');

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { agentId } = await req.json();

  try {
    // Get agent details
    const agentDoc = await adminDb.collection('agents').doc(agentId).get();
    if (!agentDoc.exists) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const agent = agentDoc.data()!;
    const creatorUid = agent.creatorUid;

    // Get creator's Connect account
    const creatorDoc = await adminDb.collection('creators').doc(creatorUid).get();
    if (!creatorDoc.exists || !creatorDoc.data()?.connectAccountId) {
      return NextResponse.json(
        { error: 'Creator payout account not configured' },
        { status: 400 }
      );
    }

    const connectAccountId = creatorDoc.data()!.connectAccountId;
    const priceUSD = agent.priceUSD || 0;
    const amountCents = Math.round(priceUSD * 100);

    // Calculate platform fee (15%)
    const platformFeeCents = Math.floor(amountCents * (PLATFORM_FEE_PCT / 100));
    const netToCreatorCents = amountCents - platformFeeCents;

    // Create order
    const orderRef = await adminDb.collection('orders').add({
      buyerUid: session.user.id,
      creatorUid,
      agentId,
      agentName: agent.name,
      amountUSD: priceUSD,
      currency: 'USD',
      platformFeeUSD: platformFeeCents / 100,
      netToCreatorUSD: netToCreatorCents / 100,
      status: 'pending',
      paymentIntentId: null,
      createdAt: Date.now()
    });

    // Create Stripe checkout session with Connect
    const checkoutSession = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: agent.name,
            description: agent.description,
            images: agent.images || []
          },
          unit_amount: amountCents
        },
        quantity: 1
      }],
      mode: 'payment',
      payment_intent_data: {
        application_fee_amount: platformFeeCents,
        transfer_data: {
          destination: connectAccountId
        },
        metadata: {
          orderId: orderRef.id,
          agentId,
          buyerUid: session.user.id,
          creatorUid
        }
      },
      metadata: {
        orderId: orderRef.id,
        agentId,
        buyerUid: session.user.id,
        creatorUid
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/marketplace/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/agents/${agentId}`
    });

    // Update order with session ID
    await orderRef.update({
      stripeSessionId: checkoutSession.id,
      updatedAt: Date.now()
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url
    });

  } catch (err: any) {
    console.error('Checkout creation failed:', err);
    return NextResponse.json(
      { error: err.message || 'Checkout failed' },
      { status: 500 }
    );
  }
}
```

### 3.2 Order Webhook (Enhanced from v20.1.0)

**File**: `functions/src/marketplace/orderWebhook.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20'
});

export const orderWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const db = admin.firestore();

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;

      if (!orderId) {
        return res.status(400).send('No orderId in metadata');
      }

      const orderRef = db.collection('orders').doc(orderId);
      const orderSnap = await orderRef.get();

      if (!orderSnap.exists) {
        return res.status(404).send('Order not found');
      }

      // Validate payment intent exists
      if (!session.payment_intent) {
        console.error('[webhook] Missing payment_intent', { sessionId: session.id });
        return res.status(400).send('Missing payment_intent');
      }

      const order = orderSnap.data()!;

      // Update order status
      await orderRef.update({
        status: 'paid',
        paidAt: Date.now(),
        paymentIntentId: session.payment_intent,
        updatedAt: Date.now()
      });

      // Grant license
      await db.collection('licenses').add({
        uid: order.buyerUid,
        agentId: order.agentId,
        orderId,
        key: generateLicenseKey(),
        active: true,
        createdAt: Date.now()
      });

      // Update creator balance (pending)
      const creatorBalanceRef = db.collection('creator_balances').doc(order.creatorUid);
      await creatorBalanceRef.set({
        pending: admin.firestore.FieldValue.increment(order.netToCreatorUSD),
        updatedAt: Date.now()
      }, { merge: true });

      // Increment agent purchase count
      await db.collection('agents').doc(order.agentId).update({
        purchases: admin.firestore.FieldValue.increment(1),
        revenue: admin.firestore.FieldValue.increment(order.amountUSD)
      });

      // Send notifications
      await Promise.all([
        // Buyer notification
        db.collection('notifications').doc(order.buyerUid).collection('items').add({
          type: 'purchase_success',
          title: 'Purchase Successful',
          message: `You've successfully purchased ${order.agentName}`,
          read: false,
          createdAt: Date.now()
        }),
        // Creator notification
        db.collection('notifications').doc(order.creatorUid).collection('items').add({
          type: 'sale',
          title: 'New Sale!',
          message: `Someone purchased your agent: ${order.agentName}`,
          amount: order.netToCreatorUSD,
          read: false,
          createdAt: Date.now()
        })
      ]);
    }

    return res.json({ received: true });

  } catch (err: any) {
    console.error('Order webhook error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = 4;
  const segmentLength = 4;

  const parts: string[] = [];
  for (let i = 0; i < segments; i++) {
    let segment = '';
    for (let j = 0; j < segmentLength; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    parts.push(segment);
  }

  return `F0-${parts.join('-')}`;
}
```

---

## 4) Payout Lifecycle

### 4.1 Payout Scheduler (Cloud Function)

**File**: `functions/src/payouts/scheduler.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const MIN_PAYOUT_USD = parseFloat(process.env.MIN_PAYOUT_USD || '50');
const PAYOUT_HOLD_DAYS = parseInt(process.env.PAYOUT_HOLD_DAYS || '7');
const PAYOUT_CUTOFF_DAY = parseInt(process.env.PAYOUT_CUTOFF_DAY || '28');

/**
 * Monthly payout scheduler
 * Runs on the cutoff day (e.g., 28th) at 2 AM UTC
 */
export const payoutScheduler = functions.pubsub
  .schedule(`0 2 ${PAYOUT_CUTOFF_DAY} * *`)
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = admin.firestore();

    console.log('Starting monthly payout scheduling...');

    // Get all creators with available balance >= MIN_PAYOUT_USD
    const creatorsSnap = await db.collection('creator_balances')
      .where('available', '>=', MIN_PAYOUT_USD)
      .get();

    console.log(`Found ${creatorsSnap.size} creators eligible for payout`);

    const batch = db.batch();
    const now = Date.now();
    const holdWindowEnd = now - (PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);

    for (const creatorDoc of creatorsSnap.docs) {
      const creatorUid = creatorDoc.id;
      const balance = creatorDoc.data();

      // Calculate period (previous month)
      const periodEnd = now;
      const periodStart = new Date(new Date(periodEnd).setMonth(new Date(periodEnd).getMonth() - 1)).getTime();

      // Get orders in period (paid and not refunded)
      const ordersSnap = await db.collection('orders')
        .where('creatorUid', '==', creatorUid)
        .where('status', '==', 'paid')
        .where('paidAt', '>=', periodStart)
        .where('paidAt', '<=', holdWindowEnd) // Exclude hold window
        .get();

      if (ordersSnap.empty) continue;

      let grossAmount = 0;
      let platformFees = 0;

      for (const orderDoc of ordersSnap.docs) {
        const order = orderDoc.data();
        grossAmount += order.amountUSD;
        platformFees += order.platformFeeUSD;
      }

      const netAmount = grossAmount - platformFees;

      if (netAmount < MIN_PAYOUT_USD) continue;

      // Create payout document
      const payoutRef = db.collection('payouts').doc();
      batch.set(payoutRef, {
        creatorUid,
        periodStart,
        periodEnd,
        grossUSD: grossAmount,
        platformFeesUSD: platformFees,
        netUSD: netAmount,
        currency: 'USD',
        status: 'pending',
        orderCount: ordersSnap.size,
        attempts: 0,
        createdAt: now,
        updatedAt: now
      });

      // Update creator balance
      const balanceRef = db.collection('creator_balances').doc(creatorUid);
      batch.update(balanceRef, {
        available: admin.firestore.FieldValue.increment(-netAmount),
        pending: admin.firestore.FieldValue.increment(-netAmount),
        updatedAt: now
      });
    }

    await batch.commit();
    console.log('Payout scheduling completed');
  });
```

### 4.2 Payout Processor

**File**: `functions/src/payouts/processor.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20'
});

/**
 * Process pending payouts
 * Runs every hour to check and process approved payouts
 */
export const payoutProcessor = functions.pubsub
  .schedule('0 * * * *') // Every hour
  .onRun(async (context) => {
    const db = admin.firestore();

    // Get approved payouts waiting to be processed
    const payoutsSnap = await db.collection('payouts')
      .where('status', '==', 'approved')
      .limit(50)
      .get();

    console.log(`Processing ${payoutsSnap.size} approved payouts`);

    for (const payoutDoc of payoutsSnap.docs) {
      try {
        await processPayout(db, payoutDoc);
      } catch (err: any) {
        console.error(`Error processing payout ${payoutDoc.id}:`, err);
        await payoutDoc.ref.update({
          status: 'failed',
          failureMessage: err.message,
          attempts: admin.firestore.FieldValue.increment(1),
          updatedAt: Date.now()
        });
      }
    }
  });

async function processPayout(
  db: admin.firestore.Firestore,
  payoutDoc: admin.firestore.DocumentSnapshot
) {
  const payout = payoutDoc.data()!;
  const creatorUid = payout.creatorUid;

  // Get creator Connect account
  const creatorDoc = await db.collection('creators').doc(creatorUid).get();
  if (!creatorDoc.exists) {
    throw new Error('Creator not found');
  }

  const creator = creatorDoc.data()!;
  if (!creator.connectAccountId) {
    throw new Error('Creator has no Connect account');
  }

  if (creator.connectStatus !== 'verified') {
    throw new Error(`Creator account not verified: ${creator.connectStatus}`);
  }

  // Create Stripe payout
  const amountCents = Math.round(payout.netUSD * 100);

  const stripePayout = await stripe.payouts.create({
    amount: amountCents,
    currency: payout.currency.toLowerCase(),
    metadata: {
      f0_payout_id: payoutDoc.id,
      creator_uid: creatorUid,
      period_start: payout.periodStart.toString(),
      period_end: payout.periodEnd.toString()
    }
  }, {
    stripeAccount: creator.connectAccountId
  });

  // Update payout status
  await payoutDoc.ref.update({
    status: 'processing',
    stripePayoutId: stripePayout.id,
    processingAt: Date.now(),
    updatedAt: Date.now()
  });

  // Send notification
  await db.collection('notifications').doc(creatorUid).collection('items').add({
    type: 'payout_processing',
    title: 'Payout Initiated',
    message: `Your payout of $${payout.netUSD.toFixed(2)} is being processed`,
    amount: payout.netUSD,
    read: false,
    createdAt: Date.now()
  });

  console.log(`Payout ${payoutDoc.id} initiated: ${stripePayout.id}`);
}

/**
 * Retry failed payouts with exponential backoff
 */
export const retryFailedPayouts = functions.pubsub
  .schedule('0 */6 * * *') // Every 6 hours
  .onRun(async (context) => {
    const db = admin.firestore();
    const maxAttempts = 3;

    const failedSnap = await db.collection('payouts')
      .where('status', '==', 'failed')
      .where('attempts', '<', maxAttempts)
      .limit(20)
      .get();

    for (const payoutDoc of failedSnap.docs) {
      const payout = payoutDoc.data();
      const attempts = payout.attempts || 0;

      // Exponential backoff: 6h, 12h, 24h
      const backoffHours = Math.pow(2, attempts) * 6;
      const nextRetryTime = payout.updatedAt + (backoffHours * 60 * 60 * 1000);

      if (Date.now() >= nextRetryTime) {
        try {
          // Reset to approved for retry
          await payoutDoc.ref.update({
            status: 'approved',
            failureMessage: null,
            failureCode: null,
            updatedAt: Date.now()
          });
          console.log(`Retrying payout ${payoutDoc.id} (attempt ${attempts + 1})`);
        } catch (err) {
          console.error(`Failed to retry payout ${payoutDoc.id}:`, err);
        }
      }
    }
  });
```

### 4.3 Creator Payouts Dashboard

**File**: `src/app/(creator)/payouts/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Clock, CheckCircle, XCircle, TrendingUp } from 'lucide-react';

interface Balance {
  pending: number;
  available: number;
  hold: number;
}

interface Payout {
  id: string;
  periodStart: number;
  periodEnd: number;
  grossUSD: number;
  platformFeesUSD: number;
  netUSD: number;
  status: 'pending' | 'approved' | 'processing' | 'paid' | 'failed';
  orderCount: number;
  createdAt: number;
  paidAt?: number;
  failureMessage?: string;
}

export default function CreatorPayoutsPage() {
  const [balance, setBalance] = useState<Balance>({ pending: 0, available: 0, hold: 0 });
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [balanceRes, payoutsRes] = await Promise.all([
        fetch('/api/creator/balance'),
        fetch('/api/creator/payouts')
      ]);

      const balanceData = await balanceRes.json();
      const payoutsData = await payoutsRes.json();

      setBalance(balanceData.balance || { pending: 0, available: 0, hold: 0 });
      setPayouts(payoutsData.payouts || []);
    } catch (err) {
      console.error('Failed to fetch payout data:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  const totalEarnings = balance.pending + balance.available + balance.hold;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Payouts</h1>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <BalanceCard
          title="Total Earnings"
          amount={totalEarnings}
          icon={TrendingUp}
          color="blue"
        />
        <BalanceCard
          title="Available"
          amount={balance.available}
          icon={DollarSign}
          color="green"
        />
        <BalanceCard
          title="Pending"
          amount={balance.pending}
          icon={Clock}
          color="yellow"
        />
        <BalanceCard
          title="On Hold"
          amount={balance.hold}
          icon={Clock}
          color="gray"
          subtitle="7-day hold for refunds"
        />
      </div>

      {/* Payout History */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-bold">Payout History</h2>
        </div>

        <div className="divide-y">
          {payouts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No payouts yet. Sales will appear here after the monthly cutoff.
            </div>
          ) : (
            payouts.map((payout) => (
              <PayoutRow key={payout.id} payout={payout} />
            ))
          )}
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Payout Schedule:</strong> Monthly on the 28th<br />
          <strong>Minimum Payout:</strong> $50 USD<br />
          <strong>Hold Period:</strong> 7 days after sale (for refund protection)<br />
          <strong>Your Cut:</strong> 85% of sales revenue
        </p>
      </div>
    </div>
  );
}

function BalanceCard({
  title,
  amount,
  icon: Icon,
  color,
  subtitle
}: {
  title: string;
  amount: number;
  icon: any;
  color: string;
  subtitle?: string;
}) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    yellow: 'text-yellow-600 bg-yellow-50',
    gray: 'text-gray-600 bg-gray-50'
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-600 text-sm font-medium">{title}</span>
        <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-3xl font-bold mb-1">${amount.toFixed(2)}</div>
      {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
    </div>
  );
}

function PayoutRow({ payout }: { payout: Payout }) {
  const statusConfig = {
    pending: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Pending Approval' },
    approved: { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Approved' },
    processing: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Processing' },
    paid: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Paid' },
    failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Failed' }
  };

  const config = statusConfig[payout.status];
  const Icon = config.icon;

  return (
    <div className="p-6 flex items-center justify-between">
      <div>
        <div className="font-semibold mb-1">${payout.netUSD.toFixed(2)}</div>
        <div className="text-sm text-gray-500">
          {new Date(payout.periodStart).toLocaleDateString()} - {new Date(payout.periodEnd).toLocaleDateString()}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {payout.orderCount} {payout.orderCount === 1 ? 'sale' : 'sales'} • Platform fee: ${payout.platformFeesUSD.toFixed(2)}
        </div>
        {payout.failureMessage && (
          <div className="text-xs text-red-600 mt-2">
            {payout.failureMessage}
          </div>
        )}
      </div>
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${config.bg}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
        <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
      </div>
    </div>
  );
}
```

---

*Due to length constraints, I'll create this as a comprehensive guide and continue with the remaining sections in a follow-up response. Would you like me to continue with sections 5-8 (Creator Console, Reviews, Marketplace Frontend, Security & Testing)?*
