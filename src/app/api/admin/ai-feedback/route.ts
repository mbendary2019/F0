/**
 * AI Feedback API
 * Collect user feedback on LLM responses (👍/👎)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { getFirestore } from 'firebase-admin/firestore';

const FeedbackSchema = z.object({
  vote: z.enum(['up', 'down']),
  question: z.string().min(1),
  answer: z.string().min(1),
});

/**
 * POST /api/admin/ai-feedback
 * Save user feedback
 */
export async function POST(req: NextRequest) {
  const { uid } = await assertAdminReq();

  try {
    const data = FeedbackSchema.parse(await req.json());
    const db = getFirestore();

    await db.collection('ai_feedback').add({
      ...data,
      uid,
      ts: Date.now(),
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('[AI Feedback POST] Error:', error);
    return Response.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/ai-feedback
 * Retrieve feedback history
 */
export async function GET() {
  await assertAdminReq();

  try {
    const db = getFirestore();

    const snap = await db
      .collection('ai_feedback')
      .orderBy('ts', 'desc')
      .limit(100)
      .get();

    const items = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Calculate stats
    const stats = {
      total: items.length,
      upvotes: items.filter((i: any) => i.vote === 'up').length,
      downvotes: items.filter((i: any) => i.vote === 'down').length,
    };

    return Response.json({ items, stats }, { status: 200 });
  } catch (error) {
    console.error('[AI Feedback GET] Error:', error);
    return Response.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}


