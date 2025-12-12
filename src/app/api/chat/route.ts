import { NextRequest, NextResponse } from 'next/server';
import { askAgent } from '@/lib/agents';
import { classifyIntent, getSmallTalkResponse, getNeedBriefResponse, generateAutoBrief } from '@/lib/helpers/intent';
import { classifyUserMessage } from '@/lib/agents/taskClassifier';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { runPatchApply, previewPatch } from '@/lib/agents/patch/orchestrator';
import { shouldUsePatchMode } from '@/lib/agents/patch/usePatchMode';
// Phase 109.6: Unified AI Logs
import { logAiOperation, type AiLogMode } from '@/lib/server/aiLogs';

export async function POST(req: NextRequest) {
  try {
    const { projectId, text, locale } = await req.json();
    if (!projectId || !text) {
      return NextResponse.json({ error: 'Missing projectId or text' }, { status: 422 });
    }

    // Get language from multiple sources (priority: header > body > auto-detect)
    const headerLang = req.headers.get('x-lang') as 'ar' | 'en' | null;
    const bodyLang = locale as 'ar' | 'en' | undefined;
    const autoDetect = /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en';
    const lang = headerLang || bodyLang || autoDetect;

    // Step 1: Classify intent BEFORE calling agent
    const intent = classifyIntent(text);

    // Step 2: Handle small talk without calling agent
    if (intent === 'smalltalk') {
      return NextResponse.json({
        message: {
          text: getSmallTalkResponse(lang),
          id: crypto.randomUUID(),
          role: 'assistant',
          createdAt: Date.now()
        },
        meta: {
          intent: 'smalltalk',
          ready: false,
          clarity: 0,
          missing: ['project_brief'],
          next_actions: []
        },
        plan: null
      });
    }

    // Step 3: Check if project has brief, tech stack analysis, and memory (for plan/execute intents)
    let brief = '';
    let techStack = null;
    let memory = null;
    if (intent === 'plan' || intent === 'execute') {
      try {
        const projectDoc = await getDoc(doc(db, `projects/${projectId}`));
        if (projectDoc.exists()) {
          const data = projectDoc.data();
          brief = data?.context?.brief || '';
          techStack = data?.projectAnalysis || null;
          memory = data?.projectMemory || null;
        }
      } catch (e) {
        // If Firestore fails, continue without brief/techStack/memory
        console.warn('Failed to fetch project data:', e);
      }
    }

    // Step 3.5: Classify task kind using LLM (Phase 76)
    const taskClassification = await classifyUserMessage({
      message: text,
      locale: lang,
      projectType: techStack?.projectType,
      hasUi: !!techStack?.features?.hasTailwind || !!techStack?.features?.hasShadcn,
      hasBackendApi: !!techStack?.features?.hasBackendApi,
    });

    // Step 4: If no brief, generate intelligent brief from user text
    if (!brief || brief.length < 15) {
      brief = generateAutoBrief(text, lang);

      // Save auto-generated brief to Firestore
      try {
        await setDoc(
          doc(db, `projects/${projectId}`),
          {
            context: { brief, lang, origin: 'auto-generated' },
            updatedAt: Date.now()
          },
          { merge: true }
        );
        console.log(`✅ Auto-generated brief for project ${projectId}: ${brief}`);
      } catch (e) {
        console.warn('Failed to save auto-generated brief:', e);
      }
    }

    // Step 5: Call agent with brief, tech stack, memory context, task classification, and language preference
    const reply = await askAgent(text, { projectId, brief, techStack, memory, lang, taskClassification });

    // Step 6: Check if we should use patch mode and detect patches in response
    let patchResult = null;
    if (shouldUsePatchMode(taskClassification.taskKind)) {
      console.log(`[Chat API] Patch mode enabled for task kind: ${taskClassification.taskKind}`);

      try {
        // Preview patch to check if valid
        const preview = await previewPatch({
          projectId,
          modelOutput: reply.raw || reply.visible,
          originalRequest: text,
          locale: lang,
          taskKind: taskClassification.taskKind,
        });

        if (preview.success && preview.patches) {
          console.log(`[Chat API] Detected ${preview.patches.length} patch(es) in response`);

          // For now, we just track the patches - actual application will come later
          // when we have file system integration
          patchResult = {
            success: true,
            patchCount: preview.patches.length,
            patches: preview.patches.map(p => ({
              filePath: p.filePath,
              hunksCount: p.hunks.length,
              isNew: p.isNew ?? false,
              isDeleted: p.isDeleted ?? false,
            })),
          };
        }
      } catch (error: any) {
        console.error('[Chat API] Patch detection failed:', error);
        // Don't fail the entire request if patch detection fails
      }
    }

    // Step 7: Log AI operation (Phase 109.6 unified logging)
    // Map taskKind to AiLogMode
    const aiLogMode: AiLogMode =
      reply.intent === 'plan' ? 'plan' :
      patchResult?.success ? 'refactor' :
      taskClassification.taskKind === 'analysis' ? 'explain' :
      'chat';

    // Build summary
    let summary = text.slice(0, 100);
    if (reply.intent === 'plan' && reply.ready) {
      summary = `Generated plan: ${brief.slice(0, 80)}`;
    } else if (patchResult?.success) {
      summary = `Applied ${patchResult.patchCount} patch(es): ${patchResult.patches.map((p: any) => p.filePath).join(', ').slice(0, 80)}`;
    }

    // Log async, non-blocking
    logAiOperation({
      origin: 'web-ide',
      projectId,
      mode: aiLogMode,
      success: true,
      summary,
      message: text,
      metadata: {
        taskKind: taskClassification.taskKind,
        patchCount: patchResult?.patchCount || 0,
        intent: reply.intent,
        ready: reply.ready,
      },
    }).catch(err => console.error('[Chat API] Failed to save AI log:', err));

    // Only include phases in plan if ready=true
    const responsePlan = reply.ready && reply.plan?.phases
      ? reply.plan
      : { ...reply.plan, phases: undefined };

    return NextResponse.json({
      message: {
        text: reply.visible,
        id: crypto.randomUUID(),
        role: 'assistant',
        createdAt: Date.now()
      },
      meta: {
        intent: reply.intent,
        ready: reply.ready,
        clarity: reply.clarity_score,
        missing: reply.missing || [],
        next_actions: reply.next_actions || [],
        // Phase 76: Include task classification in response
        taskKind: taskClassification.taskKind,
        taskConfidence: taskClassification.confidence,
        taskReasoning: taskClassification.reasoning,
        // Phase 81: Include patch result if detected
        patchResult,
      },
      plan: responsePlan
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
