// src/lib/agents/taskClassifier.ts
// Phase 76: Task Classification System - LLM-based Classifier

import { TaskClassification, TaskKind } from '@/types/taskKind';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export interface TaskClassifierInput {
  message: string;              // User's latest message
  locale: string;               // 'ar' | 'en'
  projectType?: string;         // From projectAnalysis (optional)
  hasUi?: boolean;              // UI features detected
  hasBackendApi?: boolean;      // Backend API detected
}

/**
 * Classify user message using a small, fast LLM
 */
export async function classifyUserMessage(
  input: TaskClassifierInput
): Promise<TaskClassification> {
  const systemPrompt = `You are a task classifier for an AI coding assistant (F0).
User messages can be in Arabic or English.

Your job: map the user's latest message to ONE task kind.

Valid task kinds:
- code_gen: Generate new code/files/features from scratch
- code_edit: Edit existing code (minor changes, updates)
- bug_fix: Fix specific bugs, errors, or runtime issues
- refactor: Improve/reorganize existing code without changing behavior
- ui_gen: Generate UI components, pages, or interfaces
- agent_plan: Planning phases, tasks, or architecture decisions
- doc_explain: Explain code, write documentation, or answer "what does this do?"
- summary: Summarize or analyze existing code/project
- parse: Extract or transform data
- config_update: Change settings, env vars, build config, dependencies
- questions: General questions about the project or technology
- chat: General casual conversation not related to coding tasks
- unknown: Cannot determine the task type

**IMPORTANT RULES:**
1. If user mentions an ERROR or BUG → bug_fix
2. If user asks to CREATE/BUILD something NEW → code_gen or ui_gen
3. If user asks to CHANGE/UPDATE existing code → code_edit
4. If user asks "explain" or "what is" → doc_explain
5. If user asks to PLAN or lists requirements → agent_plan
6. If user is just chatting casually → chat

Return STRICT JSON only:
{ "taskKind": "...", "confidence": 0.0-1.0, "reasoning": "..." }

No extra text. No markdown. Just JSON.`;

  const userPrompt = `Message:
"${input.message}"

Project context:
- Type: ${input.projectType || 'unknown'}
- Has UI: ${input.hasUi ? 'yes' : 'no'}
- Has Backend API: ${input.hasBackendApi ? 'yes' : 'no'}
- Language: ${input.locale}

Classify this message.`;

  try {
    const body = {
      model: process.env.OPENAI_MODEL_MINI || 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 200,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    };

    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errTxt = await res.text().catch(() => '');
      throw new Error(`OpenAI classifier request failed (${res.status}): ${errTxt}`);
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';

    // Parse JSON response
    let parsed: any;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.warn('[Task Classifier] Failed to parse JSON, using fallback', content);
      parsed = {
        taskKind: 'unknown',
        confidence: 0.2,
        reasoning: 'Failed to parse classification response',
      };
    }

    // Validate taskKind
    const validTaskKinds: TaskKind[] = [
      'code_gen',
      'code_edit',
      'bug_fix',
      'refactor',
      'ui_gen',
      'agent_plan',
      'doc_explain',
      'summary',
      'parse',
      'config_update',
      'questions',
      'chat',
      'unknown',
    ];

    const taskKind: TaskKind = validTaskKinds.includes(parsed.taskKind)
      ? parsed.taskKind
      : 'unknown';

    const classification: TaskClassification = {
      taskKind,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning || 'No reasoning provided',
      rawLabel: parsed.taskKind,
    };

    console.log('[Task Classifier]', classification);

    return classification;
  } catch (error: any) {
    console.error('[Task Classifier] Error:', error);

    // Fallback: simple keyword-based classification
    return fallbackClassifier(input.message);
  }
}

/**
 * Fallback keyword-based classifier when LLM fails
 */
function fallbackClassifier(message: string): TaskClassification {
  const lower = message.toLowerCase();

  // Bug/Error detection
  if (
    lower.includes('error') ||
    lower.includes('bug') ||
    lower.includes('fix') ||
    lower.includes('خطأ') ||
    lower.includes('مشكلة') ||
    lower.includes('صلّح')
  ) {
    return {
      taskKind: 'bug_fix',
      confidence: 0.7,
      reasoning: 'Keyword-based: detected error/bug/fix keywords',
    };
  }

  // Create/Build detection
  if (
    lower.includes('create') ||
    lower.includes('build') ||
    lower.includes('add') ||
    lower.includes('new') ||
    lower.includes('إنشاء') ||
    lower.includes('أضف') ||
    lower.includes('جديد')
  ) {
    if (
      lower.includes('ui') ||
      lower.includes('page') ||
      lower.includes('component') ||
      lower.includes('صفحة') ||
      lower.includes('واجهة')
    ) {
      return {
        taskKind: 'ui_gen',
        confidence: 0.65,
        reasoning: 'Keyword-based: create + UI keywords',
      };
    }
    return {
      taskKind: 'code_gen',
      confidence: 0.65,
      reasoning: 'Keyword-based: create/build keywords',
    };
  }

  // Edit/Update detection
  if (
    lower.includes('change') ||
    lower.includes('update') ||
    lower.includes('modify') ||
    lower.includes('edit') ||
    lower.includes('غيّر') ||
    lower.includes('عدّل')
  ) {
    return {
      taskKind: 'code_edit',
      confidence: 0.65,
      reasoning: 'Keyword-based: change/update keywords',
    };
  }

  // Explain detection
  if (
    lower.includes('explain') ||
    lower.includes('what') ||
    lower.includes('how') ||
    lower.includes('اشرح') ||
    lower.includes('ما هو') ||
    lower.includes('كيف')
  ) {
    return {
      taskKind: 'doc_explain',
      confidence: 0.6,
      reasoning: 'Keyword-based: question/explain keywords',
    };
  }

  // Plan detection
  if (
    lower.includes('plan') ||
    lower.includes('design') ||
    lower.includes('architecture') ||
    lower.includes('خطة') ||
    lower.includes('تصميم')
  ) {
    return {
      taskKind: 'agent_plan',
      confidence: 0.6,
      reasoning: 'Keyword-based: planning keywords',
    };
  }

  // Default: unknown
  return {
    taskKind: 'unknown',
    confidence: 0.3,
    reasoning: 'Keyword-based: no clear keywords matched',
  };
}
