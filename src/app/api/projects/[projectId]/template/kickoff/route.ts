// src/app/api/projects/[projectId]/template/kickoff/route.ts
/**
 * Phase 98.3: Template Kickoff API
 *
 * POST - Confirm plan and mark kickoff as done
 * GET - Get current kickoff state
 */

import { NextRequest, NextResponse } from 'next/server';
import {

export const dynamic = 'force-dynamic';
  getTemplateKickoffState,
  markTemplateKickoffDone,
  getTemplateData,
  buildTemplateKickoffInstructions,
} from '@/lib/server/templateKickoff';

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

// GET - Get template kickoff state
export async function GET(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    const { projectId } = await context.params;
    console.log('[Template Kickoff API] GET called for project:', projectId);

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const state = await getTemplateKickoffState(projectId);
    console.log('[Template Kickoff API] Template state:', state);

    if (!state) {
      return NextResponse.json({
        hasTemplate: false,
        kickoff: null,
      });
    }

    // Get template details for display
    let templateDetails = null;
    if (state.createdFromTemplate) {
      templateDetails = await getTemplateData(state.createdFromTemplate);
    }

    return NextResponse.json({
      ok: true, // Phase 98.3: Add ok flag for client compatibility
      hasTemplate: true,
      templateSlug: state.createdFromTemplate,
      // Phase 98.3: Add templateTitle directly for client
      templateTitle: templateDetails?.title || templateDetails?.titleAr || state.createdFromTemplate,
      kickoff: state.kickoff,
      templateDetails: templateDetails ? {
        title: templateDetails.title,
        titleAr: templateDetails.titleAr,
        shortDescription: templateDetails.shortDescription,
        shortDescriptionAr: templateDetails.shortDescriptionAr,
        icon: templateDetails.icon,
        category: templateDetails.category,
        platforms: templateDetails.platforms,
        techStack: templateDetails.techStack,
        difficulty: templateDetails.difficulty,
        estimatedMvpDays: templateDetails.estimatedMvpDays,
      } : null,
    });
  } catch (error: any) {
    console.error('[Template Kickoff API] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

// POST - Confirm plan / mark kickoff done
export async function POST(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const { projectId } = await context.params;

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'confirm_plan') {
      // Mark kickoff as done
      const success = await markTemplateKickoffDone(projectId);

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to mark kickoff as done' },
          { status: 500 }
        );
      }

      // Check if we need to save the plan (from last F0_JSON)
      // This would be handled by the client calling process-json first
      // or we can check for existing plan here

      return NextResponse.json({
        ok: true,
        message: 'Template kickoff confirmed',
      });
    }

    if (action === 'get_context') {
      // Get full template context for agent
      const state = await getTemplateKickoffState(projectId);

      if (!state || !state.createdFromTemplate) {
        return NextResponse.json({
          hasTemplate: false,
          context: null,
        });
      }

      const templateData = await getTemplateData(state.createdFromTemplate);

      if (!templateData) {
        return NextResponse.json({
          hasTemplate: true,
          context: null,
          error: 'Template data not found',
        });
      }

      // Build the context string for the agent
      const contextString = buildTemplateKickoffInstructions({
        templateSlug: state.createdFromTemplate,
        templateTitle: templateData.title,
        templateTitleAr: templateData.titleAr,
        templateSummary: templateData.shortDescription,
        templateSummaryAr: templateData.shortDescriptionAr,
        templatePlan: templateData.fullDescription,
        templatePlanAr: templateData.fullDescriptionAr,
        platforms: templateData.platforms || [],
        techStack: templateData.techStack || [],
        category: templateData.category,
        difficulty: templateData.difficulty,
        estimatedMvpDays: templateData.estimatedMvpDays,
      });

      return NextResponse.json({
        hasTemplate: true,
        kickoffDone: state.kickoff.done,
        context: contextString,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "confirm_plan" or "get_context"' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Template Kickoff API] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
