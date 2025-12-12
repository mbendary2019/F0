// src/app/api/agent/run/route.ts
import { NextResponse } from 'next/server';
import { askAgent } from '@/lib/agents';
import { askProjectAgent } from '@/lib/agent/askProjectAgent';
import { askConversationalAgentWithArchitect } from '@/lib/agent/conversationalAgentWithArchitect';
import { adminDb } from '@/lib/firebaseAdmin';
import type { ProjectContext } from '@/types/project';
// Phase 98.3: Template Kickoff Context
import {
  getTemplateKickoffState,
  getTemplateData,
  buildTemplateKickoffInstructions,
  buildTemplateReferenceContext,
} from '@/lib/server/templateKickoff';

/**
 * Detect language from text (Arabic vs English)
 */
function detectLanguage(text: string): 'ar' | 'en' {
  // Check for Arabic characters (Unicode range U+0600 to U+06FF)
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  return hasArabic ? 'ar' : 'en';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      projectId,
      intent,
      message,
      userId,
      useOpsCollection = true, // Default to ops_projects (new collection)
    }: {
      projectId: string;
      intent: string;
      message: string;
      userId?: string;
      useOpsCollection?: boolean;
    } = body;

    // Determine which collection to use
    const collectionName = useOpsCollection ? 'ops_projects' : 'projects';

    console.log('[AGENT] Incoming request:', { projectId, intent, message, collectionName });

    // Auto-detect language from user message
    const detectedLang = detectLanguage(message);
    console.log('[AGENT] Detected language:', detectedLang);

    // Phase 98 Step 2: Load conversation history
    const messagesRef = adminDb
      .collection(collectionName)
      .doc(projectId)
      .collection('agent_messages');

    const historySnapshot = await messagesRef
      .orderBy('createdAt', 'asc')
      .limit(20) // Last 20 messages
      .get();

    const conversationHistory = historySnapshot.docs.map((doc) => ({
      role: doc.data().role as 'user' | 'assistant',
      content: doc.data().content,
    }));

    console.log('[AGENT] Loaded conversation history:', conversationHistory.length, 'messages');

    // Phase 98 & 99: Load project metadata to give agent context
    let projectContext: ProjectContext | undefined;
    let projectContextString: string | undefined;

    try {
      const projectDoc = await adminDb.collection(collectionName).doc(projectId).get();
      const projectData = projectDoc.data();

      if (projectData) {
        // Phase 98 context (backward compatible)
        projectContext = {
          name: projectData.name || projectId,
          appTypes: projectData.appTypes || ['web'],
          mobileTargets: projectData.mobileTargets || [],
          desktopTargets: projectData.desktopTargets || [],
          infraType: projectData.infraType || projectData.infrastructure || 'firebase',
        };

        // Phase 99: Build detailed project context string
        projectContextString = buildProjectContextSummary({
          name: projectData.name,
          projectType: projectData.projectType,
          platforms: projectData.platforms,
          framework: projectData.framework,
        });

        console.log('[AGENT] Project context loaded:', projectContext);
        console.log('[AGENT] Project context string:', projectContextString);
      }
    } catch (err) {
      console.error('[AGENT] Failed to load project context:', err);
      // Continue without project context if loading fails
    }

    // Phase 98.3: Load template context if project was created from template
    let templateContext: string | undefined;
    try {
      const templateState = await getTemplateKickoffState(projectId);

      if (templateState?.createdFromTemplate) {
        const templateSlug = templateState.createdFromTemplate;
        console.log('[AGENT] Project has template:', templateSlug, 'kickoff done:', templateState.kickoff.done);

        const templateData = await getTemplateData(templateSlug);

        if (templateData) {
          if (!templateState.kickoff.done) {
            // Full kickoff instructions for new template projects
            templateContext = buildTemplateKickoffInstructions({
              templateSlug,
              templateTitle: templateData.title || templateSlug,
              templateTitleAr: templateData.titleAr,
              templateSummary: templateData.summary || templateData.description || '',
              templateSummaryAr: templateData.summaryAr,
              templatePlan: templateData.plan || templateData.fullDescription,
              templatePlanAr: templateData.planAr,
              targetUsers: templateData.targetUsers,
              platforms: templateData.platforms || [],
              techStack: templateData.techStack || [],
              phases: templateData.suggestedPhases || templateData.phases,
              category: templateData.category,
              difficulty: templateData.difficulty,
              estimatedMvpDays: templateData.estimatedMvpDays,
            });
            console.log('[AGENT] Template kickoff instructions built');
          } else {
            // Shorter reference context for ongoing work
            templateContext = buildTemplateReferenceContext({
              templateSlug,
              templateTitle: templateData.title || templateSlug,
              techStack: templateData.techStack || [],
              platforms: templateData.platforms || [],
            });
            console.log('[AGENT] Template reference context built');
          }
        }
      }
    } catch (err) {
      console.error('[AGENT] Failed to load template context:', err);
      // Continue without template context if loading fails
    }

    // Build system context based on intent
    let userPrompt = message;
    let forceArchitectMode = false;

    switch (intent) {
      case 'generate-prd':
        userPrompt = detectedLang === 'ar'
          ? `قم بتوليد مستند متطلبات منتج (PRD) كامل لهذا المشروع.\n\nطلب المستخدم: ${message}`
          : `Generate a complete Product Requirements Document (PRD) for this project.\n\nUser request: ${message}`;
        break;
      case 'design-api-db':
        userPrompt = detectedLang === 'ar'
          ? `صمّم واجهات REST API ومخطط قاعدة البيانات لهذا المشروع.\n\nطلب المستخدم: ${message}`
          : `Design REST API endpoints and database schema for this project.\n\nUser request: ${message}`;
        forceArchitectMode = true; // Force architect mode for API/DB design
        break;
      case 'plan-board':
        userPrompt = detectedLang === 'ar'
          ? `قسّم هذا المشروع إلى مراحل ومهام جاهزة للتنفيذ.\n\nطلب المستخدم: ${message}`
          : `Break down this project into phases and tasks ready for execution.\n\nUser request: ${message}`;
        break;
      case 'continue':
      default:
        // Use message as-is for continue mode
        break;
    }

    // Phase 98 Step 2: Save user message to Firestore
    await messagesRef.add({
      role: 'user',
      content: message,
      createdAt: Date.now(),
      lang: detectedLang,
    });

    console.log('[AGENT] User message saved to Firestore');

    // Call agent with Architect Mode support
    // Phase 97.1: Automatically detects if architecture is needed
    // Phase 98: Now includes project context so agent knows app types, infrastructure, etc.
    // Phase 98 Step 4: Pass conversation history to agent
    // Phase 99: Pass project context string for friendly project-aware responses
    const result = await askConversationalAgentWithArchitect({
      projectId,
      userId: userId || 'anonymous',
      userText: userPrompt,
      lang: detectedLang,
      forceArchitectMode,
      projectContext, // Pass project metadata to agent (Phase 98)
      projectContextString, // Pass formatted context string (Phase 99)
      conversationHistory, // Pass conversation history so agent remembers
      templateContext, // Phase 98.3: Pass template context for projects from marketplace
    });

    console.log('[AGENT] Response generated:', {
      mode: result.mode,
      hasArchitectPlan: !!result.architectPlan,
    });

    // Phase 98 Step 2: Save agent response to Firestore
    await messagesRef.add({
      role: 'assistant',
      content: result.visible,
      createdAt: Date.now(),
      lang: detectedLang,
      metadata: {
        mode: result.mode,
        hasArchitectPlan: !!result.architectPlan,
      },
    });

    console.log('[AGENT] Agent response saved to Firestore');

    return NextResponse.json({
      ok: true,
      reply: result.visible,
      ready: result.ready,
      intent: result.intent,
      clarity_score: result.clarity_score,
      plan: result.plan,
      architectPlan: result.architectPlan,
      mode: result.mode,
    });
  } catch (err: any) {
    console.error('[AGENT] Error in /api/agent/run:', err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Phase 99: Build project context summary for agent
 * Creates a human-readable summary of project type, platforms, and tech stack
 */
function buildProjectContextSummary(project: {
  name?: string;
  projectType?: string;
  platforms?: string[];
  framework?: string;
}): string {
  if (!project.projectType && !project.platforms && !project.framework) {
    return '';
  }

  const platforms = project.platforms?.join(' + ') || 'غير محددة';

  const typeLabel: Record<string, string> = {
    'web-app': 'تطبيق ويب',
    'mobile-app': 'تطبيق موبايل',
    'desktop-app': 'تطبيق ديسكتوب',
    'backend-api': 'خدمة API',
    'mixed': 'تطبيق متعدد المنصّات',
  };

  const type = typeLabel[project.projectType || ''] || 'مشروع برمجي';

  const frameworkLabel: Record<string, string> = {
    'nextjs': 'Next.js',
    'react-native': 'React Native',
    'electron': 'Electron',
    'tauri': 'Tauri',
    'node-api': 'Node.js API',
    'other': 'تقنية أخرى',
  };

  const tech = frameworkLabel[project.framework || ''] || 'غير محدد';

  return `
المشروع الحالي في F0:

- نوع المشروع: ${type}
- المنصّات: ${platforms}
- التقنية الأساسية: ${tech}
- اسم المشروع: ${project.name || 'بدون اسم واضح'}

تذكير: لا تفترض وجود بوابة دفع أو لوحة تحكم أو Auth إلا إذا ذكرها المستخدم صراحة.
ابدأ دائمًا بمناقشة الفكرة ثم اقترح خطة تنفيذ تناسب هذا النوع من التطبيقات وهذه المنصّات.
`.trim();
}
