# 📈 F0 Growth Execution Guide — Phase 21

> **Operational guide for implementing Go-to-Market & Growth features. Covers onboarding, referrals, emails, help center, and notifications.**

**Version:** 1.0
**Phase:** Sprint 21 (v22.0.0)
**Last Updated:** 2025-01-30
**Owner:** _____________________

---

## 🧭 Overview

This guide covers the commercial and growth layer implementation:
- **Onboarding Wizard** - 4-step user activation flow
- **Pricing & Paywall** - Plan enforcement and upgrade prompts
- **Referral System** - $5 credit per successful signup
- **Transactional Emails** - 5 automated email templates
- **Notification Center** - In-app alerts and Slack integration
- **Help Center** - MDX-based documentation
- **Interactive Tours** - First-time user guidance

---

## 1️⃣ Onboarding Wizard Setup

### File Structure

```
src/app/(protected)/onboarding/
  ├── page.tsx                 # Main wizard container
  ├── steps/
  │   ├── Welcome.tsx          # Step 1: Welcome message
  │   ├── Profile.tsx          # Step 2: Profile setup
  │   ├── Workspace.tsx        # Step 3: Workspace config
  │   └── Finish.tsx           # Step 4: Activation
  └── components/
      └── Stepper.tsx          # Progress indicator
```

### Firestore Structure

```javascript
users/{uid}/onboarding
{
  currentStep: number,          // 1-4
  completed: boolean,
  steps: {
    welcome: { completed: boolean, timestamp: number },
    profile: { completed: boolean, timestamp: number },
    workspace: { completed: boolean, timestamp: number },
    finish: { completed: boolean, timestamp: number }
  },
  startedAt: timestamp,
  completedAt: timestamp,
  skipped: boolean
}
```

### Implementation Steps

#### Step 1: Install Dependencies

```bash
# Shadcn UI components
npx shadcn add progress form stepper button input

# Additional libraries
npm install react-hook-form zod @hookform/resolvers
```

#### Step 2: Create Onboarding Page

```typescript
// src/app/(protected)/onboarding/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import Welcome from './steps/Welcome';
import Profile from './steps/Profile';
import Workspace from './steps/Workspace';
import Finish from './steps/Finish';

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const router = useRouter();

  const steps = [
    { id: 1, component: Welcome },
    { id: 2, component: Profile },
    { id: 3, component: Workspace },
    { id: 4, component: Finish }
  ];

  const progress = (step / steps.length) * 100;

  async function handleNext() {
    if (step < steps.length) {
      setStep(step + 1);
      await saveProgress(step + 1);
    } else {
      await completeOnboarding();
      router.push('/dashboard');
    }
  }

  function handleBack() {
    if (step > 1) {
      setStep(step - 1);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <Progress value={progress} className="mb-8" />

      <div className="mb-4 text-sm text-gray-500">
        Step {step} of {steps.length}
      </div>

      {steps.map((s) => (
        s.id === step && (
          <s.component
            key={s.id}
            onNext={handleNext}
            onBack={handleBack}
            isFirst={step === 1}
            isLast={step === steps.length}
          />
        )
      ))}
    </div>
  );
}
```

#### Step 3: Save Progress to Firestore

```typescript
// src/lib/onboarding.ts
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export async function saveOnboardingProgress(
  uid: string,
  step: number
) {
  await setDoc(
    doc(db, 'users', uid, 'onboarding', 'current'),
    {
      currentStep: step,
      [`steps.step${step}.completed`]: true,
      [`steps.step${step}.timestamp`]: Date.now(),
      updatedAt: Date.now()
    },
    { merge: true }
  );
}

export async function completeOnboarding(uid: string) {
  await setDoc(
    doc(db, 'users', uid, 'onboarding', 'current'),
    {
      completed: true,
      completedAt: Date.now()
    },
    { merge: true }
  );
}

export async function getOnboardingStatus(uid: string) {
  const docRef = doc(db, 'users', uid, 'onboarding', 'current');
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? snapshot.data() : null;
}
```

#### Step 4: Redirect Logic

```typescript
// src/middleware.ts (add to existing middleware)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip onboarding check for public routes
  if (pathname.startsWith('/api') || pathname.startsWith('/auth')) {
    return NextResponse.next();
  }

  // Get user session
  const session = await getSession(req);
  if (!session) {
    return NextResponse.redirect(new URL('/auth/signin', req.url));
  }

  // Check onboarding status
  const onboarding = await getOnboardingStatus(session.uid);

  if (!onboarding?.completed && pathname !== '/onboarding') {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  return NextResponse.next();
}
```

### Commands

```bash
# Test onboarding flow
npm run dev
# Visit: http://localhost:3000/onboarding

# Deploy
npm run build && firebase deploy --only hosting
```

---

## 2️⃣ Pricing & Paywall System

### File Structure

```
src/app/(public)/pricing/
  └── page.tsx                 # Pricing plans page

src/components/
  └── EntitlementGate.tsx      # Paywall component

src/middleware/
  └── entitlements.ts          # Route protection

src/lib/
  └── entitlements.ts          # Helper functions
```

### Pricing Page

```typescript
// src/app/(public)/pricing/page.tsx
'use client';

import { CheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const plans = [
  {
    name: 'Free',
    price: 0,
    interval: 'forever',
    features: [
      '10 agent calls per day',
      '1 workspace',
      '100MB storage',
      'Community support'
    ],
    cta: 'Current Plan',
    priceId: null
  },
  {
    name: 'Daily',
    price: 1,
    interval: 'day',
    features: [
      '100 agent calls per day',
      '5 workspaces',
      '1GB storage',
      'Email support',
      'Priority queue'
    ],
    cta: 'Start Daily Plan',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_DAILY,
    popular: true
  },
  {
    name: 'Monthly',
    price: 20,
    interval: 'month',
    features: [
      '1000 agent calls per day',
      'Unlimited workspaces',
      '10GB storage',
      'Priority support (Email + Slack)',
      'Advanced analytics',
      'Custom integrations'
    ],
    cta: 'Start Monthly Plan',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY
  }
];

export default function PricingPage() {
  async function handleCheckout(priceId: string) {
    const res = await fetch('/api/subscriptions/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId })
    });

    const { url } = await res.json();
    window.location.href = url;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-center mb-4">
        Simple, Transparent Pricing
      </h1>
      <p className="text-center text-gray-600 mb-12">
        Choose the plan that fits your needs. Upgrade or downgrade anytime.
      </p>

      <div className="grid md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`border rounded-lg p-8 ${
              plan.popular ? 'border-blue-500 shadow-lg' : 'border-gray-200'
            }`}
          >
            {plan.popular && (
              <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
                Most Popular
              </span>
            )}

            <h2 className="text-2xl font-bold mt-4">{plan.name}</h2>

            <div className="mt-4 mb-6">
              <span className="text-4xl font-bold">${plan.price}</span>
              <span className="text-gray-600">/{plan.interval}</span>
            </div>

            <ul className="space-y-3 mb-8">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start">
                  <CheckIcon className="w-5 h-5 text-green-500 mr-2 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              onClick={() => plan.priceId && handleCheckout(plan.priceId)}
              className="w-full"
              variant={plan.popular ? 'default' : 'outline'}
              disabled={!plan.priceId}
            >
              {plan.cta}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Entitlement Gate Component

```typescript
// src/components/EntitlementGate.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { checkEntitlement } from '@/lib/entitlements';

interface EntitlementGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function EntitlementGate({
  feature,
  children,
  fallback
}: EntitlementGateProps) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    async function check() {
      const hasAccess = await checkEntitlement(feature);
      setAllowed(hasAccess);

      if (!hasAccess) {
        router.push('/pricing');
      }
    }
    check();
  }, [feature]);

  if (allowed === null) {
    return <div>Loading...</div>;
  }

  if (!allowed) {
    return fallback || (
      <div className="text-center p-8">
        <p>This feature requires a paid plan.</p>
        <button onClick={() => router.push('/pricing')}>
          Upgrade Now
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
```

### Entitlements Helper

```typescript
// src/lib/entitlements.ts
import { db, auth } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function checkEntitlement(feature: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  // Get user subscription
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const userData = userDoc.data();
  const plan = userData?.subscription?.plan || 'free';

  // Feature entitlements by plan
  const entitlements = {
    free: ['basic_agents', 'single_workspace'],
    daily: ['basic_agents', 'multiple_workspaces', 'priority_queue'],
    monthly: ['basic_agents', 'multiple_workspaces', 'priority_queue', 'custom_integrations', 'advanced_analytics']
  };

  return entitlements[plan]?.includes(feature) || false;
}
```

### Middleware Protection

```typescript
// src/middleware/entitlements.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = {
  '/admin': ['admin'],
  '/workspaces/create': ['multiple_workspaces'],
  '/analytics/advanced': ['advanced_analytics']
};

export function entitlementsMiddleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  for (const [route, features] of Object.entries(protectedRoutes)) {
    if (pathname.startsWith(route)) {
      // Check user entitlements (simplified - use session in production)
      const hasAccess = checkUserEntitlements(features);

      if (!hasAccess) {
        return NextResponse.redirect(new URL('/pricing', req.url));
      }
    }
  }

  return NextResponse.next();
}
```

---

## 3️⃣ Referral System

### API Routes

```typescript
// src/app/api/referrals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifySessionCookie } from '@/lib/auth-helpers';

/**
 * POST /api/referrals/generate
 * Generate new referral code
 */
export async function POST(req: NextRequest) {
  try {
    const session = await verifySessionCookie(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uid = session.uid;
    const code = generateReferralCode(uid);

    await adminDb.collection('referrals').doc(code).set({
      ownerUid: uid,
      code,
      uses: 0,
      maxUses: 100,
      rewardAmount: 500, // $5 in cents
      rewardType: 'credits',
      createdAt: Date.now(),
      active: true
    });

    return NextResponse.json({ code, link: `https://yourapp.web.app/auth/signup?ref=${code}` });
  } catch (error: any) {
    console.error('[POST /api/referrals] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function generateReferralCode(uid: string): string {
  const prefix = 'F0';
  const userPart = uid.substring(0, 6).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${userPart}-${random}`;
}
```

```typescript
// src/app/api/referrals/apply/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

/**
 * POST /api/referrals/apply
 * Apply referral code on signup
 */
export async function POST(req: NextRequest) {
  try {
    const { code, newUserUid } = await req.json();

    // Get referral
    const refDoc = await adminDb.collection('referrals').doc(code).get();
    if (!refDoc.exists) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 404 });
    }

    const referral = refDoc.data() as any;

    // Check limits
    if (referral.uses >= referral.maxUses) {
      return NextResponse.json({ error: 'Code limit reached' }, { status: 400 });
    }

    // Transaction: Increment uses + Add credit
    await adminDb.runTransaction(async (transaction) => {
      // Increment referral uses
      transaction.update(refDoc.ref, {
        uses: referral.uses + 1,
        lastUsedAt: Date.now()
      });

      // Add credit to referrer
      const creditRef = adminDb.collection('referral_credits').doc(referral.ownerUid);
      const creditDoc = await transaction.get(creditRef);

      if (creditDoc.exists) {
        transaction.update(creditRef, {
          balance: (creditDoc.data()?.balance || 0) + referral.rewardAmount,
          updatedAt: Date.now()
        });
      } else {
        transaction.set(creditRef, {
          balance: referral.rewardAmount,
          history: [],
          updatedAt: Date.now()
        });
      }

      // Add history entry
      transaction.update(creditRef, {
        history: adminDb.FieldValue.arrayUnion({
          amount: referral.rewardAmount,
          type: 'earned',
          referralCode: code,
          newUserUid,
          timestamp: Date.now(),
          description: `Referral signup: ${code}`
        })
      });
    });

    return NextResponse.json({ success: true, reward: referral.rewardAmount });
  } catch (error: any) {
    console.error('[POST /api/referrals/apply] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Firestore Structure

```javascript
referrals/{code}
{
  ownerUid: string,
  code: string,              // "F0-ABC123-XY45"
  uses: number,              // Current usage count
  maxUses: number,           // 100
  rewardAmount: number,      // 500 cents ($5)
  rewardType: "credits",
  createdAt: timestamp,
  lastUsedAt: timestamp,
  active: boolean
}

referral_credits/{uid}
{
  balance: number,           // in cents
  updatedAt: timestamp,
  history: [
    {
      amount: number,
      type: "earned" | "spent",
      referralCode: string,
      timestamp: number,
      description: string
    }
  ]
}
```

### Usage in Signup Flow

```typescript
// src/app/auth/signup/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function SignupPage() {
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref');

  useEffect(() => {
    if (refCode) {
      // Store referral code in localStorage
      localStorage.setItem('pendingReferral', refCode);
    }
  }, [refCode]);

  async function handleSignup(email: string, password: string) {
    // Create user account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Apply referral if exists
    const pendingRef = localStorage.getItem('pendingReferral');
    if (pendingRef) {
      await fetch('/api/referrals/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: pendingRef,
          newUserUid: userCredential.user.uid
        })
      });
      localStorage.removeItem('pendingReferral');
    }

    // Continue with onboarding
    router.push('/onboarding');
  }

  return (
    // ... signup form
  );
}
```

---

## 4️⃣ Transactional Emails

### Cloud Function

```typescript
// functions/src/email/txEmail.ts
import * as functions from 'firebase-functions';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(functions.config().sendgrid.api_key);

interface EmailPayload {
  to: string;
  template: 'welcome' | 'subscription_activated' | 'payment_failed' | 'referral_reward' | 'onboarding_completed';
  data: Record<string, any>;
}

export const txEmail = functions.https.onCall(async (payload: EmailPayload, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const templates = {
    welcome: {
      subject: 'Welcome to F0! 🚀',
      html: getWelcomeTemplate(payload.data)
    },
    subscription_activated: {
      subject: 'Your F0 subscription is active ✅',
      html: getSubscriptionActivatedTemplate(payload.data)
    },
    payment_failed: {
      subject: 'Payment issue with your F0 subscription ⚠️',
      html: getPaymentFailedTemplate(payload.data)
    },
    referral_reward: {
      subject: 'You earned $5 credit! 🎁',
      html: getReferralRewardTemplate(payload.data)
    },
    onboarding_completed: {
      subject: 'You're all set! Start building with F0',
      html: getOnboardingCompletedTemplate(payload.data)
    }
  };

  const template = templates[payload.template];
  if (!template) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid template');
  }

  await sgMail.send({
    to: payload.to,
    from: functions.config().sendgrid.from_email,
    subject: template.subject,
    html: template.html
  });

  // Log to Firestore
  await admin.firestore().collection('email_logs').add({
    to: payload.to,
    template: payload.template,
    sentAt: Date.now(),
    uid: context.auth.uid
  });

  return { success: true };
});

function getWelcomeTemplate(data: any): string {
  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif;">
        <h1>Welcome to F0, ${data.name}! 🚀</h1>
        <p>We're excited to have you on board.</p>

        <h2>Get Started:</h2>
        <ol>
          <li>Complete your onboarding</li>
          <li>Set up your first agent</li>
          <li>Invite your team</li>
        </ol>

        <p><strong>Your referral code:</strong> ${data.referralCode}</p>
        <p>Share it with friends and earn $5 per signup!</p>

        <a href="https://yourapp.web.app/onboarding" style="background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Get Started
        </a>

        <p style="margin-top: 32px; color: #666;">
          Need help? Visit our <a href="https://yourapp.web.app/help">Help Center</a>
        </p>
      </body>
    </html>
  `;
}

// ... other template functions
```

### Provider Setup

```bash
# Set SendGrid API key
firebase functions:config:set sendgrid.api_key="YOUR_SENDGRID_API_KEY"
firebase functions:config:set sendgrid.from_email="noreply@f0.com"

# Deploy function
firebase deploy --only functions:txEmail
```

### Trigger Email from Code

```typescript
// Example: Send welcome email after signup
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const sendEmail = httpsCallable(functions, 'txEmail');

async function sendWelcomeEmail(user: User, referralCode: string) {
  await sendEmail({
    to: user.email,
    template: 'welcome',
    data: {
      name: user.displayName,
      referralCode
    }
  });
}
```

---

## 5️⃣ Notification Center

### API Routes

```typescript
// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifySessionCookie } from '@/lib/auth-helpers';

/**
 * GET /api/notifications
 * Get user notifications
 */
export async function GET(req: NextRequest) {
  try {
    const session = await verifySessionCookie(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snapshot = await adminDb
      .collection('notifications')
      .doc(session.uid)
      .collection('inbox')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ notifications });
  } catch (error: any) {
    console.error('[GET /api/notifications] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications/:id
 * Mark as read
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await verifySessionCookie(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notificationId } = await req.json();

    await adminDb
      .collection('notifications')
      .doc(session.uid)
      .collection('inbox')
      .doc(notificationId)
      .update({ seen: true, seenAt: Date.now() });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PATCH /api/notifications] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Notification Page

```typescript
// src/app/(protected)/notifications/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    const res = await fetch('/api/notifications');
    const data = await res.json();
    setNotifications(data.notifications);
  }

  async function markAsRead(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id })
    });
    fetchNotifications();
  }

  const filteredNotifications = notifications.filter((n: any) => {
    if (filter === 'all') return true;
    return n.type === filter;
  });

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Notifications</h1>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No notifications
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotifications.map((notification: any) => (
                <div
                  key={notification.id}
                  className={`border rounded-lg p-4 ${
                    notification.seen ? 'bg-white' : 'bg-blue-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{notification.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.body}
                      </p>
                      <span className="text-xs text-gray-400 mt-2 block">
                        {new Date(notification.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {!notification.seen && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Slack Integration

```typescript
// functions/src/notifications/slack.ts
import * as functions from 'firebase-functions';
import fetch from 'node-fetch';

export async function sendSlackNotification(message: string, channel: string = '#ops-alerts') {
  const webhookUrl = functions.config().slack.webhook_url;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel,
      text: message,
      username: 'F0 Bot',
      icon_emoji: ':robot_face:'
    })
  });
}

// Usage in webhook
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const event = req.body;

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;

    // Send Slack alert
    await sendSlackNotification(
      `🚨 Payment failed for customer ${invoice.customer}\nAmount: $${invoice.amount_due / 100}\nAttempt: ${invoice.attempt_count}`,
      '#billing-alerts'
    );

    // Send in-app notification
    await admin.firestore()
      .collection('notifications')
      .doc(invoice.metadata.uid)
      .collection('inbox')
      .add({
        type: 'billing',
        title: 'Payment Failed',
        body: 'Your payment could not be processed. Please update your payment method.',
        seen: false,
        createdAt: Date.now(),
        link: '/billing'
      });
  }

  res.sendStatus(200);
});
```

---

## 6️⃣ Help Center (MDX Guides)

### File Structure

```
src/app/help/
  ├── (docs)/
  │   ├── [slug]/
  │   │   └── page.mdx        # Dynamic MDX pages
  │   └── layout.tsx
  └── page.tsx                # Help center home

content/guides/
  ├── first-agent-setup.mdx
  ├── billing-faq.mdx
  ├── referral-program.mdx
  ├── desktop-setup.mdx
  └── troubleshooting.mdx
```

### Sample MDX Guide

```markdown
---
title: First Agent Setup
description: Learn how to set up your first F0 AI agent in 5 minutes
category: Getting Started
---

# Setting Up Your First Agent

Learn how to create and configure your first F0 AI agent in 5 minutes.

## Prerequisites

- F0 account (Free or paid)
- VS Code or Cursor installed
- Basic understanding of AI prompts

## Step 1: Create Workspace

Navigate to your dashboard and click **Create Workspace**.

```bash
# Or use CLI
f0 workspace create my-first-workspace
```

## Step 2: Configure Agent

1. Open workspace settings
2. Select AI model (Claude Sonnet 4.5 recommended)
3. Set rate limits based on your plan

## Step 3: Run First Task

Try a simple task to test your agent:

```bash
f0 agent run "Explain what this codebase does" --workspace my-first-workspace
```

## Next Steps

- [Integrate with VS Code](/help/vscode-integration)
- [Set up custom prompts](/help/custom-prompts)
- [Monitor usage](/help/usage-analytics)

## Troubleshooting

### Agent not responding?

Check your subscription status and rate limits.

### Need more help?

Contact support@f0.com or join our Discord community.
```

### MDX Configuration

```typescript
// next.config.mjs
import createMDX from '@next/mdx';

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [],
    rehypePlugins: []
  }
});

export default withMDX({
  pageExtensions: ['ts', 'tsx', 'mdx'],
  experimental: {
    mdxRs: true
  }
});
```

### Install Dependencies

```bash
npm install @next/mdx @mdx-js/loader @mdx-js/react
npm install rehype-highlight remark-gfm
```

---

## 7️⃣ Interactive Tours

### Implementation

```bash
npm install react-joyride
```

```typescript
// src/app/(protected)/tours/page.tsx
'use client';

import Joyride, { Step } from 'react-joyride';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const steps: Step[] = [
  {
    target: '.dashboard',
    content: 'Welcome to your F0 dashboard! This is your command center.',
    placement: 'center'
  },
  {
    target: '.agent-create-button',
    content: 'Click here to create your first AI agent.',
    placement: 'bottom'
  },
  {
    target: '.workspace-switcher',
    content: 'Switch between workspaces to organize your projects.',
    placement: 'right'
  },
  {
    target: '.billing-link',
    content: 'Manage your subscription and view invoices here.',
    placement: 'left'
  },
  {
    target: '.notification-bell',
    content: 'Stay updated with real-time notifications.',
    placement: 'bottom'
  },
  {
    target: '.help-icon',
    content: 'Need help? Our Help Center has guides and tutorials.',
    placement: 'left'
  }
];

export default function ToursPage() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    // Check if user has completed tour
    checkTourStatus();
  }, []);

  async function checkTourStatus() {
    const user = auth.currentUser;
    if (!user) return;

    const tourDoc = await getDoc(doc(db, 'users', user.uid, 'tours', 'dashboard'));
    const completed = tourDoc.data()?.completed;

    if (!completed) {
      setRun(true);
    }
  }

  async function handleTourComplete() {
    const user = auth.currentUser;
    if (!user) return;

    await setDoc(doc(db, 'users', user.uid, 'tours', 'dashboard'), {
      completed: true,
      completedAt: Date.now()
    });
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      callback={(data) => {
        if (data.status === 'finished' || data.status === 'skipped') {
          handleTourComplete();
          setRun(false);
        }
      }}
      styles={{
        options: {
          primaryColor: '#0070f3',
          zIndex: 10000
        }
      }}
    />
  );
}
```

---

## ✅ Feature Flags

```json
{
  "paywall": {
    "enabled": true,
    "redirect_to": "/pricing"
  },
  "referrals": {
    "enabled": true,
    "reward_per_signup": 500,
    "max_uses_per_code": 100
  },
  "emails": {
    "tx": {
      "enabled": true,
      "provider": "sendgrid"
    }
  },
  "notifications": {
    "enabled": true,
    "slack_integration": true
  },
  "tours": {
    "enabled": true,
    "show_on_first_login": true
  }
}
```

---

## 🧪 Smoke Tests (8 Tests)

### Test 1: Complete Onboarding Flow

```bash
# Manual test
1. Create new account
2. Verify redirect to /onboarding
3. Complete all 4 steps
4. Verify redirect to /dashboard
5. Check Firestore: users/{uid}/onboarding/current.completed = true
```

**✅ Pass Criteria:**
- All steps complete without errors
- Progress saved to Firestore
- Final redirect works

---

### Test 2: Paywall Enforcement

```bash
# Manual test
1. Login with Free tier account
2. Try accessing /analytics/advanced
3. Verify redirect to /pricing
4. Upgrade to Monthly plan
5. Try accessing /analytics/advanced again
6. Verify access granted
```

**✅ Pass Criteria:**
- Free users blocked
- Redirect to pricing
- Paid users allowed

---

### Test 3: Referral Code Generation

```bash
# API test
curl -X POST https://yourapp.web.app/api/referrals/generate \
  -H "Authorization: Bearer USER_TOKEN"

# Expected response:
# {
#   "code": "F0-ABC123-XY45",
#   "link": "https://yourapp.web.app/auth/signup?ref=F0-ABC123-XY45"
# }
```

**✅ Pass Criteria:**
- Code generated successfully
- Stored in Firestore
- Link format correct

---

### Test 4: Referral Credit Award

```bash
# Test flow:
1. User A generates referral code
2. User B signs up with referral link
3. Verify User A's referral_credits balance increased by 500
4. Check history entry created
```

**✅ Pass Criteria:**
- Credit added correctly ($5 = 500 cents)
- History logged
- Referral uses incremented

---

### Test 5: Welcome Email Delivery

```bash
# Test after signup
1. Create new account
2. Wait 30 seconds
3. Check email inbox
4. Verify "Welcome to F0!" email received
5. Check SendGrid dashboard for delivery confirmation
```

**✅ Pass Criteria:**
- Email delivers within 2 minutes
- All links work
- Content renders correctly

---

### Test 6: Payment Failed Notification

```bash
# Trigger in Stripe test mode
stripe trigger invoice.payment_failed

# Expected:
1. Email sent to customer
2. In-app notification created
3. Slack alert sent to #billing-alerts
```

**✅ Pass Criteria:**
- All 3 channels triggered
- Email delivered
- Notification appears in inbox

---

### Test 7: Notification Center

```bash
# Manual test
1. Login and visit /notifications
2. Verify notifications listed
3. Click "Mark as read" on notification
4. Verify seen status updates
5. Refresh page, verify status persists
```

**✅ Pass Criteria:**
- Notifications load
- Mark as read works
- Status persists

---

### Test 8: Help Center Guide

```bash
# Manual test
1. Visit /help/first-agent-setup
2. Verify MDX content renders
3. Check code blocks have syntax highlighting
4. Test internal links work
5. Verify table of contents functional
```

**✅ Pass Criteria:**
- MDX renders correctly
- Code blocks highlighted
- Links work
- TOC functional

---

## ⚙️ Pre-Flight Checklist

| # | Step | Status |
|---|------|--------|
| 1 | SendGrid enabled with API key in `.env` | ⬜ |
| 2 | Feature flags updated in Firestore `config/feature_flags` | ⬜ |
| 3 | `txEmail` function deployed and tested | ⬜ |
| 4 | `/onboarding` and `/pricing` pages working | ⬜ |
| 5 | `/api/referrals` connected to Firestore | ⬜ |
| 6 | `/help` with MDX guides built successfully | ⬜ |
| 7 | `/notifications` integrated with Slack | ⬜ |
| 8 | Firestore rules updated for notifications collection | ⬜ |
| 9 | Stripe webhook configured for billing events | ⬜ |
| 10 | Tours tested on first login flow | ⬜ |

---

## 🚀 Deployment Steps

### Step 1: Deploy Email Function

```bash
cd functions
npm install

# Deploy transactional email function
firebase deploy --only functions:txEmail

# Verify logs
firebase functions:log --only txEmail --lines 20
```

### Step 2: Deploy Firestore Rules

```bash
# Deploy updated rules (notifications, referrals, onboarding)
firebase deploy --only firestore:rules

# Verify in Console
firebase firestore:get notifications/test-uid
```

### Step 3: Deploy Hosting

```bash
# Build and deploy
npm run build
firebase deploy --only hosting

# Test routes
curl https://yourapp.web.app/pricing
curl https://yourapp.web.app/help/first-agent-setup
```

### Step 4: Configure SendGrid

```bash
# Set SendGrid API key
firebase functions:config:set sendgrid.api_key="YOUR_API_KEY"
firebase functions:config:set sendgrid.from_email="noreply@f0.com"

# Redeploy functions
firebase deploy --only functions:txEmail
```

### Step 5: Verify Feature Flags

```bash
# Check flags in Firestore Console
firebase firestore:get config/feature_flags

# Or via Firebase Admin SDK
node scripts/verify-feature-flags.js
```

---

## 🧯 Emergency Switches

| Issue | Flag | Action |
|-------|------|--------|
| Email sending issues | `emails.tx.enabled = false` | Queue emails for retry |
| Notification spam | `notifications.enabled = false` | Temporarily disable |
| Referral abuse | `referrals.enabled = false` | Review and re-enable |
| Onboarding bugs | `onboarding.required = false` | Allow skip |
| Paywall blocking users | `paywall.enabled = false` | Grant temporary access |
| Tours causing freezes | `tours.enabled = false` | Disable until fixed |

**Access:** `/admin/config/feature-flags`

---

## 📊 Success Metrics

### Week 1 Post-Launch

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Onboarding Completion | ≥ 60% | ___ | ⬜ |
| Free → Paid Conversion | ≥ 25% | ___ | ⬜ |
| Referral Usage Rate | ≥ 10% | ___ | ⬜ |
| Email Delivery Rate | ≥ 98% | ___ | ⬜ |
| Avg Onboarding Time | ≤ 3 min | ___ | ⬜ |
| Help Article Views | ≥ 2 per user | ___ | ⬜ |
| Notification Open Rate | ≥ 50% | ___ | ⬜ |
| Tour Completion Rate | ≥ 40% | ___ | ⬜ |

### Month 1 Post-Launch

| Metric | Target |
|--------|--------|
| MRR (Monthly Recurring Revenue) | $5,000+ |
| Onboarding → First Purchase Time | < 24 hours |
| Referral-driven signups | ≥ 15% |
| Email engagement (open rate) | ≥ 35% |
| Support tickets (onboarding) | < 5% of signups |

---

## 📞 Support & Troubleshooting

### Issue: Emails Not Sending

**Symptoms:** Users not receiving welcome emails

**Diagnosis:**
```bash
# Check SendGrid dashboard
# Check function logs
firebase functions:log --only txEmail --lines 50
```

**Fix:**
1. Verify SendGrid API key is correct
2. Check domain verification in SendGrid
3. Review rate limits
4. Check spam folder

---

### Issue: Referral Code Not Working

**Symptoms:** Code not applying credit

**Diagnosis:**
```bash
# Check referral document
firebase firestore:get referrals/{code}

# Check credit document
firebase firestore:get referral_credits/{uid}
```

**Fix:**
1. Verify code exists and active
2. Check uses < maxUses
3. Ensure transaction completed
4. Manually apply credit if needed

---

### Issue: Onboarding Loop

**Symptoms:** Users stuck in onboarding redirect

**Diagnosis:**
```bash
# Check onboarding status
firebase firestore:get users/{uid}/onboarding/current
```

**Fix:**
1. Manually set `completed = true`
2. Clear middleware cache
3. Check middleware logic

---

**Guide Version:** 1.0
**Last Updated:** 2025-01-30
**Next Review:** After Sprint 21 completion

🚀 **Ready to Grow F0!**
