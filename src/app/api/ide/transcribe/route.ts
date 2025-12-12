/**
 * Phase 168.6: Audio Transcription API
 * Uses OpenAI Whisper API to transcribe audio files
 *
 * POST /api/ide/transcribe
 * Body: { audioBase64: string, fileName: string, mimeType: string, locale?: 'ar' | 'en' }
 * Response: { text: string, duration?: number, language?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Supported audio formats for Whisper
const SUPPORTED_FORMATS = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg'];

interface TranscribeRequest {
  audioBase64: string;
  fileName: string;
  mimeType: string;
  locale?: 'ar' | 'en';
}

export async function POST(request: NextRequest) {
  try {
    const body: TranscribeRequest = await request.json();
    const { audioBase64, fileName, mimeType, locale } = body;

    // Validate input
    if (!audioBase64 || !fileName) {
      return NextResponse.json(
        { error: 'Missing audio data or filename' },
        { status: 400 }
      );
    }

    // Validate file format
    const ext = fileName.toLowerCase().split('.').pop() || '';
    if (!SUPPORTED_FORMATS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported audio format: ${ext}. Supported: ${SUPPORTED_FORMATS.join(', ')}` },
        { status: 400 }
      );
    }

    // Get API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[Transcribe API] OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'Transcription API not configured' },
        { status: 500 }
      );
    }

    console.log('[Transcribe API] Processing request:', {
      fileName,
      mimeType,
      audioSizeKB: Math.round(audioBase64.length * 0.75 / 1024),
      locale,
    });

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    // Convert base64 to Buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // Create a File-like object for the OpenAI API
    const audioFile = new File([audioBuffer], fileName, { type: mimeType || 'audio/mpeg' });

    console.log('[Transcribe API] Calling Whisper API...');

    // Call Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      language: locale === 'ar' ? 'ar' : locale === 'en' ? 'en' : undefined,
    });

    console.log('[Transcribe API] Transcription complete:', {
      textLength: transcription.text?.length,
      duration: transcription.duration,
      language: transcription.language,
    });

    return NextResponse.json({
      ok: true,
      text: transcription.text,
      duration: transcription.duration,
      language: transcription.language,
    });

  } catch (error: any) {
    console.error('[Transcribe API] Error:', error);

    // Handle specific OpenAI errors
    if (error.code === 'audio_too_long') {
      return NextResponse.json(
        { error: 'Audio file is too long. Maximum duration is 25 minutes.' },
        { status: 400 }
      );
    }

    if (error.code === 'invalid_file_format') {
      return NextResponse.json(
        { error: 'Invalid audio file format.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Transcription failed' },
      { status: 500 }
    );
  }
}
