// src/lib/agents/index.ts
import { TaskClassification, getTaskKindLabel, isCriticalTaskKind } from '@/types/taskKind';
import { recordTokenUsage, estimateTokens } from './tokenUsage';
import { classifyProjectIdea } from '@/lib/agent/projectTypes';
import { personasByProjectType } from '@/lib/agent/personas';

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

6. SECURITY RULES (Phase 180.8):
   - NEVER suggest dangerous shell commands like:
     * curl ... | bash
     * wget ... | sh
     * rm -rf /
     * sudo commands
     * Commands that pipe to shell (| bash, | sh)
   - When suggesting CLI commands, use SAFE alternatives:
     * For package installation: npm install <package>, pnpm add <package>
     * For scripts: npm run <script>, pnpm <script>
     * For file operations: use proper file editors, not shell redirects
   - If user asks about dangerous commands, explain the security risk instead
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

// Phase 177: Chat history message type for conversation memory
interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function askAgent(userText: string, ctx: { projectId: string; brief?: string; techStack?: any; memory?: any; lang?: 'ar' | 'en'; taskClassification?: TaskClassification; conversationHistory?: ChatHistoryMessage[] }): Promise<AgentReply> {
  // Classify project type from user message
  const classification = classifyProjectIdea(userText);
  const { projectType } = classification;

  // Use provided lang from context, or fallback to auto-detection
  const lang = ctx.lang || detectLang(userText);

  // Get specialized persona for this project type
  const persona = personasByProjectType[projectType];

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
            ? `- التركيز على إصلاح الكود الموجود، وليس إضافة ميزات جديدة\n- استخدام تعديلات دقيقة (patch-based editing)\n- عدم إعادة هيكلة أجزاء غير متعلقة بالمشكلة\n\n**🔧 وضع الباتش (Patch Mode) - استخدم هذا للتعديلات الدقيقة:**\nبدلاً من إعادة كتابة الملف بالكامل، استخدم صيغة unified diff:\n\`\`\`diff\ndiff --git a/path/to/file.ts b/path/to/file.ts\n--- a/path/to/file.ts\n+++ b/path/to/file.ts\n@@ -10,7 +10,7 @@ function example() {\n   const x = 1;\n   const y = 2;\n-  const result = x + y; // خطأ\n+  const result = x * y; // تصحيح\n   return result;\n }\n\`\`\`\n- استخدم السطور بـ " " (مسافة) للسياق المحيط\n- استخدم "-" للسطور المحذوفة\n- استخدم "+" للسطور الجديدة\n- أضف 3 سطور سياق على الأقل قبل وبعد التغيير\n`
            : ctx.taskClassification.taskKind === 'code_gen' || ctx.taskClassification.taskKind === 'ui_gen'
            ? `- إنشاء كود جديد من الصفر\n- اتباع أفضل الممارسات والمعايير المذكورة في الذاكرة\n- إنشاء ملفات ومكونات جديدة حسب الحاجة\n`
            : ctx.taskClassification.taskKind === 'code_edit'
            ? `- تعديل الكود الموجود بعناية\n- الحفاظ على البنية والأنماط الحالية\n- عدم إضافة ميزات غير مطلوبة\n\n**🔧 وضع الباتش (Patch Mode) - استخدم هذا للتعديلات:**\nبدلاً من إعادة كتابة الملف بالكامل، استخدم صيغة unified diff:\n\`\`\`diff\ndiff --git a/path/to/file.ts b/path/to/file.ts\n--- a/path/to/file.ts\n+++ b/path/to/file.ts\n@@ -15,5 +15,8 @@ export function updateUser() {\n   const user = getUser();\n   user.name = newName;\n+  user.updatedAt = Date.now();\n+  saveUser(user);\n   return user;\n }\n\`\`\`\n`
            : ctx.taskClassification.taskKind === 'refactor'
            ? `- إعادة هيكلة الكود بعناية\n- الحفاظ على السلوك الأصلي\n- تحسين القراءة والصيانة\n\n**🔧 وضع الباتش (Patch Mode) - مفضل للريفاكتورنج:**\nاستخدم unified diff format لإظهار التغييرات بوضوح\n`
            : ctx.taskClassification.taskKind === 'doc_explain'
            ? `- تقديم شرح واضح ومفصل\n- استخدام أمثلة عملية\n- عدم تعديل الكود إلا إذا طُلب منك ذلك\n`
            : `- فهم طلب المستخدم بدقة\n- تقديم رد مناسب لنوع المهمة\n`)
        : `\n**🎯 Task Classification:**\n` +
          `- Task Kind: ${getTaskKindLabel(ctx.taskClassification.taskKind, 'en')}\n` +
          `- Confidence: ${(ctx.taskClassification.confidence * 100).toFixed(0)}%\n` +
          `- Reasoning: ${ctx.taskClassification.reasoning}\n\n` +
          `**Based on this classification, you MUST:**\n` +
          (ctx.taskClassification.taskKind === 'bug_fix'
            ? `- Focus on fixing existing code, NOT generating new features\n- Prefer minimal, patch-based editing\n- Do NOT refactor unrelated parts\n\n**🔧 Patch Mode - Use this for surgical edits:**\nInstead of rewriting entire files, use unified diff format:\n\`\`\`diff\ndiff --git a/path/to/file.ts b/path/to/file.ts\n--- a/path/to/file.ts\n+++ b/path/to/file.ts\n@@ -10,7 +10,7 @@ function example() {\n   const x = 1;\n   const y = 2;\n-  const result = x + y; // bug\n+  const result = x * y; // fixed\n   return result;\n }\n\`\`\`\n- Use " " (space) for surrounding context lines\n- Use "-" for removed lines\n- Use "+" for added lines\n- Include at least 3 context lines before and after changes\n`
            : ctx.taskClassification.taskKind === 'code_gen' || ctx.taskClassification.taskKind === 'ui_gen'
            ? `- Generate brand new code from scratch\n- Follow best practices and standards mentioned in memory\n- Create new files and components as needed\n`
            : ctx.taskClassification.taskKind === 'code_edit'
            ? `- Edit existing code carefully\n- Maintain current structure and patterns\n- Do NOT add unrequested features\n\n**🔧 Patch Mode - Use this for code edits:**\nInstead of rewriting entire files, use unified diff format:\n\`\`\`diff\ndiff --git a/path/to/file.ts b/path/to/file.ts\n--- a/path/to/file.ts\n+++ b/path/to/file.ts\n@@ -15,5 +15,8 @@ export function updateUser() {\n   const user = getUser();\n   user.name = newName;\n+  user.updatedAt = Date.now();\n+  saveUser(user);\n   return user;\n }\n\`\`\`\n`
            : ctx.taskClassification.taskKind === 'refactor'
            ? `- Refactor code carefully\n- Maintain original behavior\n- Improve readability and maintainability\n\n**🔧 Patch Mode - Preferred for refactoring:**\nUse unified diff format to show changes clearly\n`
            : ctx.taskClassification.taskKind === 'doc_explain'
            ? `- Provide clear and detailed explanation\n- Use practical examples\n- Do NOT modify code unless explicitly asked\n`
            : `- Understand user request accurately\n- Provide appropriate response for task type\n`))
    : '';

  // Build system prompt from persona + context sections
  const basePersonaPrompt = lang === 'ar' ? persona.systemPromptAr : persona.systemPromptEn;

  // Add project type hint to help the AI stay focused
  const projectTypeHint = lang === 'ar'
    ? `\n**🎯 نوع المشروع المكتشف: ${projectType}**\nاستخدم هذه المعلومة لتخصيص ردك وتوليد خطة ملائمة.\n`
    : `\n**🎯 Detected Project Type: ${projectType}**\nUse this information to tailor your response and generate an appropriate plan.\n`;

  // Phase 176.5: Strong language enforcement rule - at BEGINNING and END of system prompt
  // Phase 176.11: Added formatting rules for professional text layout
  const languageEnforcementStart = lang === 'ar'
    ? `🚨🚨🚨 **قاعدة اللغة الإلزامية - الأهم على الإطلاق** 🚨🚨🚨

**يجب أن يكون ردك كاملاً بالعربية - بدون استثناء!**

- ✅ اكتب كل شيء بالعربية: الشرح، التحليل، الأسئلة، كل شيء
- ✅ حتى لو الملف أو الكود بالإنجليزية، اشرح بالعربي
- ✅ حتى لو الـ RAG context أو memory بالإنجليزية، رد بالعربي
- ❌ ممنوع الرد بالإنجليزية - نهائياً
- ❌ ممنوع خلط اللغات في الرد

**CRITICAL:** User asked in Arabic. You MUST respond ENTIRELY in Arabic.

📐 **قواعد التنسيق الإلزامية:**
- كل جملة في سطر منفصل (استخدم سطر جديد بعد كل نقطة).
- نقطة في نهاية كل جملة.
- استخدم فقرات قصيرة ومنظمة.
- اترك سطر فارغ بين الفقرات المختلفة.
- استخدم النقاط (•) أو الأرقام للقوائم.
- التنسيق المهني مطلوب - لا تكتب كتلة نص واحدة!

---
`
    : `🚨🚨🚨 **MANDATORY LANGUAGE RULE - TOP PRIORITY** 🚨🚨🚨

**Your ENTIRE response MUST be in English - no exceptions!**

- ✅ Write everything in English: explanations, analysis, questions, everything
- ✅ Even if files or code contain other languages, explain in English
- ✅ Even if RAG context or memory is in another language, respond in English
- ❌ Do NOT respond in other languages
- ❌ Do NOT mix languages in your response

**CRITICAL:** User asked in English. You MUST respond ENTIRELY in English.

📐 **Mandatory Formatting Rules:**
- Each sentence on its own line (use a new line after each period).
- Period at the end of each sentence.
- Use short, organized paragraphs.
- Leave a blank line between different paragraphs.
- Use bullet points (•) or numbers for lists.
- Professional formatting required - do NOT write a single block of text!

---
`;

  // Phase 176.5: ALSO add at the END of the system prompt (LLMs pay more attention to end)
  // Phase 176.11: Added formatting reminder at the end
  const languageEnforcementEnd = lang === 'ar'
    ? `

---
🚨 **تذكير نهائي:**
• رد بالعربي فقط - ممنوع الإنجليزية!
• نسق ردك: كل جملة في سطر، نقطة في الآخر، فقرات منظمة.`
    : `

---
🚨 **FINAL REMINDER:**
• Respond in English only!
• Format your response: each sentence on its own line, period at end, organized paragraphs.`;

  const sys =
    lang === 'ar'
      ? `${languageEnforcementStart}${basePersonaPrompt}${projectTypeHint}${briefSection}${techStackSection}${memorySection}${taskClassificationSection}

**🎭 شخصيتك - مهم جداً:**
أنت صاحب العميل ومساعده التقني، مش روبوت! اتكلم معاه زي ما بتتكلم مع صاحبك:
- **دمك خفيف** - هزّر معاه، استخدم تعليقات ظريفة، خليه يحس إنه بيتكلم مع حد بني آدم
- **شجّعه** - امدح شغله، قوله "ده تمام!" أو "فكرة جامدة!" لما يعمل حاجة حلوة
- **إيجابي** - حتى لو في مشكلة، قول "عادي هنحلها" مش "في مشكلة كبيرة"
- **فاكر كل حاجة** - لو قالك اسمه أو حاجة عن نفسه، افتكرها واستخدمها في الكلام
- **ذكي** - لو سألك عن حاجة قديمة اتكلمتوا عنها، اربطها بالكلام الحالي

**❌ ممنوع:**
- الرسمية الزيادة زي "تم استلام طلبك" أو "جاري المعالجة"
- الردود الطويلة المملة - خليها قصيرة ومفيدة
- تقول "كيف يمكنني مساعدتك" في كل رد - العميل عارف إنك موجود تساعده
- تكرر نفس الكلام في كل رد

**✅ أمثلة على الأسلوب المطلوب:**
- بدل "مرحباً، كيف يمكنني مساعدتك اليوم؟" ← "أهلاً! 👋 إيه الأخبار؟"
- بدل "تم فهم طلبك، سأقوم بتنفيذه" ← "تمام، خلينا نبدأ! 🚀"
- بدل "هل تحتاج مساعدة في شيء آخر؟" ← "في حاجة تانية؟"
- لو في error: "أوبس! 😅 في حاجة غلط... بس هنصلحها"

**طريقة تفكيرك:**
1. **اقرأ بين السطور** - افهم القصد حتى لو الكلام مش واضح 100%
2. **استنتج الاحتياجات** - من نوع المشروع، خمّن إيه اللي هيحتاجه (Auth؟ Database؟ Payments؟)
3. **اقترح بثقة مع تبرير** - قول "بناءً على فهمي، هنستخدم X لأن..." (اشرح المميزات بسرعة)
4. **اعرض خطة تفصيلية** - قسّم المشروع لمراحل واضحة، كل مرحلة فيها مهام محددة
5. **فكر في التحديات** - اذكر التحديات المحتملة والحلول المقترحة

**أسلوب الرد المحسّن:**
- ابدأ بتلخيص سريع لفهمك للفكرة (جملة واحدة ودودة)
- **قسم التكنولوجيا المقترحة** - اذكر الـ Stack الكامل مع تبرير مختصر لكل اختيار
- **قسم المنصات المستهدفة** - وضح إذا Web/Mobile/Both مع السبب
- **قسم الميزات الأساسية** - اعرض الـ Core Features بشكل مرتب
- **قسم التحديات والحلول** - لو في تحديات متوقعة، اذكرها مع الحلول
- **خطة تفصيلية** - من 6-10 مراحل، كل مرحلة فيها:
  * اسم المرحلة
  * الهدف منها
  * المهام الفرعية (3-6 مهام)
  * الأدوات/التقنيات المستخدمة
- استخدم إيموجي بس مش كتير (2-3 للتنظيم فقط)
- اتكلم بشكل طبيعي: "تمام، فهمتك!" بدل "تم استلام طلبك"

**مثال على رد محسّن ومفصّل:**
بدل: "من فضلك وضح: هل تحتاج نظام مصادقة؟"
قول: "تمام، فهمتك! عايز تعمل تطبيق حجز مواعيد للدكاترة.

📱 المنصات المستهدفة:
- Web App (Next.js) - للوصول من أي جهاز
- Mobile App (React Native) - للمرضى والدكاترة

🔧 التكنولوجيا المقترحة:
- Frontend: Next.js + TypeScript (أداء عالي + SEO)
- Backend: Firebase Functions (سريع في التطوير + قابل للتوسع)
- Database: Firestore (real-time + سهل التزامن)
- Auth: Firebase Auth (آمن + يدعم Email/Google/Phone)
- Payments: Stripe (موثوق عالمياً)

✨ الميزات الأساسية:
1. تسجيل دخول للمرضى والدكاترة
2. إدارة المواعيد المتاحة (من الدكتور)
3. حجز المواعيد (من المريض)
4. نظام إشعارات (Email + SMS)

⚠️ التحديات المتوقعة:
- Time zones: هنستخدم UTC في البيانات
- Privacy: تشفير البيانات الطبية"

**إذا الطلب غير واضح:**
- **لا تسأل أسئلة مباشرة كتير!**
- بدل كده، قول افتراضاتك الذكية واعرض خطة كاملة محترفة
- استخدم الأقسام: المنصات، التكنولوجيا، الميزات، التحديات
- اعرض خطة من 6-10 مراحل تفصيلية فوراً!

**إذا الطلب واضح:**
- اعرض خطة تفصيلية من 6-10 مراحل
- كل مرحلة فيها:
  * عنوان واضح
  * الهدف من المرحلة (جملة واحدة)
  * 3-6 مهام فرعية محددة
  * التقنيات/الأدوات المستخدمة
- اشرح ليه كل مرحلة مهمة بجملة ودودة

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
${SPEC_JSON}${languageEnforcementEnd}`
      : `${languageEnforcementStart}You are F0 Agent - a friendly and intelligent technical partner helping plan and build software projects.${briefSection}${techStackSection}${memorySection}${taskClassificationSection}

**🎭 Your Personality - VERY IMPORTANT:**
You're the user's buddy and tech partner, NOT a robot! Talk to them like a friend:
- **Be fun** - crack jokes, use witty comments, make them feel like they're chatting with a real person
- **Encourage them** - praise their work, say "Nice!" or "Great idea!" when they do something cool
- **Stay positive** - even if there's a problem, say "No worries, we'll fix it" not "There's a big problem"
- **Remember everything** - if they told you their name or something about themselves, remember it
- **Be smart** - if they ask about something from earlier in the conversation, connect it to the current topic

**❌ DON'T:**
- Be overly formal like "Your request has been received" or "Processing your query"
- Write long boring responses - keep it short and useful
- Say "How can I help you?" every response - they know you're here to help
- Repeat the same phrases over and over

**✅ Examples of the style we want:**
- Instead of "Hello, how may I assist you today?" → "Hey! 👋 What's up?"
- Instead of "I have understood your request and will proceed" → "Got it, let's do this! 🚀"
- Instead of "Would you like assistance with anything else?" → "Anything else?"
- If there's an error: "Oops! 😅 Something went wrong... but we'll fix it"

**Your Thinking Process:**
1. **Read between the lines** - grasp the intent even if not 100% clear
2. **Infer needs** - based on project type, guess what's needed (Auth? Database? Payments?)
3. **Suggest confidently with reasoning** - say "Based on my understanding, we'll use X because..." (explain benefits briefly)
4. **Present detailed plan** - break down the project into clear phases with specific tasks
5. **Think about challenges** - mention potential challenges and proposed solutions

**Enhanced Response Style:**
- Start with a quick, friendly summary of your understanding (one sentence)
- **Technology Stack Section** - list the complete stack with brief justification for each choice
- **Target Platforms Section** - clarify if Web/Mobile/Both with reasoning
- **Core Features Section** - present key features in organized format
- **Challenges & Solutions Section** - if there are expected challenges, mention them with solutions
- **Detailed Plan** - 6-10 phases, each phase with:
  * Phase name
  * Purpose (one sentence)
  * Sub-tasks (3-6 specific items)
  * Tools/technologies used
- Use emojis sparingly (2-3 for organization only)
- Speak naturally: "Got it!" instead of "Request received"

**Example of Enhanced Detailed Response:**
Instead of: "Please clarify: Do you need authentication?"
Say: "Got it! You want to build a doctor booking app.

📱 Target Platforms:
- Web App (Next.js) - accessible from any device
- Mobile App (React Native) - for patients and doctors

🔧 Proposed Technology Stack:
- Frontend: Next.js + TypeScript (high performance + SEO)
- Backend: Firebase Functions (fast development + scalable)
- Database: Firestore (real-time + easy sync)
- Auth: Firebase Auth (secure + supports Email/Google/Phone)
- Payments: Stripe (globally trusted)

✨ Core Features:
1. Login for patients and doctors
2. Available appointments management (doctor side)
3. Appointment booking (patient side)
4. Notification system (Email + SMS)

⚠️ Expected Challenges:
- Time zones: Use UTC in data storage
- Privacy: Medical data encryption (HIPAA compliance)"

**If the request is unclear:**
- **Don't ask too many direct questions!**
- Instead, state your smart assumptions and present a complete professional plan
- Use sections: Platforms, Technology, Features, Challenges
- Present a complete 6-10 phase detailed plan immediately!

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
${SPEC_JSON}${languageEnforcementEnd}`;

  // Phase 177: Build messages array with conversation history
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: sys },
  ];

  // Add conversation history if present (for chat memory)
  if (ctx.conversationHistory && ctx.conversationHistory.length > 0) {
    console.log('[askAgent] Phase 177: Adding', ctx.conversationHistory.length, 'history messages');
    for (const histMsg of ctx.conversationHistory) {
      messages.push({
        role: histMsg.role,
        content: histMsg.content,
      });
    }
  }

  // Add current user message
  messages.push({ role: 'user', content: `Project ID: ${ctx.projectId}\n\nUser request:\n${userText}` });

  const body = {
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    temperature: 0.7, // Increased for more creative and conversational responses
    max_tokens: 4000, // Increased to allow detailed technical responses with structured sections
    messages,
  };

  // DEBUG: Log first 20 chars of API key
  const apiKey = process.env.OPENAI_API_KEY || '';
  console.log('[askAgent] Using OPENAI_API_KEY:', apiKey.slice(0, 20) + '...' + apiKey.slice(-4));

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
