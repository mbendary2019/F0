/**
 * F0 Agent Chat Endpoint
 * POST /api/agent/chat
 * Handles chat requests from the F0 Agent workspace page
 * Simpler than IDE chat - focuses on planning, PRD generation, and design tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import { requireUser } from '@/lib/api/requireUser';
import { requireProjectOwner } from '@/lib/api/requireProjectOwner';
import { askAgent } from '@/lib/agents';

const db = getFirestore(adminApp);

type AgentChatRequest = {
  projectId: string;
  intent: string;
  message: string;
  locale?: string;
};

type AgentChatResponse = {
  reply: string;
  messageId: string;
};

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const user = await requireUser(req);

    // Parse request body
    const body: AgentChatRequest = await req.json();
    const { projectId, intent, message, locale = 'en' } = body;

    if (!projectId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId or message' },
        { status: 400 }
      );
    }

    // Verify project ownership
    await requireProjectOwner(user, projectId);

    // Get project context
    const projectDoc = await db.collection('ops_projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const projectData = projectDoc.data();
    const projectName = projectData?.name || 'Untitled Project';
    const brief = projectData?.context?.brief || '';
    const techStack = projectData?.projectAnalysis || null;
    const memory = projectData?.projectMemory || null;

    // Build intent-specific system context
    let systemContext = '';
    switch (intent) {
      case 'generate-prd':
        systemContext = `You are a product manager agent helping to generate a detailed Product Requirements Document (PRD) for the project "${projectName}".

The PRD should include:
- Executive Summary
- Problem Statement
- Target Users & Personas
- User Stories & Use Cases
- Functional Requirements
- Non-Functional Requirements
- Technical Constraints
- Success Metrics

Be thorough and professional.`;
        break;

      case 'design-api-db':
        systemContext = `You are a senior backend architect helping to design API endpoints and database schema for the project "${projectName}".

Provide:
- REST API endpoint specifications (routes, methods, request/response schemas)
- Database schema design (collections/tables, fields, relationships)
- Authentication & authorization strategy
- API best practices and conventions

Use modern best practices and be specific.`;
        break;

      case 'plan-board':
        systemContext = `You are a technical project manager helping to break down the project "${projectName}" into phases and tasks.

Create a structured plan with:
- High-level phases
- Detailed tasks for each phase
- Dependencies between tasks
- Estimated effort/complexity
- Priority levels

Make it actionable and clear.`;
        break;

      default: // 'continue' or any other
        systemContext = `You are a helpful full-stack development assistant working on the project "${projectName}".

Help the user with planning, design, coding, architecture decisions, and any technical questions about this project.`;
        break;
    }

    // Build enhanced message with context
    const enhancedMessage = `
${systemContext}

## Project Context
**Project Name**: ${projectName}
**Project ID**: ${projectId}

${brief ? `**Project Brief**:\n${brief}\n\n` : ''}

${techStack ? `**Tech Stack**: ${JSON.stringify(techStack, null, 2)}\n\n` : ''}

---

**User Request**:
${message}
`;

    console.log(`[Agent Chat] Processing ${intent} request for project ${projectId}`);

    // Call agent
    const agentResponse = await askAgent(enhancedMessage, {
      projectId,
      brief,
      techStack,
      memory,
      lang: locale as 'ar' | 'en',
    });

    const messageId = crypto.randomUUID();

    // Build response
    const response: AgentChatResponse = {
      messageId,
      reply: agentResponse.text,
    };

    // Save message to project history (optional)
    try {
      await db
        .collection('ops_projects')
        .doc(projectId)
        .collection('agentMessages')
        .doc(messageId)
        .set({
          id: messageId,
          userId: user.uid,
          intent,
          userMessage: message,
          agentReply: agentResponse.text,
          createdAt: FieldValue.serverTimestamp(),
        });
    } catch (err) {
      console.warn('[Agent Chat] Failed to save message history:', err);
      // Non-critical, continue
    }

    console.log(`[Agent Chat] Response generated for ${intent}`);

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[Agent Chat] Error:', error);

    // Handle authentication errors
    if (error.message === 'NO_TOKEN' || error.message === 'INVALID_TOKEN') {
      return NextResponse.json(
        { error: 'Unauthorized', details: error.message },
        { status: 401 }
      );
    }

    if (error.message === 'NOT_OWNER') {
      return NextResponse.json(
        { error: 'Access denied - Not project owner' },
        { status: 403 }
      );
    }

    if (error.message === 'PROJECT_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
