/**
 * Phase 168.3: Vision API Firebase Function
 * Securely calls OpenAI Vision API using Firebase secrets
 *
 * This function is called by the Next.js API route to analyze images
 * without exposing the OpenAI API key in the client-side code.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

// Define the secret (must be set via: firebase functions:secrets:set OPENAI_API_KEY)
const openaiApiKey = defineSecret('OPENAI_API_KEY');

const OPENAI_VISION_URL = 'https://api.openai.com/v1/chat/completions';

interface ImageAttachment {
  name: string;
  base64: string;
  mimeType: string;
}

interface VisionAnalyzeRequest {
  message: string;
  images: ImageAttachment[];
  locale: 'ar' | 'en';
  context?: string;
}

interface VisionAnalyzeResponse {
  text: string;
  model: string;
  tokensUsed?: number;
}

/**
 * Firebase Function to analyze images using OpenAI Vision API
 */
export const visionAnalyze = onCall(
  {
    secrets: [openaiApiKey],
    memory: '512MiB',
    timeoutSeconds: 120,
    cors: true,
  },
  async (request): Promise<VisionAnalyzeResponse> => {
    const { message, images, locale, context } = request.data as VisionAnalyzeRequest;

    // Validate input
    if (!message || !images || images.length === 0) {
      throw new HttpsError('invalid-argument', 'Missing message or images');
    }

    // Get API key from secret
    const apiKey = openaiApiKey.value();
    if (!apiKey) {
      console.error('[visionAnalyze] OPENAI_API_KEY secret not configured');
      throw new HttpsError('failed-precondition', 'Vision API not configured');
    }

    console.log('[visionAnalyze] Processing request:', {
      messageLength: message.length,
      imageCount: images.length,
      locale,
      hasContext: !!context,
    });

    // Build multimodal content array
    const content: Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> = [];

    // Add text message first
    const textPrompt = context
      ? `${context}\n\n${locale === 'ar' ? 'طلب المستخدم:' : 'User request:'} ${message}`
      : message;
    content.push({ type: 'text', text: textPrompt });

    // Add images
    for (const img of images) {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${img.mimeType};base64,${img.base64}`,
          detail: 'auto',
        },
      });
    }

    // System prompt based on locale
    const systemPrompt = locale === 'ar'
      ? `أنت وكيل كود F0 متعدد الوسائط. يمكنك تحليل الصور والرد بالعربية.
عند تحليل الصور:
- اشرح ما تراه بوضوح
- إذا كانت الصورة تحتوي على كود أو واجهة مستخدم، اشرح المكونات
- إذا كان هناك خطأ ظاهر، اقترح حلولاً
- كن مفيداً ومباشراً`
      : `You are the F0 Code Agent with multimodal capabilities. You can analyze images and respond helpfully.
When analyzing images:
- Explain what you see clearly
- If the image contains code or UI, explain the components
- If there are visible errors, suggest solutions
- Be helpful and direct`;

    try {
      console.log('[visionAnalyze] Calling GPT-4o with', images.length, 'images');

      const res = await fetch(OPENAI_VISION_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content },
          ],
          max_tokens: 4096,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[visionAnalyze] OpenAI API error:', res.status, errText);
        throw new HttpsError('internal', `Vision API error: ${res.status}`);
      }

      const json = await res.json();
      const responseText = json.choices?.[0]?.message?.content || '';
      const tokensUsed = json.usage?.total_tokens;

      console.log('[visionAnalyze] Response received:', {
        responseLength: responseText.length,
        tokensUsed,
      });

      return {
        text: responseText,
        model: 'gpt-4o',
        tokensUsed,
      };
    } catch (error: any) {
      console.error('[visionAnalyze] Error:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', error.message || 'Vision analysis failed');
    }
  }
);
