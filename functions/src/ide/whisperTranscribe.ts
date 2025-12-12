/**
 * Phase 168.6: Whisper Transcription Firebase Function
 * Transcribes audio files to text using OpenAI Whisper API
 *
 * Supports: mp3, wav, m4a, ogg, webm, mp4, mpeg, mpga
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

// Define the secret (must be set via: firebase functions:secrets:set OPENAI_API_KEY)
const openaiApiKey = defineSecret('OPENAI_API_KEY');

const OPENAI_WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

interface WhisperTranscribeRequest {
  audioBase64: string;
  fileName: string;
  mimeType: string;
  locale?: 'ar' | 'en';
}

interface WhisperTranscribeResponse {
  text: string;
  duration?: number;
  language?: string;
}

/**
 * Firebase Function to transcribe audio using OpenAI Whisper API
 */
export const whisperTranscribe = onCall(
  {
    secrets: [openaiApiKey],
    memory: '512MiB',
    timeoutSeconds: 300, // 5 minutes for longer audio files
    cors: true,
  },
  async (request): Promise<WhisperTranscribeResponse> => {
    const { audioBase64, fileName, mimeType, locale } = request.data as WhisperTranscribeRequest;

    // Validate input
    if (!audioBase64 || !fileName) {
      throw new HttpsError('invalid-argument', 'Missing audio data or filename');
    }

    // Get API key from secret
    const apiKey = openaiApiKey.value();
    if (!apiKey) {
      console.error('[whisperTranscribe] OPENAI_API_KEY secret not configured');
      throw new HttpsError('failed-precondition', 'Whisper API not configured');
    }

    console.log('[whisperTranscribe] Processing request:', {
      fileName,
      mimeType,
      audioSizeKB: Math.round(audioBase64.length * 0.75 / 1024),
      locale,
    });

    try {
      // Convert base64 to Buffer
      const audioBuffer = Buffer.from(audioBase64, 'base64');

      // Create FormData for multipart/form-data request
      const FormData = (await import('form-data')).default;
      const formData = new FormData();

      // Add the audio file
      formData.append('file', audioBuffer, {
        filename: fileName,
        contentType: mimeType || 'audio/mpeg',
      });

      // Use whisper-1 model
      formData.append('model', 'whisper-1');

      // Set response format
      formData.append('response_format', 'verbose_json');

      // Set language hint if provided (helps with accuracy)
      if (locale === 'ar') {
        formData.append('language', 'ar');
      } else if (locale === 'en') {
        formData.append('language', 'en');
      }
      // If no locale, Whisper will auto-detect

      console.log('[whisperTranscribe] Calling Whisper API...');

      const res = await fetch(OPENAI_WHISPER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...formData.getHeaders(),
        },
        body: formData as unknown as BodyInit,
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[whisperTranscribe] Whisper API error:', res.status, errText);
        throw new HttpsError('internal', `Whisper API error: ${res.status}`);
      }

      const json = await res.json();

      console.log('[whisperTranscribe] Transcription complete:', {
        textLength: json.text?.length,
        duration: json.duration,
        language: json.language,
      });

      return {
        text: json.text || '',
        duration: json.duration,
        language: json.language,
      };
    } catch (error: any) {
      console.error('[whisperTranscribe] Error:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', error.message || 'Transcription failed');
    }
  }
);
