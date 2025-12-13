/**
 * Phase 90.1: Project Planning API
 * POST /api/agent/plan-project
 *
 * Converts project description into structured technical plan
 * with phases and tasks ready for Orchestrator Agent execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { requireProjectOwner } from '@/lib/api/requireProjectOwner';
import { askAgent } from '@/lib/agents';

export const dynamic = 'force-dynamic';

// Phase 90.1: Plan structure types
export interface Task {
  id: string;
  title: string;
  agent: 'UI_AGENT' | 'DB_AGENT' | 'IDE_AGENT' | 'BACKEND_AGENT' | 'DEPLOY_AGENT';
  type: string;
  input: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface Phase {
  id: string;
  title: string;
  order: number;
  tasks: Task[];
  status?: 'pending' | 'in_progress' | 'completed';
}

export interface ProjectPlan {
  phases: Phase[];
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication
    const user = await requireUser(req);

    // 2. Parse request body
    const body = await req.json();
    const { projectId, description, locale = 'en' } = body;

    if (!projectId || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId or description' },
        { status: 400 }
      );
    }

    // 3. Verify project ownership
    await requireProjectOwner(user, projectId);

    console.log(`[Plan Project] Generating plan for project ${projectId}`);

    // 4. Build system prompt for Planning Agent
    const systemPrompt = locale === 'ar'
      ? `أنت F0 Planning Agent — وكيل التخطيط الذكي.

**المهمة:**
- تحويل وصف المشروع إلى خطة تقنية واضحة ومنظمة.
- إرجاع JSON منظم فقط (بدون شرح).

**البنية المطلوبة:**
\`\`\`json
{
  "phases": [
    {
      "id": "phase_1",
      "title": "عنوان المرحلة (مثال: نظام المصادقة)",
      "order": 1,
      "tasks": [
        {
          "id": "t_1",
          "title": "عنوان المهمة (مثال: تصميم شاشة تسجيل الدخول)",
          "agent": "UI_AGENT | DB_AGENT | IDE_AGENT | BACKEND_AGENT | DEPLOY_AGENT",
          "type": "نوع المهمة (مثال: SCREEN_DESIGN)",
          "input": "التفاصيل والسياق المطلوب"
        }
      ]
    }
  ]
}
\`\`\`

**القواعد الصارمة:**
1. يجب إنتاج 3-6 مراحل على الأقل
2. كل مرحلة يجب أن تحتوي على 2-5 مهام
3. order يجب أن يكون تصاعدي (1، 2، 3...)
4. id يجب أن يكون فريد (phase_1, t_1, t_2...)
5. agent يجب أن يكون واحد من: UI_AGENT, DB_AGENT, IDE_AGENT, BACKEND_AGENT, DEPLOY_AGENT
6. بدون أي شرح أو نص إضافي — JSON فقط

**مثال Agent Types:**
- UI_AGENT: تصميم الواجهات، المكونات، الصفحات
- DB_AGENT: تصميم قاعدة البيانات، الجداول، العلاقات
- BACKEND_AGENT: APIs، المنطق الخلفي، التوثيق
- IDE_AGENT: إعداد المشروع، التكوينات، الأدوات
- DEPLOY_AGENT: النشر، الاستضافة، CI/CD

**مثال Task Types:**
- SCREEN_DESIGN: تصميم شاشة جديدة
- API_CREATE: إنشاء API endpoint
- DB_SCHEMA: تصميم schema
- SETUP_PROJECT: إعداد مشروع جديد
- DEPLOY_VERCEL: نشر على Vercel

أرجع JSON فقط:`
      : `You are F0 Planning Agent — intelligent project planner.

**Goal:**
- Convert project description into clear, structured technical plan.
- Return structured JSON only (no explanations).

**Required Structure:**
\`\`\`json
{
  "phases": [
    {
      "id": "phase_1",
      "title": "Phase title (e.g., Authentication System)",
      "order": 1,
      "tasks": [
        {
          "id": "t_1",
          "title": "Task title (e.g., Design Login Screen)",
          "agent": "UI_AGENT | DB_AGENT | IDE_AGENT | BACKEND_AGENT | DEPLOY_AGENT",
          "type": "Task type (e.g., SCREEN_DESIGN)",
          "input": "Detailed context and requirements"
        }
      ]
    }
  ]
}
\`\`\`

**Strict Rules:**
1. Must produce 3-6 phases minimum
2. Each phase must have 2-5 tasks
3. order must be incremental (1, 2, 3...)
4. id must be unique (phase_1, t_1, t_2...)
5. agent must be one of: UI_AGENT, DB_AGENT, IDE_AGENT, BACKEND_AGENT, DEPLOY_AGENT
6. No explanations or extra text — JSON only

**Agent Types Guide:**
- UI_AGENT: UI design, components, pages
- DB_AGENT: Database design, tables, relationships
- BACKEND_AGENT: APIs, backend logic, auth
- IDE_AGENT: Project setup, configs, tooling
- DEPLOY_AGENT: Deployment, hosting, CI/CD

**Task Types Examples:**
- SCREEN_DESIGN: Design new screen
- API_CREATE: Create API endpoint
- DB_SCHEMA: Design database schema
- SETUP_PROJECT: Setup new project
- DEPLOY_VERCEL: Deploy to Vercel

Return JSON only:`;

    // 5. Call askAgent (Phase 84 integration)
    const userMessage = locale === 'ar'
      ? `**وصف المشروع:**\n${description}\n\nأرجع خطة JSON منظمة بناءً على الوصف أعلاه.`
      : `**Project Description:**\n${description}\n\nReturn structured JSON plan based on the description above.`;

    const fullPrompt = `${systemPrompt}\n\n${userMessage}`;

    const result = await askAgent(fullPrompt, {
      projectId,
      lang: locale as 'ar' | 'en',
    });

    const content = result.visible.trim();

    console.log(`[Plan Project] Raw agent response length: ${content.length}`);

    // 6. Extract JSON from response (handle markdown code blocks)
    let jsonContent = content;

    // Try to extract JSON from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
      console.log(`[Plan Project] Extracted JSON from code block`);
    }

    // 7. Parse JSON
    let plan: ProjectPlan;
    try {
      plan = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('[Plan Project] JSON parse error:', parseError);
      console.error('[Plan Project] Raw content:', content.slice(0, 500));

      return NextResponse.json(
        {
          error: 'Invalid JSON from agent',
          raw: content.slice(0, 500),
          details: parseError instanceof Error ? parseError.message : 'Parse failed'
        },
        { status: 500 }
      );
    }

    // 8. Validate plan structure
    if (!plan.phases || !Array.isArray(plan.phases)) {
      return NextResponse.json(
        { error: 'Invalid plan structure: missing phases array' },
        { status: 500 }
      );
    }

    if (plan.phases.length === 0) {
      return NextResponse.json(
        { error: 'Invalid plan: no phases generated' },
        { status: 500 }
      );
    }

    // 9. Validate each phase
    for (const phase of plan.phases) {
      if (!phase.id || !phase.title || !phase.order || !Array.isArray(phase.tasks)) {
        return NextResponse.json(
          {
            error: 'Invalid phase structure',
            phase: phase.id || 'unknown',
            details: 'Missing required fields: id, title, order, or tasks'
          },
          { status: 500 }
        );
      }

      // Validate tasks
      for (const task of phase.tasks) {
        if (!task.id || !task.title || !task.agent || !task.type) {
          return NextResponse.json(
            {
              error: 'Invalid task structure',
              task: task.id || 'unknown',
              details: 'Missing required fields: id, title, agent, or type'
            },
            { status: 500 }
          );
        }

        // Validate agent type
        const validAgents = ['UI_AGENT', 'DB_AGENT', 'IDE_AGENT', 'BACKEND_AGENT', 'DEPLOY_AGENT'];
        if (!validAgents.includes(task.agent)) {
          return NextResponse.json(
            {
              error: 'Invalid agent type',
              task: task.id,
              agent: task.agent,
              valid: validAgents
            },
            { status: 500 }
          );
        }
      }
    }

    console.log(`[Plan Project] Generated plan with ${plan.phases.length} phases`);

    // 10. Return validated plan
    return NextResponse.json({
      plan,
      metadata: {
        projectId,
        userId: user.uid,
        phasesCount: plan.phases.length,
        tasksCount: plan.phases.reduce((sum, p) => sum + p.tasks.length, 0),
        generatedAt: new Date().toISOString(),
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Plan Project] Error:', error);

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
