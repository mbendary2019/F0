// src/app/api/media/vision/route.ts
// Phase 171: Vision Analysis API Route

import { NextRequest, NextResponse } from 'next/server';
import {

export const dynamic = 'force-dynamic';
  analyzeMedia,
  type MediaAnalysisRequest,
  type AnalysisIntent,
} from '../../../../../orchestrator/core/media';

/**
 * POST /api/media/vision
 * Analyze media (images, PDFs) using vision AI
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.media) {
      return NextResponse.json(
        { error: 'Missing media field' },
        { status: 400 }
      );
    }

    if (!body.media.content) {
      return NextResponse.json(
        { error: 'Missing media.content field' },
        { status: 400 }
      );
    }

    if (!body.media.mimeType) {
      return NextResponse.json(
        { error: 'Missing media.mimeType field' },
        { status: 400 }
      );
    }

    // Build analysis request
    const analysisRequest: MediaAnalysisRequest = {
      media: {
        content: body.media.content,
        contentType: body.media.contentType || 'base64',
        mimeType: body.media.mimeType,
        filename: body.media.filename,
        sizeBytes: body.media.sizeBytes,
      },
      intent: (body.intent as AnalysisIntent) || 'general_description',
      userPrompt: body.userPrompt,
      projectContext: body.projectContext,
      userTier: body.userTier || 'free',
      forceModel: body.forceModel,
      maxTokens: body.maxTokens,
    };

    // Validate intent
    const validIntents: AnalysisIntent[] = [
      'general_description',
      'ui_extraction',
      'code_extraction',
      'document_summary',
      'data_extraction',
      'error_analysis',
      'design_feedback',
      'accessibility_audit',
    ];

    if (!validIntents.includes(analysisRequest.intent)) {
      return NextResponse.json(
        {
          error: `Invalid intent: ${analysisRequest.intent}. Valid: ${validIntents.join(', ')}`,
        },
        { status: 400 }
      );
    }

    console.log('[Phase171][MediaVision] Starting analysis', {
      intent: analysisRequest.intent,
      mimeType: analysisRequest.media.mimeType,
      hasUserPrompt: !!analysisRequest.userPrompt,
      userTier: analysisRequest.userTier,
    });

    // Run analysis
    const result = await analyzeMedia(analysisRequest);

    const totalTime = Date.now() - startTime;

    console.log('[Phase171][MediaVision] Analysis complete', {
      success: result.success,
      model: result.modelUsed,
      latencyMs: totalTime,
      tokens: result.metrics?.tokens?.total,
    });

    // Return result
    return NextResponse.json({
      success: result.success,
      mediaType: result.mediaType,
      intent: result.intent,
      analysis: result.analysis,
      modelUsed: result.modelUsed,
      providerUsed: result.providerUsed,
      metrics: {
        ...result.metrics,
        apiLatencyMs: totalTime,
      },
      ...(result.error && { error: result.error }),
      ...(result.extracted && {
        extracted: {
          hasText: !!result.extracted.text,
          textLength: result.extracted.text?.length,
          pageCount: result.extracted.pageCount,
          language: result.extracted.language,
        },
      }),
    });
  } catch (error: any) {
    console.error('[Phase171][MediaVision] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Analysis failed',
        latencyMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/media/vision
 * Get supported intents and formats
 */
export async function GET() {
  return NextResponse.json({
    phase: '171',
    name: 'Media Agent - Vision Analysis',
    supportedIntents: [
      {
        id: 'general_description',
        name: 'General Description',
        description: "Describe what's in the image or document",
      },
      {
        id: 'ui_extraction',
        name: 'UI Extraction',
        description: 'Extract UI components, layout, and design tokens',
      },
      {
        id: 'code_extraction',
        name: 'Code Extraction',
        description: 'Extract code from screenshots',
      },
      {
        id: 'document_summary',
        name: 'Document Summary',
        description: 'Summarize document content and key points',
      },
      {
        id: 'data_extraction',
        name: 'Data Extraction',
        description: 'Extract tables, charts, and data points',
      },
      {
        id: 'error_analysis',
        name: 'Error Analysis',
        description: 'Analyze error screenshots and suggest fixes',
      },
      {
        id: 'design_feedback',
        name: 'Design Feedback',
        description: 'Provide UI/UX design critique and suggestions',
      },
      {
        id: 'accessibility_audit',
        name: 'Accessibility Audit',
        description: 'Check for accessibility issues (WCAG)',
      },
    ],
    supportedFormats: {
      images: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
      documents: ['application/pdf'],
    },
    limits: {
      maxImageSizeMB: 20,
      maxPdfSizeMB: 50,
      maxPdfPages: 100,
    },
    tiers: {
      free: 'Basic models (gpt-4o-mini, gemini-flash)',
      pro: 'Standard models (claude-sonnet, gpt-4o)',
      enterprise: 'Premium models (claude-sonnet-4)',
    },
    example: {
      request: {
        media: {
          content: '<base64_encoded_image>',
          contentType: 'base64',
          mimeType: 'image/png',
        },
        intent: 'ui_extraction',
        userPrompt: 'Extract all buttons and their colors',
        userTier: 'pro',
      },
    },
  });
}

console.log('[Phase171] Media Vision API route loaded');
