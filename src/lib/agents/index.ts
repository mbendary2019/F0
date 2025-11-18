// src/lib/agents/index.ts
import { TaskClassification, getTaskKindLabel, isCriticalTaskKind } from '@/types/taskKind';
import { recordTokenUsage, estimateTokens } from './tokenUsage';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

type AgentVisible = string;
type NextAction = {
  type: 'preflight' | 'execute_task' | 'wait_for_info';
  why: string;
  phase?: number;
  taskTitle?: string;
};

type AgentPlan = {
  lang: 'ar' | 'en';
  ready: boolean;
  intent: 'clarify' | 'plan' | 'execute';
  clarity_score: number;
  missing?: string[];
  assumptions?: {
    frontend?: string;
    backend?: string;
    db?: string;
    auth?: string;
    payments?: string;
    platforms?: string[];
  };
  next_actions?: NextAction[];
  phases?: { title: string; tasks: { title: string; desc?: string; tags?: string[] }[] }[];
};

export type AgentReply = {
  visible: AgentVisible;
  plan?: AgentPlan;
  ready: boolean;
  intent: 'clarify' | 'plan' | 'execute';
  clarity_score: number;
  missing?: string[];
  next_actions?: NextAction[];
};

function detectLang(s: string) {
  return /[\u0600-\u06FF]/.test(s) ? 'ar' : 'en';
}

const SPEC_JSON = `
{
  "lang": "ar|en",
  "summary": "ملخص سطرين واضحين لطلب المستخدم",
  "ready": true|false,
  "intent": "clarify|plan|execute",
  "clarity_score": 0.0-1.0,
  "missing": ["only CRITICAL missing info - keep minimal"],
  "assumptions": {
    "frontend": "Next.js 14 + TypeScript",
    "backend": "Firebase Functions v2",
    "db": "Firestore",
    "auth": "Firebase Auth",
    "payments": "Stripe",
    "platforms": ["web","mobile-responsive"],
    "structure": "Monorepo with shared packages"
  },
  "next_actions": [
    { "type": "preflight", "why": "تأكد من المفاتيح والخدمات" },
    { "type": "execute_task", "phase": 1, "taskTitle": "تهيئة Firebase", "why": "البداية الأساسية" }
  ],
  "phases": [
    {
      "title": "Phase 1 — التحضير",
      "tasks": [
        { "title": "تهيئة Firebase", "desc": "إنشاء مشروع وتفعيل Auth/Firestore", "tags": ["firebase","setup"] },
        { "title": "إعداد .env", "desc": "وضع المفاتيح الضرورية", "tags": ["devops"] }
      ]
    }
  ]
}

IMPORTANT RULES:
1. INTENT DETERMINATION:
   - If user says "execute/نفّذ/ابدأ/run" → intent:"execute" (force ready:true)
   - If clarity_score >= 0.6 → intent:"plan" with ready:true and assumptions
   - If clarity_score >= 0.8 → intent:"execute"
   - If vague/casual → intent:"plan" with smart assumptions (NOT clarify)

2. READY & CLARITY:
   - ready:true if clarity >= 0.5 (lower threshold - be optimistic!)
   - Include "assumptions" object with smart defaults
   - Only set ready:false if absolutely no context
   - Force ready:true if user says execute command

3. ASSUMPTIONS (NEW):
   - ALWAYS include assumptions object for clarity < 0.8
   - Fill with intelligent defaults based on context
   - Mention assumptions in visible response

4. NEXT_ACTIONS:
   - Always provide next_actions array
   - For intent:"execute" → ["preflight", "execute_task"]
   - For intent:"plan" → ["preflight", "execute_task"] (ready to go!)
   - Rarely use "wait_for_info" - prefer assumptions

5. PHASES & TASKS:
   - Include "phases" if ready:true (even with assumptions)
   - Always add relevant "tags": ["firebase","typescript","nextjs","api","ui","refactor","test"]
   - Tags help route tasks to best AI provider (GPT/Claude/Gemini)
`;

function extractF0JsonBlock(content: string): AgentPlan | undefined {
  const m = content.match(/```f0json\s*([\s\S]*?)```/i);
  if (!m) return;
  try {
    const obj = JSON.parse(m[1]);
    // Validate required fields
    if (obj && typeof obj.ready === 'boolean' && typeof obj.clarity_score === 'number' && obj.intent) {
      return obj as AgentPlan;
    }
  } catch {}
  return;
}

function stripF0Json(content: string): string {
  return content.replace(/```f0json[\s\S]*?```/gi, '').trim();
}

export async function askAgent(userText: string, ctx: { projectId: string; brief?: string; techStack?: any; memory?: any; lang?: 'ar' | 'en'; taskClassification?: TaskClassification }): Promise<AgentReply> {
  // Use provided lang from context, or fallback to auto-detection
  const lang = ctx.lang || detectLang(userText);

  // Build brief context section
  const briefSection = ctx.brief
    ? (lang === 'ar'
        ? `\n**📋 نبذة المشروع المخزنة:**\n${ctx.brief}\n\n**استخدم هذه النبذة كمرجع** لفهم السياق والأهداف.\n`
        : `\n**📋 Stored Project Brief:**\n${ctx.brief}\n\n**Use this brief as reference** to understand context and goals.\n`)
    : '';

  // Build tech stack context section
  const techStackSection = ctx.techStack
    ? (lang === 'ar'
        ? `\n**🔧 التقنيات المستخدمة (Tech Stack Analysis):**\n` +
          `- نوع المشروع: ${ctx.techStack.projectType}\n` +
          `- الإطار: ${ctx.techStack.framework?.name} (${ctx.techStack.framework?.language})\n` +
          `- الميزات المكتشفة:\n` +
          `  ${ctx.techStack.features?.hasAuth ? '✅' : '❌'} Auth\n` +
          `  ${ctx.techStack.features?.hasFirebase ? '✅' : '❌'} Firebase\n` +
          `  ${ctx.techStack.features?.hasStripe ? '✅' : '❌'} Stripe\n` +
          `  ${ctx.techStack.features?.hasTailwind ? '✅' : '❌'} Tailwind CSS\n` +
          `  ${ctx.techStack.features?.hasShadcn ? '✅' : '❌'} shadcn/ui\n` +
          `  ${ctx.techStack.features?.hasBackendApi ? '✅' : '❌'} Backend API\n\n` +
          `**استخدم هذه المعلومات** لتوليد مهام متوافقة مع التقنيات الموجودة.\n`
        : `\n**🔧 Detected Tech Stack:**\n` +
          `- Project Type: ${ctx.techStack.projectType}\n` +
          `- Framework: ${ctx.techStack.framework?.name} (${ctx.techStack.framework?.language})\n` +
          `- Detected Features:\n` +
          `  ${ctx.techStack.features?.hasAuth ? '✅' : '❌'} Auth\n` +
          `  ${ctx.techStack.features?.hasFirebase ? '✅' : '❌'} Firebase\n` +
          `  ${ctx.techStack.features?.hasStripe ? '✅' : '❌'} Stripe\n` +
          `  ${ctx.techStack.features?.hasTailwind ? '✅' : '❌'} Tailwind CSS\n` +
          `  ${ctx.techStack.features?.hasShadcn ? '✅' : '❌'} shadcn/ui\n` +
          `  ${ctx.techStack.features?.hasBackendApi ? '✅' : '❌'} Backend API\n\n` +
          `**Use this information** to generate tasks compatible with existing tech stack.\n`)
    : '';

  // Build memory context section
  const memorySection = ctx.memory
    ? (lang === 'ar'
        ? `\n**🧠 ذاكرة المشروع (Project Memory - Revision ${ctx.memory.revision || 1}):**\n` +
          (ctx.memory.summary ? `**📝 الملخص:**\n${ctx.memory.summary}\n\n` : '') +
          (ctx.memory.architectureNotes ? `**🏗️ القرارات المعمارية:**\n${ctx.memory.architectureNotes}\n\n` : '') +
          (ctx.memory.codingGuidelines ? `**💻 قواعد البرمجة:**\n${ctx.memory.codingGuidelines}\n\n` : '') +
          (ctx.memory.uiUxGuidelines ? `**🎨 قواعد التصميم:**\n${ctx.memory.uiUxGuidelines}\n\n` : '') +
          (ctx.memory.knownIssues && ctx.memory.knownIssues.length > 0
            ? `**⚠️ المشاكل المعروفة:**\n${ctx.memory.knownIssues.map((i: string) => `- ${i}`).join('\n')}\n\n`
            : '') +
          (ctx.memory.importantLinks && ctx.memory.importantLinks.length > 0
            ? `**🔗 روابط مهمة:**\n${ctx.memory.importantLinks.map((link: string) => `- ${link}`).join('\n')}\n\n`
            : '') +
          `**⚠️ مهم جداً:** لا تتعارض مع القرارات المعمارية أو القواعد المذكورة في الذاكرة.\n` +
          `**⚠️ مهم جداً:** استخدم نفس التقنيات والأنماط المذكورة، ولا تقترح بدائل إلا إذا طلب المستخدم ذلك صراحة.\n`
        : `\n**🧠 Project Memory (Revision ${ctx.memory.revision || 1}):**\n` +
          (ctx.memory.summary ? `**📝 Summary:**\n${ctx.memory.summary}\n\n` : '') +
          (ctx.memory.architectureNotes ? `**🏗️ Architecture Decisions:**\n${ctx.memory.architectureNotes}\n\n` : '') +
          (ctx.memory.codingGuidelines ? `**💻 Coding Guidelines:**\n${ctx.memory.codingGuidelines}\n\n` : '') +
          (ctx.memory.uiUxGuidelines ? `**🎨 UI/UX Guidelines:**\n${ctx.memory.uiUxGuidelines}\n\n` : '') +
          (ctx.memory.knownIssues && ctx.memory.knownIssues.length > 0
            ? `**⚠️ Known Issues:**\n${ctx.memory.knownIssues.map((i: string) => `- ${i}`).join('\n')}\n\n`
            : '') +
          (ctx.memory.importantLinks && ctx.memory.importantLinks.length > 0
            ? `**🔗 Important Links:**\n${ctx.memory.importantLinks.map((link: string) => `- ${link}`).join('\n')}\n\n`
            : '') +
          `**⚠️ CRITICAL:** Do NOT contradict architecture decisions or guidelines listed in memory.\n` +
          `**⚠️ CRITICAL:** Use the same technologies and patterns mentioned above, do NOT suggest alternatives unless explicitly requested.\n`)
    : (lang === 'ar'
        ? `\n**🧠 ذاكرة المشروع:** (لا توجد ذاكرة مسجلة بعد - يمكن إضافتها من إعدادات المشروع)\n`
        : `\n**🧠 Project Memory:** (no memory document yet - can be added from project settings)\n`);

  // Build task classification section (Phase 76)
  const taskClassificationSection = ctx.taskClassification
    ? (lang === 'ar'
        ? `\n**🎯 تصنيف المهمة (Task Classification):**\n` +
          `- نوع المهمة: ${getTaskKindLabel(ctx.taskClassification.taskKind, 'ar')}\n` +
          `- دقة التصنيف: ${(ctx.taskClassification.confidence * 100).toFixed(0)}%\n` +
          `- السبب: ${ctx.taskClassification.reasoning}\n\n` +
          `**بناءً على هذا التصنيف، يجب عليك:**\n` +
          (ctx.taskClassification.taskKind === 'bug_fix'
            ? `- التركيز على إصلاح الكود الموجود، وليس إضافة ميزات جديدة\n- استخدام تعديلات دقيقة (patch-based editing)\n- عدم إعادة هيكلة أجزاء غير متعلقة بالمشكلة\n`
            : ctx.taskClassification.taskKind === 'code_gen' || ctx.taskClassification.taskKind === 'ui_gen'
            ? `- إنشاء كود جديد من الصفر\n- اتباع أفضل الممارسات والمعايير المذكورة في الذاكرة\n- إنشاء ملفات ومكونات جديدة حسب الحاجة\n`
            : ctx.taskClassification.taskKind === 'code_edit'
            ? `- تعديل الكود الموجود بعناية\n- الحفاظ على البنية والأنماط الحالية\n- عدم إضافة ميزات غير مطلوبة\n`
            : ctx.taskClassification.taskKind === 'doc_explain'
            ? `- تقديم شرح واضح ومفصل\n- استخدام أمثلة عملية\n- عدم تعديل الكود إلا إذا طُلب منك ذلك\n`
            : `- فهم طلب المستخدم بدقة\n- تقديم رد مناسب لنوع المهمة\n`)
        : `\n**🎯 Task Classification:**\n` +
          `- Task Kind: ${getTaskKindLabel(ctx.taskClassification.taskKind, 'en')}\n` +
          `- Confidence: ${(ctx.taskClassification.confidence * 100).toFixed(0)}%\n` +
          `- Reasoning: ${ctx.taskClassification.reasoning}\n\n` +
          `**Based on this classification, you MUST:**\n` +
          (ctx.taskClassification.taskKind === 'bug_fix'
            ? `- Focus on fixing existing code, NOT generating new features\n- Prefer minimal, patch-based editing\n- Do NOT refactor unrelated parts\n`
            : ctx.taskClassification.taskKind === 'code_gen' || ctx.taskClassification.taskKind === 'ui_gen'
            ? `- Generate brand new code from scratch\n- Follow best practices and standards mentioned in memory\n- Create new files and components as needed\n`
            : ctx.taskClassification.taskKind === 'code_edit'
            ? `- Edit existing code carefully\n- Maintain current structure and patterns\n- Do NOT add unrequested features\n`
            : ctx.taskClassification.taskKind === 'doc_explain'
            ? `- Provide clear and detailed explanation\n- Use practical examples\n- Do NOT modify code unless explicitly asked\n`
            : `- Understand user request accurately\n- Provide appropriate response for task type\n`))
    : '';

  const sys =
    lang === 'ar'
      ? `أنت Agent تنفيذي محترف متخصص في تخطيط وتنفيذ المشاريع البرمجية.${briefSection}${techStackSection}${memorySection}${taskClassificationSection}

**منهجك (Method):**
1. **افهم** - لخّص طلب المستخدم في سطرين واضحين
2. **افترض** - حدد افتراضات ذكية للجوانب الغامضة
3. **خطط** - أنتج خطة تفصيلية 5-8 مراحل فوراً
4. **وضّح** - اذكر الافتراضات بوضوح (قابلة للتعديل)

**قواعد الرد:**
- اكتب ردًا أنيقًا بالعربية الرشيقة (عناوين + نقاط)
- لا تكتب جُمل إدارية مثل: "تم تلخيص الطلب" أو "فهمت طلبك"
- كن مباشرًا ومحترفًا ومنتجاً

**إذا الطلب غير واضح أو ناقص:**
- **لا تسأل أسئلة كثيرة** - افترض الأفضل واستمر!
- اقترح **خطة كاملة فوراً** بافتراضات ذكية معقولة
- أضف قسم "📋 افتراضات قابلة للتعديل" يحتوي على:
  - **التقنيات:** Next.js 14 + TypeScript + Firebase + Stripe
  - **المنصات:** Web أولاً، Mobile-responsive
  - **المتطلبات:** Auth + Firestore + Payments
  - **البنية:** Monorepo مع shared packages
- أنتج خطة 5-8 مراحل كاملة بناءً على الافتراضات
- اذكر: "💡 يمكنك تعديل الافتراضات من إعدادات المشروع"
- **الأهم:** ارجع ready:true مع phases كاملة!

**إذا الطلب واضح ومكتمل:**
- أخرج خطة تفصيلية من 5-8 مراحل على الأقل.
- كل مرحلة تحتوي 4-8 مهام قصيرة بصيغة فعل.
- كل مهمة يجب أن تحتوي على:
  - **title**: عنوان قصير بصيغة فعل (مثال: "إنشاء مشروع Next.js")
  - **desc**: معايير القبول والمخرجات المتوقعة بوضوح
  - **tags**: مصفوفة من التقنيات/المجالات (مثل: ["nextjs","firebase","auth","typescript"])
  - **deps**: المعتمدات (اختياري)

**مثال على مهمة جيدة:**
\`\`\`json
{
  "title": "تهيئة Firebase Authentication",
  "desc": "إنشاء مشروع Firebase، تفعيل Auth (Email/Google)، إضافة المفاتيح لـ .env.local، اختبار تسجيل الدخول",
  "tags": ["firebase", "auth", "setup"]
}
\`\`\`

في نهاية الرسالة، ضَع خطة تقنية مخفية في بلوك \`\`\`f0json\`\`\` على شكل JSON بالمواصفات التالية:
${SPEC_JSON}`
      : `You are a senior product/tech assistant specialized in planning and executing software projects.${briefSection}${techStackSection}${memorySection}${taskClassificationSection}

**Response Rules:**
- Write a clean, professional Markdown response in English (headings + bullets).
- Do NOT include meta phrases like "I have summarized..." or "I understood your request".
- Be direct and professional.

**If the request is unclear or incomplete:**
- Ask very specific questions to determine:
  - End goals
  - Preferred technologies
  - Target platforms (web/mobile/desktop)
  - Essential requirements (auth/database/api/payments)
  - Required API Keys or external services
- Clearly state what you need to start planning and execution.

**If the request is clear and complete:**
- Output a detailed plan with 5-8 phases minimum.
- Each phase contains 4-8 short tasks in imperative form.
- Each task must include:
  - **title**: Short imperative title (e.g., "Create Next.js project")
  - **desc**: Clear acceptance criteria and expected outputs
  - **tags**: Array of technologies/domains (e.g., ["nextjs","firebase","auth","typescript"])
  - **deps**: Dependencies (optional)

**Example of a good task:**
\`\`\`json
{
  "title": "Setup Firebase Authentication",
  "desc": "Create Firebase project, enable Auth (Email/Google), add keys to .env.local, test login",
  "tags": ["firebase", "auth", "setup"]
}
\`\`\`

At the END, include a hidden technical plan inside a \`\`\`f0json\`\`\` block using this JSON spec:
${SPEC_JSON}`;

  const body = {
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    temperature: 0.2,
    max_tokens: 2000,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: `Project ID: ${ctx.projectId}\n\nUser request:\n${userText}` },
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
    throw new Error(`OpenAI request failed (${res.status}): ${errTxt}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';

  // Phase 77: Track token usage
  const usage = data.usage;
  if (usage) {
    try {
      await recordTokenUsage({
        projectId: ctx.projectId,
        model: body.model,
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        provider: 'openai',
      });
    } catch (error) {
      console.error('[Token Usage] Failed to record usage:', error);
      // Don't fail the request if usage tracking fails
    }
  }

  const plan = extractF0JsonBlock(content);
  const visible = stripF0Json(content);

  // Extract key fields for easy access
  const ready = plan?.ready ?? false;
  const intent = plan?.intent ?? 'clarify';
  const clarity_score = plan?.clarity_score ?? 0;
  const missing = plan?.missing;
  const next_actions = plan?.next_actions;

  return { visible, plan, ready, intent, clarity_score, missing, next_actions };
}
