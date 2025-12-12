// src/app/api/audio/analyze/route.ts
// =============================================================================
// Phase 161.2 – Audio Analyze API
// Endpoint to trigger audio analysis (transcription, requirements extraction)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAgents } from '@/lib/agents/orchestratorBus';
import type { AudioAnalysisMode } from '../../../../../orchestrator/core/audio/types';

// =============================================================================
// POST /api/audio/analyze
// Trigger analysis for an audio attachment
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { attachmentId, projectId, mode = 'auto' } = body;

    if (!attachmentId) {
      return NextResponse.json(
        { success: false, error: 'attachmentId is required' },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId is required' },
        { status: 400 }
      );
    }

    // Validate mode
    const validModes: AudioAnalysisMode[] = ['auto', 'transcribe', 'requirements', 'bug', 'feature'];
    if (!validModes.includes(mode)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid mode. Must be one of: ${validModes.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Get audio agent
    const agents = getAgents();
    const audioAgent = agents.audio;

    if (!audioAgent) {
      return NextResponse.json(
        { success: false, error: 'Audio agent not initialized' },
        { status: 500 }
      );
    }

    // Trigger analysis
    const result = await audioAgent.analyzeAttachment(
      attachmentId,
      projectId,
      mode as AudioAnalysisMode
    );

    console.log('[161.2][API] Audio analysis result:', result.success, result.mode);

    return NextResponse.json({
      success: result.success,
      attachmentId: result.attachmentId,
      mode: result.mode,
      result: result.result,
      error: result.error,
      processingTime: result.processingTime,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[161.2][API] Error:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/audio/analyze?attachmentId=xxx
// Get analysis result for an audio attachment
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get('attachmentId');

    if (!attachmentId) {
      return NextResponse.json(
        { success: false, error: 'attachmentId is required' },
        { status: 400 }
      );
    }

    // Get attachment metadata which includes analysis results
    const { getAttachmentForProcessing } = await import(
      '../../../../../orchestrator/core/attachments/mediaAgentHooks'
    );

    const attachment = await getAttachmentForProcessing(attachmentId);

    if (!attachment) {
      return NextResponse.json(
        { success: false, error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Check for audio analysis in metadata
    const audioAnalysis = attachment.metadata?.audioAnalysis;

    return NextResponse.json({
      success: true,
      attachmentId: attachment.id,
      status: attachment.status,
      hasAudioAnalysis: !!audioAnalysis,
      audioAnalysis,
      metadata: attachment.metadata,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[161.2][API] Error:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

console.log('[161.2][API] Audio analyze route loaded');
