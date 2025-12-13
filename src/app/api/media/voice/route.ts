/**
 * Phase 100.3: Voice-to-Text API
 * Transcribes audio using OpenAI Whisper STT (Arabic + English)
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { VoiceToTextResponse } from '@/types/media';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';

// Lazy initialization of OpenAI client to avoid build-time errors
let _openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('[media/voice] OPENAI_API_KEY is not configured');
  }
  _openai = new OpenAI({ apiKey });
  return _openai;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[media/voice] Missing OPENAI_API_KEY');
      return NextResponse.json(
        { ok: false, error: 'Server is not configured for voice transcription' } as VoiceToTextResponse,
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    const language = (formData.get('language') as string) || 'en'; // 'en' or 'ar'

    if (!audioFile) {
      return NextResponse.json(
        { ok: false, error: 'Missing audio file' } as VoiceToTextResponse,
        { status: 400 }
      );
    }

    console.log('[media/voice] Received audio:', {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size,
      language,
    });

    // Convert File to Buffer for OpenAI
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create a File-like object that OpenAI expects
    const openaiFile = new Blob([buffer], { type: audioFile.type || 'audio/webm' }) as any;
    openaiFile.name = audioFile.name || 'audio.webm';

    console.log('[media/voice] Calling OpenAI Whisper API...');

    // Call Whisper API
    const transcription = await getOpenAIClient().audio.transcriptions.create({
      file: openaiFile,
      model: 'whisper-1',
      language: language === 'ar' ? 'ar' : 'en', // Specify language for better accuracy
      response_format: 'json',
    });

    console.log('[media/voice] Transcription successful:', {
      textLength: transcription.text.length,
      preview: transcription.text.substring(0, 100),
    });

    return NextResponse.json({
      ok: true,
      transcript: transcription.text,
    } as VoiceToTextResponse);
  } catch (err: any) {
    console.error('[media/voice] Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error', details: err?.message } as VoiceToTextResponse,
      { status: 500 }
    );
  }
}
