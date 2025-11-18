/**
 * Admin API - AI Governance Configuration
 * GET: Retrieve current config
 * POST: Update config
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAdminFromHeaders } from '@/lib/admin-auth';

/**
 * GET /api/admin/ai-evals/config
 * Returns current AI Governance configuration
 */
export async function GET(req: NextRequest) {
  try {
    // Verify admin access
    await requireAdminFromHeaders(req);

    const db = getFirestore();
    const snap = await db.collection('config').doc('ai_governance').get();

    if (!snap.exists) {
      // Return default config
      return NextResponse.json({
        enabled: process.env.AI_EVAL_ENABLED === 'true',
        sampleRate: Number(process.env.AI_EVAL_SAMPLE_RATE ?? 1),
        thresholds: {
          toxicity: Number(process.env.AI_TOXICITY_THRESHOLD ?? 50),
          bias: Number(process.env.AI_BIAS_THRESHOLD ?? 30),
        },
        alertFlagRatePct: 10,
      });
    }

    return NextResponse.json(snap.data());
  } catch (error: any) {
    console.error('Error fetching AI governance config:', error);

    if (error.message?.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/ai-evals/config
 * Updates AI Governance configuration
 *
 * Body:
 * {
 *   enabled: boolean,
 *   sampleRate: number (0-1),
 *   thresholds: { toxicity: number, bias: number },
 *   alertFlagRatePct: number
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin access
    await requireAdminFromHeaders(req);

    const body = await req.json();

    // Validate input
    if (typeof body.enabled !== 'undefined' && typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled must be a boolean' },
        { status: 400 }
      );
    }

    if (typeof body.sampleRate !== 'undefined') {
      const rate = Number(body.sampleRate);
      if (isNaN(rate) || rate < 0 || rate > 1) {
        return NextResponse.json(
          { error: 'sampleRate must be between 0 and 1' },
          { status: 400 }
        );
      }
    }

    if (body.thresholds) {
      if (
        typeof body.thresholds.toxicity !== 'undefined' &&
        (isNaN(Number(body.thresholds.toxicity)) || Number(body.thresholds.toxicity) < 0)
      ) {
        return NextResponse.json(
          { error: 'thresholds.toxicity must be a positive number' },
          { status: 400 }
        );
      }

      if (
        typeof body.thresholds.bias !== 'undefined' &&
        (isNaN(Number(body.thresholds.bias)) || Number(body.thresholds.bias) < 0)
      ) {
        return NextResponse.json(
          { error: 'thresholds.bias must be a positive number' },
          { status: 400 }
        );
      }
    }

    if (
      typeof body.alertFlagRatePct !== 'undefined' &&
      (isNaN(Number(body.alertFlagRatePct)) || Number(body.alertFlagRatePct) < 0)
    ) {
      return NextResponse.json(
        { error: 'alertFlagRatePct must be a positive number' },
        { status: 400 }
      );
    }

    // Save to Firestore
    const db = getFirestore();
    await db.collection('config').doc('ai_governance').set(body, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error updating AI governance config:', error);

    if (error.message?.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
