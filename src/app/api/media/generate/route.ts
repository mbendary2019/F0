/**
 * Phase 100.2.2: Prompt-to-Image API
 * Generates images from text prompts using DALL-E 3 and saves as data URLs
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getFirestoreAdmin } from '@/lib/server/firebase';
import type { F0MediaAsset, F0MediaKind } from '@/types/media';

export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateBody {
  projectId: string;
  kind: F0MediaKind;
  prompt: string;
  autoInsertTarget?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<GenerateBody>;
    console.log('[media/generate] body:', body);

    const { projectId, kind, prompt, autoInsertTarget } = body;

    if (!projectId || !kind || !prompt?.trim()) {
      return NextResponse.json(
        { error: 'Missing projectId, kind, or prompt' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('[media/generate] Missing OPENAI_API_KEY');
      return NextResponse.json(
        { error: 'Server is not configured for image generation' },
        { status: 500 }
      );
    }

    const db = getFirestoreAdmin();

    // 1️⃣ نولّد الصورة من OpenAI (نستخدم URL بدل base64)
    console.log('[media/generate] calling OpenAI.images.generate...');
    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      size: '1024x1024',
      n: 1,
      // مانحددش response_format، الافتراضي = "url"
    });

    console.log(
      '[media/generate] OpenAI response meta:',
      JSON.stringify(
        {
          created: imageResponse.created,
          usage: (imageResponse as any).usage,
        },
        null,
        2
      )
    );

    const imageUrl = imageResponse.data?.[0]?.url;
    if (!imageUrl) {
      console.error(
        '[media/generate] Missing url in OpenAI response:',
        JSON.stringify(imageResponse, null, 2)
      );
      return NextResponse.json(
        { error: 'Image generation failed: no url' },
        { status: 502 }
      );
    }

    console.log('[media/generate] Image URL:', imageUrl);

    // 3️⃣ نحفظ الـ metadata في Firestore
    const assetId = db.collection('_').doc().id; // Generate unique ID
    const ref = db
      .collection('projects')
      .doc(projectId)
      .collection('media_assets')
      .doc(assetId);

    const now = Date.now();

    const media: F0MediaAsset = {
      id: ref.id,
      projectId,
      kind,
      prompt: prompt.trim(),
      url: imageUrl,
      createdAt: now,
      createdByUid: null,
      autoInserted: false,
      ...(autoInsertTarget && { autoInsertTarget }),
    };

    await ref.set(media);
    console.log('[media/generate] metadata saved:', media.id);

    // 4️⃣ نرجّع JSON دايمًا
    return NextResponse.json({ ok: true, media }, { status: 200 });
  } catch (err: any) {
    console.error('[media/generate] error:', err);
    return NextResponse.json(
      {
        error: 'Internal server error in media/generate',
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
