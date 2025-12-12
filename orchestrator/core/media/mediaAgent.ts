// orchestrator/core/media/mediaAgent.ts
// Phase 171: Media Agent - Main orchestrator for media analysis

import type {
  MediaInput,
  MediaType,
  AnalysisIntent,
  MediaAnalysisRequest,
  MediaAnalysisResponse,
  AnalysisResult,
  ExtractedContent,
  MediaProcessingMetrics,
  VisionModelId,
  VisionProvider,
} from './mediaTypes';

import { VisionRouter, getVisionModelConfig, VISION_MODELS } from './visionRouter';
import {
  validateImage,
  extractBase64,
  prepareImageForVision,
  detectMediaType,
  formatImageForProvider,
  urlToBase64,
} from './extractors/imageExtractor';
import { extractPDFContent, validatePDF, chunkPDFText } from './extractors/pdfExtractor';
import {
  getVisionSystemPrompt,
  buildUserPrompt,
  getResponseFormatInstructions,
} from './prompts/visionAnalysisPrompt';

// Import LLM clients from Phase 170
import { LLMClientFactory } from '../llm/clientFactory';

/**
 * Media Agent Logger
 */
function log(
  level: 'info' | 'warn' | 'error',
  action: string,
  data?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const prefix = `[MediaAgent][${timestamp}]`;

  switch (level) {
    case 'error':
      console.error(`${prefix} ❌ ${action}`, data || '');
      break;
    case 'warn':
      console.warn(`${prefix} ⚠️ ${action}`, data || '');
      break;
    default:
      console.log(`${prefix} ${action}`, data || '');
  }
}

/**
 * Media Agent Class
 * Orchestrates media analysis with intelligent routing and fallbacks
 */
export class MediaAgent {
  private metrics: Partial<MediaProcessingMetrics> = {};
  private startTime: number = 0;

  /**
   * Analyze media with full pipeline
   */
  async analyze(request: MediaAnalysisRequest): Promise<MediaAnalysisResponse> {
    this.startTime = Date.now();
    this.metrics = {
      retryCount: 0,
      tokens: { input: 0, output: 0, total: 0 },
    };

    try {
      log('info', 'Starting media analysis', {
        intent: request.intent,
        mimeType: request.media.mimeType,
        hasUserPrompt: !!request.userPrompt,
      });

      // 1. Detect and validate media type
      const mediaType = this.detectMediaType(request.media);
      log('info', `Detected media type: ${mediaType}`);

      // 2. Extract content based on media type
      const extracted = await this.extractContent(request.media, mediaType);
      this.metrics.extractionLatencyMs = Date.now() - this.startTime;
      log('info', 'Content extracted', {
        hasText: !!extracted.text,
        pageCount: extracted.pageCount,
      });

      // 3. Route to appropriate vision model
      const routing = VisionRouter.route({
        mediaType,
        intent: request.intent,
        userTier: request.userTier || 'free',
        fileSizeBytes: request.media.sizeBytes,
      });

      // Override if specific model requested
      const modelToUse = request.forceModel || routing.primaryModel;
      const providerToUse = request.forceModel
        ? VISION_MODELS[request.forceModel].provider
        : routing.provider;

      log('info', 'Model routing complete', {
        model: modelToUse,
        provider: providerToUse,
        reason: routing.reason,
      });

      // 4. Prepare prompts
      const systemPrompt = getVisionSystemPrompt(request.intent, mediaType);
      const userPrompt =
        buildUserPrompt(request.intent, request.userPrompt, request.projectContext) +
        getResponseFormatInstructions(request.intent);

      // 5. Call vision API
      const visionStartTime = Date.now();
      let analysis: AnalysisResult;
      let modelUsed = modelToUse;
      let providerUsed = providerToUse;
      let fallbacksAttempted = 0;

      try {
        analysis = await this.callVisionAPI(
          request.media,
          mediaType,
          modelToUse,
          providerToUse,
          systemPrompt,
          userPrompt,
          extracted,
          request.maxTokens
        );
      } catch (primaryError: any) {
        log('warn', `Primary model failed: ${primaryError.message}`, {
          model: modelToUse,
        });

        // Try fallbacks
        for (const fallbackModel of routing.fallbacks) {
          fallbacksAttempted++;
          this.metrics.retryCount = fallbacksAttempted;

          try {
            const fallbackProvider = VISION_MODELS[fallbackModel].provider;
            log('info', `Trying fallback: ${fallbackModel}`);

            analysis = await this.callVisionAPI(
              request.media,
              mediaType,
              fallbackModel,
              fallbackProvider,
              systemPrompt,
              userPrompt,
              extracted,
              request.maxTokens
            );

            modelUsed = fallbackModel;
            providerUsed = fallbackProvider;
            break;
          } catch (fallbackError: any) {
            log('warn', `Fallback failed: ${fallbackError.message}`, {
              model: fallbackModel,
            });
          }
        }

        if (!analysis!) {
          throw new Error(
            `All models failed. Last error: ${primaryError.message}`
          );
        }
      }

      this.metrics.visionLatencyMs = Date.now() - visionStartTime;
      this.metrics.totalLatencyMs = Date.now() - this.startTime;

      // Calculate cost
      this.metrics.estimatedCostUsd = VisionRouter.estimateCost(
        modelUsed,
        this.metrics.tokens?.input || 0,
        this.metrics.tokens?.output || 0
      );

      log('info', 'Analysis complete', {
        model: modelUsed,
        latencyMs: this.metrics.totalLatencyMs,
        tokens: this.metrics.tokens?.total,
        costUsd: this.metrics.estimatedCostUsd?.toFixed(4),
      });

      return {
        success: true,
        mediaType,
        intent: request.intent,
        extracted,
        analysis,
        modelUsed,
        providerUsed,
        metrics: this.metrics as MediaProcessingMetrics,
      };
    } catch (error: any) {
      log('error', 'Media analysis failed', { error: error.message });

      this.metrics.totalLatencyMs = Date.now() - this.startTime;

      return {
        success: false,
        mediaType: 'image',
        intent: request.intent,
        analysis: {
          description: 'Analysis failed',
          findings: [],
          confidence: 0,
        },
        modelUsed: 'gpt-4o-mini',
        providerUsed: 'openai',
        metrics: this.metrics as MediaProcessingMetrics,
        error: error.message,
      };
    }
  }

  /**
   * Detect media type from input
   */
  private detectMediaType(input: MediaInput): MediaType {
    const mimeType = input.mimeType.toLowerCase();

    if (mimeType === 'application/pdf') {
      return 'pdf';
    }

    if (mimeType.startsWith('image/')) {
      return detectMediaType(input);
    }

    // Default to image
    return 'image';
  }

  /**
   * Extract content from media
   */
  private async extractContent(
    input: MediaInput,
    mediaType: MediaType
  ): Promise<ExtractedContent> {
    if (mediaType === 'pdf') {
      return extractPDFContent(input);
    }

    // For images, validation only - actual content comes from vision API
    const validation = validateImage(input);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return {
      metadata: {
        validationWarnings: validation.warnings,
        filename: input.filename,
      },
    };
  }

  /**
   * Call vision API with specific model
   */
  private async callVisionAPI(
    input: MediaInput,
    mediaType: MediaType,
    model: VisionModelId,
    provider: VisionProvider,
    systemPrompt: string,
    userPrompt: string,
    extracted: ExtractedContent,
    maxTokens?: number
  ): Promise<AnalysisResult> {
    // Check if provider is available
    if (!VisionRouter.isProviderAvailable(provider)) {
      throw new Error(`Provider ${provider} not available (missing API key)`);
    }

    // For PDFs, we use text + optional image analysis
    if (mediaType === 'pdf' && extracted.text) {
      return this.analyzeWithText(
        extracted.text,
        model,
        provider,
        systemPrompt,
        userPrompt,
        maxTokens
      );
    }

    // For images, use vision API
    return this.analyzeWithVision(
      input,
      model,
      provider,
      systemPrompt,
      userPrompt,
      maxTokens
    );
  }

  /**
   * Analyze using text (for PDFs with extracted text)
   */
  private async analyzeWithText(
    text: string,
    model: VisionModelId,
    provider: VisionProvider,
    systemPrompt: string,
    userPrompt: string,
    maxTokens?: number
  ): Promise<AnalysisResult> {
    // Chunk text if too long
    const chunks = chunkPDFText(text, 6000);
    const isMultiChunk = chunks.length > 1;

    log('info', 'Analyzing text content', {
      textLength: text.length,
      chunks: chunks.length,
    });

    // For single chunk, analyze directly
    // For multiple chunks, summarize each then combine
    const contextText = isMultiChunk
      ? `[Document has ${chunks.length} sections]\n\nSection 1:\n${chunks[0]}\n\n[... ${chunks.length - 1} more sections ...]`
      : text;

    const fullPrompt = `${userPrompt}\n\nDocument content:\n${contextText}`;

    // Use LLM client from Phase 170
    const client = LLMClientFactory.getByProvider(provider);

    const response = await client.chat({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fullPrompt },
      ],
      temperature: 0.3,
      maxTokens: maxTokens || 2000,
    });

    // Update token metrics
    if (response.usage) {
      this.metrics.tokens = {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens,
        total: response.usage.totalTokens,
      };
    }

    return this.parseAnalysisResponse(response.content);
  }

  /**
   * Analyze using vision API
   */
  private async analyzeWithVision(
    input: MediaInput,
    model: VisionModelId,
    provider: VisionProvider,
    systemPrompt: string,
    userPrompt: string,
    maxTokens?: number
  ): Promise<AnalysisResult> {
    // Get base64 image
    let base64: string;
    let mimeType: string;

    if (input.contentType === 'url') {
      const result = await urlToBase64(input.content);
      base64 = result.base64;
      mimeType = result.mimeType;
    } else {
      const prepared = prepareImageForVision(input);
      base64 = prepared.base64;
      mimeType = prepared.mediaType;
    }

    log('info', 'Calling vision API', {
      provider,
      model,
      imageSizeKB: Math.round(base64.length * 0.75 / 1024),
    });

    // Provider-specific vision calls
    switch (provider) {
      case 'anthropic':
        return this.callAnthropicVision(
          base64,
          mimeType,
          model,
          systemPrompt,
          userPrompt,
          maxTokens
        );

      case 'openai':
        return this.callOpenAIVision(
          base64,
          mimeType,
          model,
          systemPrompt,
          userPrompt,
          maxTokens
        );

      case 'gemini':
        return this.callGeminiVision(
          base64,
          mimeType,
          model,
          systemPrompt,
          userPrompt,
          maxTokens
        );

      default:
        throw new Error(`Unknown vision provider: ${provider}`);
    }
  }

  /**
   * Call Anthropic Claude Vision API
   */
  private async callAnthropicVision(
    base64: string,
    mimeType: string,
    model: VisionModelId,
    systemPrompt: string,
    userPrompt: string,
    maxTokens?: number
  ): Promise<AnalysisResult> {
    const client = LLMClientFactory.getAnthropic();

    // Anthropic SDK requires specific vision format
    // We need to use the underlying SDK directly for vision
    const anthropicClient = (client as any).client;
    if (!anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }

    const response = await anthropicClient.messages.create({
      model,
      max_tokens: maxTokens || 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    });

    // Update metrics
    if (response.usage) {
      this.metrics.tokens = {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      };
    }

    const textContent = response.content.find((c: any) => c.type === 'text');
    const content = textContent?.text || '';

    return this.parseAnalysisResponse(content);
  }

  /**
   * Call OpenAI GPT-4 Vision API
   */
  private async callOpenAIVision(
    base64: string,
    mimeType: string,
    model: VisionModelId,
    systemPrompt: string,
    userPrompt: string,
    maxTokens?: number
  ): Promise<AnalysisResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens || 2000,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                  detail: 'high',
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Update metrics
    if (data.usage) {
      this.metrics.tokens = {
        input: data.usage.prompt_tokens,
        output: data.usage.completion_tokens,
        total: data.usage.total_tokens,
      };
    }

    const content = data.choices[0]?.message?.content || '';
    return this.parseAnalysisResponse(content);
  }

  /**
   * Call Google Gemini Vision API
   */
  private async callGeminiVision(
    base64: string,
    mimeType: string,
    model: VisionModelId,
    systemPrompt: string,
    userPrompt: string,
    maxTokens?: number
  ): Promise<AnalysisResult> {
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not configured');
    }

    // Map model ID to Gemini API model name
    const modelMap: Record<string, string> = {
      'gemini-1.5-flash': 'gemini-1.5-flash-latest',
      'gemini-1.5-pro': 'gemini-1.5-pro-latest',
    };
    const geminiModel = modelMap[model] || model;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                },
                { text: userPrompt },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: maxTokens || 2000,
            temperature: 0.3,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Update metrics
    if (data.usageMetadata) {
      this.metrics.tokens = {
        input: data.usageMetadata.promptTokenCount,
        output: data.usageMetadata.candidatesTokenCount,
        total: data.usageMetadata.totalTokenCount,
      };
    }

    const content =
      data.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text)
        .join('') || '';

    return this.parseAnalysisResponse(content);
  }

  /**
   * Parse analysis response into structured format
   */
  private parseAnalysisResponse(content: string): AnalysisResult {
    // Try to parse as JSON
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;

      const parsed = JSON.parse(jsonStr.trim());

      return {
        description: parsed.description || 'No description',
        findings: parsed.findings || [],
        uiComponents: parsed.uiComponents,
        codeBlocks: parsed.codeBlocks,
        dataPoints: parsed.dataPoints,
        suggestions: parsed.suggestions,
        confidence: parsed.confidence || 0.8,
      };
    } catch {
      // Fallback: treat as plain text
      return {
        description: content,
        findings: [],
        confidence: 0.7,
      };
    }
  }
}

/**
 * Singleton instance
 */
let mediaAgentInstance: MediaAgent | null = null;

/**
 * Get MediaAgent instance
 */
export function getMediaAgent(): MediaAgent {
  if (!mediaAgentInstance) {
    mediaAgentInstance = new MediaAgent();
  }
  return mediaAgentInstance;
}

/**
 * Convenience function for quick analysis
 */
export async function analyzeMedia(
  request: MediaAnalysisRequest
): Promise<MediaAnalysisResponse> {
  return getMediaAgent().analyze(request);
}

/**
 * Quick image analysis
 */
export async function analyzeImage(
  base64: string,
  mimeType: string,
  intent: AnalysisIntent = 'general_description',
  userPrompt?: string
): Promise<MediaAnalysisResponse> {
  return analyzeMedia({
    media: {
      content: base64,
      contentType: 'base64',
      mimeType,
    },
    intent,
    userPrompt,
  });
}

/**
 * Quick PDF analysis
 */
export async function analyzePDF(
  base64: string,
  intent: AnalysisIntent = 'document_summary',
  userPrompt?: string
): Promise<MediaAnalysisResponse> {
  return analyzeMedia({
    media: {
      content: base64,
      contentType: 'base64',
      mimeType: 'application/pdf',
    },
    intent,
    userPrompt,
  });
}

/**
 * Analyze image from URL
 */
export async function analyzeImageUrl(
  url: string,
  intent: AnalysisIntent = 'general_description',
  userPrompt?: string
): Promise<MediaAnalysisResponse> {
  return analyzeMedia({
    media: {
      content: url,
      contentType: 'url',
      mimeType: 'image/jpeg', // Will be detected from response
    },
    intent,
    userPrompt,
  });
}
