import { NextRequest, NextResponse } from 'next/server';
import { askAgent } from '@/lib/agents';
import { classifyIntent, getSmallTalkResponse, getNeedBriefResponse, generateAutoBrief } from '@/lib/helpers/intent';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

    // Step 3: Check if project has brief (for plan/execute intents)
    let brief = '';
    if (intent === 'plan' || intent === 'execute') {
      try {
        const projectDoc = await getDoc(doc(db, `projects/${projectId}`));
        if (projectDoc.exists()) {
          brief = projectDoc.data()?.context?.brief || '';
        }
      } catch (e) {
        // If Firestore fails, continue without brief
        console.warn('Failed to fetch project brief:', e);
      }

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
    }

    // Step 5: Call agent with brief context and language preference
    const reply = await askAgent(text, { projectId, brief, lang });

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
        next_actions: reply.next_actions || []
      },
      plan: responsePlan
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
