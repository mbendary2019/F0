/**
 * Phase 109.5.4 + 109.5.5: Desktop IDE Chat Endpoint
 * POST /api/ide/desktop-chat
 *
 * Simplified endpoint for Desktop IDE that uses the same pipeline as Web IDE
 * but with Desktop-specific handling and dev mode bypass
 *
 * Phase 109.5.5 additions:
 * - API Key authentication for production
 * - testOnly mode for connection testing
 * - Unified error response format
 * - Activity logging hook
 *
 * Phase 112.1 additions:
 * - Command Intent Mode: detect CLI commands and return them directly
 * - No verbose explanations for simple commands like "pnpm test"
 *
 * Phase 112.2 additions:
 * - runnerContext: include recent Runner output in agent context
 * - Helps agent understand errors and suggest fixes
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import type {
  DesktopIdeChatRequest,
  DesktopIdeChatResponse,
  IdeRefactorEdit,
  IdeDesktopChatApiResponse,
  IdeDesktopChatSuccess,
  RunnerInsight,
} from '@/lib/ide/types';
import { askAgent } from '@/lib/agents';
import { classifyUserMessage } from '@/lib/agents/taskClassifier';
import { shouldUsePatchMode } from '@/lib/agents/patch/usePatchMode';
import { previewPatch } from '@/lib/agents/patch/orchestrator';
// Phase 109.6: Unified AI Logs
import { logAiOperation, type AiLogMode } from '@/lib/server/aiLogs';
// Phase 112.2: Runner Error Classifier
// Phase 112.3: Auto-Fix Actions
import { classifyRunnerError, formatInsightForPrompt, getAutoFixActionsForInsight } from '@/lib/server/runnerClassifier';
// Phase 169: Locale Intelligence - detect message language and explicit switches
// Phase 176: Multimodal command detection for strict language enforcement
// Phase 180.10: Simple greeting detection to skip file context
// Phase 180.11: Project overview question detection
import { computeEffectiveLocale, getLanguageInstruction, isMultimodalCommand, isSimpleGreeting, isProjectOverviewQuestion } from '@/lib/ide/localeDetector';
// Phase 188: Model Selector for intelligent routing
import { chooseModel, classifyError, getNextFallback, type ModelSelectorDecision, type LLMProvider, type ModelProfile } from '@/lib/agents/modelSelector';
// Phase 170.2: PDF text extraction
import { extractPDFContent } from '../../../../../orchestrator/core/media/extractors/pdfExtractor';
import type { DocumentAttachmentData } from '@/lib/ide/types';

const db = adminDb;

// API Key for Desktop authentication
const DESKTOP_API_KEY = process.env.F0_DESKTOP_API_KEY;

// Note: Removed Firebase Functions imports - using direct OpenAI API call instead

/**
 * Phase 168.3: Call Vision API directly using OpenAI
 * Phase 176.3: Strong language enforcement for multimodal responses
 * Uses OPENAI_API_KEY from .env.local
 */
async function callVisionAgent(
  message: string,
  images: { name: string; base64: string; mimeType: string }[],
  locale: 'ar' | 'en',
  systemContext?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('[Vision API] OPENAI_API_KEY not configured');
    throw new Error('Vision API not configured - missing OPENAI_API_KEY');
  }

  console.log('[Vision API] Calling GPT-4o directly with', images.length, 'images', 'locale:', locale);

  // Build multimodal content array
  const content: Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> = [];

  // Add text message first
  const textPrompt = systemContext
    ? `${systemContext}\n\n${locale === 'ar' ? 'طلب المستخدم:' : 'User request:'} ${message}`
    : message;
  content.push({ type: 'text', text: textPrompt });

  // Add images
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
        detail: 'auto',
      },
    });
  }

  // Phase 176.3 + 176.9: STRONG language enforcement in system prompt
  // The user's message language determines the response language, NOT the image/content/transcription language
  const systemPrompt = locale === 'ar'
    ? `أنت وكيل كود F0 متعدد الوسائط. يمكنك تحليل الصور والصوت والرد بالعربية.

🚨🚨🚨 **قواعد اللغة الإلزامية - الأهم على الإطلاق** 🚨🚨🚨

**يجب أن يكون ردك كاملاً بالعربية - بدون استثناء!**

1. ✅ حتى لو الصورة تحتوي على نص إنجليزي، اشرح بالعربي
2. ✅ حتى لو الكود في الصورة بالإنجليزية، التحليل يكون عربي
3. ✅ **حتى لو النص المحول من الصوت (transcription) بالإنجليزية، رد بالعربي**
4. ✅ **حتى لو المستخدم تكلم بالإنجليزي في الصوت، رد بالعربي لأن طلبه المكتوب بالعربي**
5. ✅ يمكن اقتباس النص الأصلي، لكن الشرح والتحليل عربي
6. ❌ ممنوع الرد بالإنجليزية نهائياً
7. ❌ ممنوع خلط اللغات

عند تحليل الصور أو الصوت:
- اشرح ما تراه أو تسمعه بوضوح بالعربية
- إذا كانت الصورة تحتوي على كود أو واجهة مستخدم، اشرح المكونات بالعربي
- إذا كان الصوت يحتوي على كلام إنجليزي، لخص المحتوى بالعربي
- إذا كان هناك خطأ ظاهر، اقترح حلولاً بالعربي
- كن مفيداً ومباشراً

🚫 **قاعدة هامة (Phase 179.2):**
- ❌ لا تخترع أو تفترض أسماء تطبيقات أو علامات تجارية أو منتجات لم يذكرها المستخدم صراحة
- ❌ إذا تكلم المستخدم عن "التطبيق" أو "المشروع" بشكل عام، لا تعطه اسمًا من عندك
- ✅ استخدم فقط الأسماء التي ذُكرت بوضوح في الصوت أو الرسالة

📋 **Phase 179.3 - استخراج الميزات (إذا طلب المستخدم "استخرج الميزات" أو "اطلع لي الفيتشرز"):**
أرجع JSON منظم بالشكل التالي:
\`\`\`json
{
  "features": [
    { "id": "1", "title": "عنوان الميزة", "description": "وصف الميزة", "source": "audio/document" }
  ]
}
\`\`\`

**CRITICAL:** User asked in Arabic (رسالته المكتوبة بالعربي). You MUST respond ENTIRELY in Arabic. Even if the audio transcription is in English, your response MUST be in Arabic. الرد بالعربي فقط!`
    : `You are the F0 Code Agent with multimodal capabilities. You can analyze images and audio, and respond helpfully.

🚨🚨🚨 **MANDATORY Language Rules - TOP PRIORITY** 🚨🚨🚨

**Your ENTIRE response MUST be in English - no exceptions!**

1. ✅ Even if the image contains Arabic text, explain in English
2. ✅ Even if the audio transcription is in another language, respond in English
3. ✅ You may quote original text, but analysis must be in English
4. ❌ Do NOT respond in other languages
5. ❌ Do NOT mix languages

When analyzing images or audio:
- Explain what you see or hear clearly
- If the image contains code or UI, explain the components
- If there are visible errors, suggest solutions
- Be helpful and direct

🚫 **Important Rule (Phase 179.2):**
- ❌ Do NOT invent or assume app names, brand names, or product names that the user did not explicitly mention
- ❌ If the user talks about "the app" or "the project" generically, do NOT give it a name
- ✅ Only use names that are explicitly mentioned in the audio or message

📋 **Phase 179.3 - Feature Extraction (if user asks "extract features" or "list the features"):**
Return structured JSON in this format:
\`\`\`json
{
  "features": [
    { "id": "1", "title": "Feature title", "description": "Feature description", "source": "audio/document" }
  ]
}
\`\`\`

**CRITICAL:** User's written message is in English. You MUST respond ENTIRELY in English.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content },
        ],
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Vision API] OpenAI error:', res.status, errText);
      throw new Error(`Vision API error: ${res.status}`);
    }

    const json = await res.json();
    const responseText = json.choices?.[0]?.message?.content || '';
    const tokensUsed = json.usage?.total_tokens;

    console.log('[Vision API] Response received:', {
      responseLength: responseText.length,
      tokensUsed,
    });

    return responseText;
  } catch (error: any) {
    console.error('[Vision API] Error:', error);
    throw new Error(`Vision API error: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Phase 170.2: Extract text from document attachments (PDF, Word, Excel)
 * Returns formatted text for agent context
 */
async function extractDocumentTexts(
  documents: DocumentAttachmentData[],
  locale: 'ar' | 'en'
): Promise<string[]> {
  const results: string[] = [];

  for (const doc of documents) {
    try {
      if (doc.type === 'pdf' || doc.mimeType === 'application/pdf') {
        console.log('[Document Extractor] Processing PDF:', doc.name);

        const extracted = await extractPDFContent({
          content: doc.base64,
          contentType: 'base64',
          mimeType: 'application/pdf',
          filename: doc.name,
        });

        if (extracted.text && extracted.text.trim().length > 0) {
          const header = locale === 'ar'
            ? `📄 **محتوى ملف PDF:** \`${doc.name}\` (${extracted.pageCount || '?'} صفحات)`
            : `📄 **PDF Content:** \`${doc.name}\` (${extracted.pageCount || '?'} pages)`;

          // Truncate very long PDFs
          let text = extracted.text;
          const maxLength = 20000;
          if (text.length > maxLength) {
            text = text.slice(0, maxLength) + '\n\n... [Truncated for brevity]';
          }

          results.push(`${header}\n\n\`\`\`\n${text}\n\`\`\``);
          console.log('[Document Extractor] PDF extracted:', {
            name: doc.name,
            pageCount: extracted.pageCount,
            textLength: extracted.text.length,
            language: extracted.language,
          });
        } else {
          // PDF might be scanned/image-based
          const fallbackMsg = locale === 'ar'
            ? `📄 **ملف PDF:** \`${doc.name}\`\n\n⚠️ لم يتم العثور على نص قابل للاستخراج. قد يكون الملف يحتوي على صور فقط (scanned).`
            : `📄 **PDF File:** \`${doc.name}\`\n\n⚠️ No extractable text found. The file may contain only images (scanned).`;
          results.push(fallbackMsg);
        }
      } else if (doc.type === 'word') {
        // Word documents - placeholder for future implementation
        const msg = locale === 'ar'
          ? `📄 **مستند Word:** \`${doc.name}\`\n\n⚠️ استخراج نص Word غير مدعوم حالياً.`
          : `📄 **Word Document:** \`${doc.name}\`\n\n⚠️ Word text extraction not yet supported.`;
        results.push(msg);
      } else if (doc.type === 'excel') {
        // Excel documents - placeholder for future implementation
        const msg = locale === 'ar'
          ? `📄 **جدول Excel:** \`${doc.name}\`\n\n⚠️ استخراج نص Excel غير مدعوم حالياً.`
          : `📄 **Excel Spreadsheet:** \`${doc.name}\`\n\n⚠️ Excel text extraction not yet supported.`;
        results.push(msg);
      }
    } catch (error: any) {
      console.error('[Document Extractor] Error processing:', doc.name, error);
      const errorMsg = locale === 'ar'
        ? `📄 **ملف:** \`${doc.name}\`\n\n❌ خطأ في استخراج النص: ${error.message}`
        : `📄 **File:** \`${doc.name}\`\n\n❌ Error extracting text: ${error.message}`;
      results.push(errorMsg);
    }
  }

  return results;
}

// Dev bypass helper
function isDevEnv() {
  return process.env.NODE_ENV === 'development' ||
         process.env.NEXT_PUBLIC_F0_ENV === 'emulator' ||
         process.env.NEXT_PUBLIC_USE_EMULATORS === '1';
}

// CORS headers for Desktop IDE (Electron apps run from different origins)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/** Helper for typed JSON responses with CORS */
function jsonResponse(data: IdeDesktopChatApiResponse, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

/** Handle CORS preflight requests */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/** Map IDE mode to AiLogMode */
function mapToAiLogMode(mode: string): AiLogMode {
  if (mode === 'chat' || mode === 'refactor' || mode === 'plan' || mode === 'explain' || mode === 'task') {
    return mode as AiLogMode;
  }
  return 'chat';
}

// ============================================
// Phase 112.1: Command Intent Mode (Simplified)
// Phase 112.3: Extended CLI detection (node, git, etc.)
// ============================================

/**
 * Extended CLI command detection
 * Detects common CLI commands including:
 * - Package managers: pnpm, npm, yarn, npx, bun
 * - Runtime: node, deno, tsx
 * - Version control: git
 * - Version checks: node -v, npm -v, etc.
 */
function extractCliCommand(message: string): string | null {
  const raw = message.trim();
  if (!raw) return null;

  // 1. Package managers with arguments: pnpm dev, npm test, etc.
  if (/^(pnpm|npm|yarn|npx|bun)\s+/i.test(raw)) {
    return raw;
  }

  // 2. Runtime commands: node, deno, tsx
  if (/^(node|deno|tsx)\s+/i.test(raw)) {
    return raw;
  }

  // 3. Git commands: git status, git add, etc.
  if (/^git\s+/i.test(raw)) {
    return raw;
  }

  // 4. Version checks: node -v, npm -v, pnpm -v, etc.
  // Short commands like "node -v" or "npm --version"
  if (/^(node|npm|pnpm|yarn|bun|git|deno|tsx)\s*(-v|--version)$/i.test(raw)) {
    return raw;
  }

  // 5. Which/where commands: which node, where npm, etc.
  if (/^(which|where)\s+/i.test(raw)) {
    return raw;
  }

  return null;
}

export async function POST(req: NextRequest) {
  let body: DesktopIdeChatRequest;

  // Parse request body first
  try {
    body = await req.json();
  } catch {
    return jsonResponse({
      ok: false,
      errorCode: 'BAD_REQUEST',
      message: 'Invalid JSON body',
    }, 400);
  }

  const { projectId, source, mode, message, fileContext, locale = 'en', testOnly, runnerContext, imageAttachments, documentAttachments, conversationHistory, projectIndex } = body;

  // Validate required fields
  if (!projectId || !message || !source) {
    return jsonResponse({
      ok: false,
      errorCode: 'BAD_REQUEST',
      message: 'Missing projectId, source, or message',
    }, 400);
  }

  // Validate source
  if (source !== 'desktop-ide') {
    return jsonResponse({
      ok: false,
      errorCode: 'BAD_REQUEST',
      message: 'This endpoint is only for desktop-ide source',
    }, 400);
  }

  try {
    // 1. Authenticate (with dev bypass)
    let uid = 'dev-user';

    if (isDevEnv()) {
      console.log('[Desktop IDE Chat] Dev bypass enabled');
    } else {
      // Production: require API key
      const authHeader = req.headers.get('authorization') || '';
      const [, token] = authHeader.split(' '); // "Bearer xxx"

      if (!token) {
        return jsonResponse({
          ok: false,
          errorCode: 'AUTH_REQUIRED',
          message: 'Missing Authorization header',
        }, 401);
      }

      // Check API key
      if (DESKTOP_API_KEY && token === DESKTOP_API_KEY) {
        uid = 'desktop-api-key-user';
        console.log('[Desktop IDE Chat] Authenticated via API key');
      } else {
        // Try Firebase token
        try {
          const decodedToken = await adminAuth.verifyIdToken(token);
          uid = decodedToken.uid;
          console.log('[Desktop IDE Chat] Authenticated via Firebase token');
        } catch (err) {
          return jsonResponse({
            ok: false,
            errorCode: 'INVALID_API_KEY',
            message: 'Invalid API key or Firebase token',
          }, 401);
        }
      }
    }

    // 2. Handle testOnly mode (for connection testing)
    if (testOnly) {
      console.log('[Desktop IDE Chat] Test connection OK');
      return jsonResponse({
        ok: true,
        result: {
          kind: 'chat',
          messages: [`✅ Desktop connection OK for project ${projectId} (mode=${mode})`],
        },
      });
    }

    // 3. Phase 112.1: Command Intent Mode - Short-circuit for CLI commands
    const cliCommand = extractCliCommand(message);
    if (cliCommand) {
      console.log('[Desktop IDE Chat] CLI command detected:', cliCommand);

      // Log the command intent
      await logAiOperation({
        origin: 'desktop-ide',
        projectId,
        mode: 'chat',
        success: true,
        summary: `CLI command: ${cliCommand}`,
        uid,
        metadata: {
          taskKind: 'cli-command',
          command: cliCommand,
        },
      });

      // Return the command directly with a response type for Runner
      const response: DesktopIdeChatResponse = {
        kind: 'chat',
        messages: [
          locale === 'ar'
            ? `🚀 **أمر CLI:** \`${cliCommand}\`\n\nاضغط ▶️ لتشغيل الأمر في الـ Runner.`
            : `🚀 **CLI Command:** \`${cliCommand}\`\n\nClick ▶️ to run this command in the Runner.`,
        ],
      };

      // Add special marker for Desktop to detect command intent
      const successResponse: IdeDesktopChatSuccess = {
        ok: true,
        result: response,
        commandIntent: {
          type: 'run',
          command: cliCommand,
        },
      };
      return jsonResponse(successResponse);
    }

    // Phase 169: Compute effective locale based on message language
    const localeAnalysis = computeEffectiveLocale(message, (locale || 'en') as 'ar' | 'en');
    const effectiveLocale = localeAnalysis.effectiveLocale;

    // Phase 176: Detect multimodal commands EARLY for language enforcement
    // A request is multimodal if it has images OR contains multimodal command patterns
    const isMultimodal = isMultimodalCommand(message) || !!(imageAttachments && imageAttachments.length > 0);

    console.log('[Desktop IDE Chat] Request:', {
      projectId,
      source,
      mode,
      hasFileContext: !!fileContext,
      hasRunnerContext: !!runnerContext,
      hasImageAttachments: !!(imageAttachments && imageAttachments.length > 0), // Phase 168.3
      imageCount: imageAttachments?.length || 0, // Phase 168.3
      hasDocumentAttachments: !!(documentAttachments && documentAttachments.length > 0), // Phase 170.2
      documentCount: documentAttachments?.length || 0, // Phase 170.2
      messageLength: message?.length,
      // Phase 187: Local project index
      hasProjectIndex: !!projectIndex,
      projectFilesCount: projectIndex?.totalFiles || 0,
      // Phase 169: Locale intelligence
      ideLocale: locale,
      effectiveLocale,
      localeReason: localeAnalysis.reason,
      detectedLanguage: localeAnalysis.detected,
      explicitSwitch: localeAnalysis.explicitSwitch,
      // Phase 176: Multimodal command detection
      isMultimodalCommand: isMultimodal,
      // Phase 177: Chat memory support
      conversationHistoryLength: conversationHistory?.length || 0,
    });

    // 3. Get project context
    // Phase 187: If projectIndex is provided, use it to build context instead of Firestore
    let brief = '';
    let techStack = null;
    let memory = null;
    let localProjectContext = '';

    if (projectIndex && projectIndex.files && projectIndex.files.length > 0) {
      // Phase 187: Build context from local project index
      console.log('[Desktop IDE Chat] Using local project index with', projectIndex.totalFiles, 'files');

      // Build tech stack from project files
      const hasTypescript = projectIndex.files.some(f => f.lang === 'typescript' || f.lang === 'tsx');
      const hasReact = projectIndex.files.some(f => f.relativePath.includes('jsx') || f.relativePath.includes('tsx'));
      const hasNextJs = projectIndex.files.some(f => f.relativePath.includes('next.config') || f.relativePath.includes('app/'));
      const hasTailwind = projectIndex.files.some(f => f.relativePath.includes('tailwind'));
      const hasFirebase = projectIndex.files.some(f => f.relativePath.includes('firebase') || (f.snippet && f.snippet.includes('firebase')));

      techStack = {
        projectType: hasNextJs ? 'nextjs' : hasReact ? 'react' : 'generic',
        framework: {
          name: hasNextJs ? 'Next.js' : hasReact ? 'React' : 'Unknown',
          language: hasTypescript ? 'TypeScript' : 'JavaScript',
        },
        features: {
          hasAuth: projectIndex.files.some(f => f.relativePath.includes('auth') || (f.symbols && f.symbols.some(s => s.toLowerCase().includes('auth')))),
          hasFirebase,
          hasTailwind,
          hasShadcn: projectIndex.files.some(f => f.relativePath.includes('ui/') && f.relativePath.includes('components')),
          hasBackendApi: projectIndex.files.some(f => f.relativePath.includes('api/')),
        },
      };

      // Build brief from project structure
      const mainDirs = new Set<string>();
      projectIndex.files.forEach(f => {
        const parts = f.relativePath.split('/');
        if (parts.length > 1) mainDirs.add(parts[0]);
      });
      brief = `Local project with ${projectIndex.totalFiles} files. Main directories: ${Array.from(mainDirs).slice(0, 5).join(', ')}`;

      // Build project context summary for agent
      const topFiles = projectIndex.files.slice(0, 20); // Top 20 files
      const fileList = topFiles.map(f => `- ${f.relativePath} (${f.lang})${f.exports ? ` [exports: ${f.exports.slice(0, 3).join(', ')}]` : ''}`).join('\n');

      localProjectContext = effectiveLocale === 'ar'
        ? `\n📁 **ملفات المشروع المحلي (${projectIndex.totalFiles} ملف):**\n\`\`\`\n${fileList}\n\`\`\`\n\n**المسار:** ${projectIndex.projectRoot}\n`
        : `\n📁 **Local Project Files (${projectIndex.totalFiles} files):**\n\`\`\`\n${fileList}\n\`\`\`\n\n**Path:** ${projectIndex.projectRoot}\n`;

      console.log('[Desktop IDE Chat] Built local context:', {
        techStackType: techStack.projectType,
        framework: techStack.framework.name,
        features: Object.keys(techStack.features).filter(k => techStack.features[k]),
        briefLength: brief.length,
      });
    } else {
      // Fallback to Firestore - but don't block on errors (dev mode without emulator)
      try {
        const projectDoc = await db.collection('projects').doc(projectId).get();

        if (projectDoc.exists) {
          const projectData = projectDoc.data();
          brief = projectData?.context?.brief || '';
          techStack = projectData?.projectAnalysis || null;
          memory = projectData?.projectMemory || null;
        } else {
          console.warn('[Desktop IDE Chat] Project not found in Firestore, continuing without context');
        }
      } catch (firestoreErr: any) {
        // Firestore unavailable (emulator not running) - continue without project context
        console.warn('[Desktop IDE Chat] Firestore unavailable, continuing without project context:', firestoreErr?.message?.slice(0, 100));
      }
    }

    // 4. Build enhanced message with file context
    // Phase 110.1: Enhanced Desktop IDE context with Arabic system prompt
    // Phase 122: Detect RAG context and add strong system prompt
    let enhancedMessage = message;
    const contextParts: string[] = [];

    // Phase 122: Check if message contains RAG context (project files)
    const hasRagContext = message.includes('📚 Relevant project files:') ||
                          message.includes('📚 ملفات المشروع ذات الصلة:') ||
                          message.includes('📄 FILE:');

    // Phase 169 + 176: Add language instruction based on effective locale
    // isMultimodal already defined above - use it for stricter language enforcement
    const languageInstruction = getLanguageInstruction(effectiveLocale, localeAnalysis.reason, isMultimodal);

    // Phase 122: If RAG context detected, add STRONG system prompt to force using only provided files
    if (hasRagContext) {
      const ragSystemPrompt = effectiveLocale === 'ar'
        ? `⚠️ **تنبيه مهم للوكيل:**
أنت وكيل كود F0 تعمل داخل مشروع **حقيقي**.

**قواعد صارمة:**
1. ✅ أجب **فقط** بناءً على ملفات المشروع الموجودة في السياق أدناه
2. ✅ استخدم مسارات الملفات الفعلية عند الشرح مثل: \`src/app/page.tsx\`
3. ✅ اقتبس الكود الفعلي من الملفات المقدمة
4. ❌ **ممنوع** اختراع تقنيات أو بنية مشروع غير موجودة
5. ❌ **ممنوع** الافتراض بدون دليل من الكود
6. ❌ **ممنوع** إعطاء أمثلة عامة - استخدم الكود الحقيقي فقط

**إذا لم تجد الإجابة في الملفات المقدمة، قل بوضوح:**
"لا أرى الكود الخاص بهذا الموضوع في الملفات اللي قدامي. جرب تفتح الملف المناسب وأسألني تاني."

---
`
        : `⚠️ **Important Agent Instructions:**
You are the F0 Code Agent working inside a **real** project.

**Strict Rules:**
1. ✅ Answer **ONLY** based on the project files provided in context below
2. ✅ Reference actual file paths when explaining like: \`src/app/page.tsx\`
3. ✅ Quote actual code from the provided files
4. ❌ **DO NOT** invent technologies or project structure not present
5. ❌ **DO NOT** make assumptions without code evidence
6. ❌ **DO NOT** give generic examples - use only the real code

**If the answer is not in the provided files, say clearly:**
"I don't see code for this topic in the files provided. Try opening the relevant file and ask again."

---
`;

      enhancedMessage = ragSystemPrompt + message;
      console.log('[Desktop IDE Chat] RAG context detected - added strong system prompt');
    }

    // Phase 180.10: Skip file context for simple greetings/casual chat
    // When user says "هاي" or "hello", don't talk about the open file
    const skipFileContext = isSimpleGreeting(message);

    // Phase 180.11: Detect project overview questions
    // When user asks about the whole project, add special instructions
    const isProjectQuestion = isProjectOverviewQuestion(message);

    if (skipFileContext) {
      console.log('[Desktop IDE Chat] Simple greeting detected - skipping file context');
    }

    if (isProjectQuestion) {
      console.log('[Desktop IDE Chat] Project overview question detected - adding project context instructions');
      // Add project-level instruction to help the agent
      if (effectiveLocale === 'ar') {
        contextParts.push(`⚠️ **تنبيه مهم:** المستخدم يسأل عن المشروع بالكامل، وليس الملف المفتوح فقط.
يرجى شرح المشروع بشكل عام: ما هو هدفه، ما هي التقنيات المستخدمة، وما هي الميزات الرئيسية.
لا تركز على الملف المفتوح حالياً - تكلم عن المشروع ككل.`);
      } else {
        contextParts.push(`⚠️ **Important:** The user is asking about the WHOLE project, not just the open file.
Please explain the project in general: what is its purpose, what technologies are used, and what are the main features.
Do NOT focus on the currently open file - talk about the project as a whole.`);
      }
    }

    if (fileContext && !skipFileContext && !isProjectQuestion) {
      const { filePath, languageId, fullText, selectedText, selectionStart, selectionEnd } = fileContext;

      // Build context in the preferred locale
      if (effectiveLocale === 'ar') {
        contextParts.push(`📁 **الملف الحالي:** \`${filePath}\``);
        contextParts.push(`🔤 **اللغة:** ${languageId || 'غير معروف'}`);

        if (selectedText && selectedText.trim().length > 0) {
          contextParts.push(`📍 **الكود المحدد (سطور ${selectionStart.line}-${selectionEnd.line}):**`);
          contextParts.push(`\`\`\`${languageId || ''}\n${selectedText.slice(0, 2000)}\n\`\`\``);
        }

        // Include full file only if small enough and no selection
        if (!selectedText && fullText && fullText.length < 10000) {
          contextParts.push(`📄 **محتوى الملف الكامل:**`);
          contextParts.push(`\`\`\`${languageId || ''}\n${fullText}\n\`\`\``);
        } else if (fullText && fullText.length >= 10000) {
          contextParts.push(`📄 _الملف كبير جداً (${fullText.length} حرف) - تم إرسال الجزء المحدد فقط_`);
        }
      } else {
        contextParts.push(`📁 **Current File:** \`${filePath}\``);
        contextParts.push(`🔤 **Language:** ${languageId || 'unknown'}`);

        if (selectedText && selectedText.trim().length > 0) {
          contextParts.push(`📍 **Selected Code (lines ${selectionStart.line}-${selectionEnd.line}):**`);
          contextParts.push(`\`\`\`${languageId || ''}\n${selectedText.slice(0, 2000)}\n\`\`\``);
        }

        if (!selectedText && fullText && fullText.length < 10000) {
          contextParts.push(`📄 **Full File Content:**`);
          contextParts.push(`\`\`\`${languageId || ''}\n${fullText}\n\`\`\``);
        } else if (fullText && fullText.length >= 10000) {
          contextParts.push(`📄 _File too large (${fullText.length} chars) - only selection sent_`);
        }
      }
    }

    // Phase 112.2: Add runner context if provided + classify errors
    let runnerInsight: RunnerInsight | undefined;

    if (runnerContext && runnerContext.trim().length > 0) {
      // Limit runner context to avoid token overflow
      const truncatedRunnerContext = runnerContext.slice(0, 5000);

      // Phase 112.2: Classify runner errors
      // Try to extract command and status from the context
      const commandMatch = runnerContext.match(/Command:\s*(.+)/);
      const exitCodeMatch = runnerContext.match(/Exit Code:\s*(\d+|N\/A)/);
      const statusMatch = runnerContext.match(/Status:\s*(success|failed|killed)/i);

      const extractedCommand = commandMatch ? commandMatch[1].trim() : 'unknown';
      const extractedExitCode = exitCodeMatch && exitCodeMatch[1] !== 'N/A'
        ? parseInt(exitCodeMatch[1], 10)
        : null;
      const extractedStatus = statusMatch
        ? (statusMatch[1].toLowerCase() as 'success' | 'failed' | 'killed')
        : 'failed';

      // Classify the error
      const insight = classifyRunnerError({
        command: extractedCommand,
        exitCode: extractedExitCode,
        logs: runnerContext,
        status: extractedStatus,
      });

      if (insight) {
        runnerInsight = insight;
        console.log('[Desktop IDE Chat] Runner error classified:', {
          category: insight.category,
          severity: insight.severity,
        });

        // Add insight to context for Agent
        const insightPrompt = formatInsightForPrompt(insight, effectiveLocale);
        contextParts.push(insightPrompt);
      }

      if (effectiveLocale === 'ar') {
        contextParts.push(`📟 **آخر نتائج الـ Runner:**`);
        contextParts.push(`\`\`\`\n${truncatedRunnerContext}\n\`\`\``);
      } else {
        contextParts.push(`📟 **Recent Runner Output:**`);
        contextParts.push(`\`\`\`\n${truncatedRunnerContext}\n\`\`\``);
      }
      console.log('[Desktop IDE Chat] Runner context added:', {
        length: runnerContext.length,
        truncated: runnerContext.length > 5000,
        hasInsight: !!runnerInsight,
      });
    }

    // Phase 170.2: Process document attachments (PDF, Word, Excel)
    if (documentAttachments && documentAttachments.length > 0) {
      console.log('[Desktop IDE Chat] Processing document attachments:', documentAttachments.length);

      try {
        const documentTexts = await extractDocumentTexts(documentAttachments, effectiveLocale);

        if (documentTexts.length > 0) {
          // Add document context header
          const docHeader = effectiveLocale === 'ar'
            ? `📎 **المستندات المرفقة:**`
            : `📎 **Attached Documents:**`;
          contextParts.push(docHeader);

          // Add each document's extracted text
          for (const docText of documentTexts) {
            contextParts.push(docText);
          }

          console.log('[Desktop IDE Chat] Document attachments processed:', {
            count: documentAttachments.length,
            extractedCount: documentTexts.length,
          });
        }
      } catch (docError: any) {
        console.error('[Desktop IDE Chat] Error processing documents:', docError);
        // Continue without document context - don't fail the whole request
      }
    }

    // Phase 187: Add local project context if available (but not for simple greetings)
    if (localProjectContext && !skipFileContext) {
      contextParts.unshift(localProjectContext);
    }

    // Build the enhanced message with Desktop IDE system context
    // Phase 169 + 176.6: Add language instruction to ensure correct response language
    // NOTE: languageInstruction will be prepended again at askAgent call (Phase 176.6.1)
    // This ensures DOUBLE enforcement: once in context, once in message
    if (contextParts.length > 0) {
      const contextText = contextParts.join('\n\n');
      const systemContext = effectiveLocale === 'ar'
        ? `أنت وكيل كود داخل F0 Desktop IDE. رد دايمًا بالعربية، واشرح التغييرات بوضوح، ثم لو مناسب اقترح تعديلات على الكود.\n\n## سياق الملف الحالي\n\n${contextText}`
        : `You are a code agent inside F0 Desktop IDE. Explain changes clearly and suggest code modifications when appropriate.\n\n## Current File Context\n\n${contextText}`;

      enhancedMessage = `${systemContext}\n\n## طلب المستخدم / User Request\n\n${message}`;

      // Phase 176.6.3: Debug log for file context branch
      console.log('[Desktop IDE Chat] Context built:', {
        hasFilePath: !!fileContext?.filePath,
        hasSelection: !!fileContext?.selectedText,
        hasRunnerContext: !!runnerContext,
        contextLength: contextText.length,
        effectiveLocale,
        hasFileContext: true,
      });
    }

    // 5. Classify task kind
    const taskClassification = await classifyUserMessage({
      message: enhancedMessage,
      locale: effectiveLocale,
      projectType: techStack?.projectType,
      hasUi: !!techStack?.features?.hasTailwind || !!techStack?.features?.hasShadcn,
      hasBackendApi: !!techStack?.features?.hasBackendApi,
    });

    console.log(`[Desktop IDE Chat] Task classified as: ${taskClassification.taskKind}`);

    // 6. Call agent (with Vision API if images present)
    let agentResponse: { visible: string; plan?: any; ready?: boolean; intent?: string; clarity_score?: number };

    // Phase 188: Model Selection - Choose the best model for this request
    const modelDecision = chooseModel({
      message,
      locale: effectiveLocale,
      hasFileContext: !!fileContext,
      hasRunnerContext: !!runnerContext,
      hasImageAttachments: !!(imageAttachments && imageAttachments.length > 0),
      historyLength: conversationHistory?.length || 0,
      fileContextLength: fileContext?.fullText?.length || 0,
      messageLength: message.length,
    });

    // Phase 188: Log model selection decision
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[ModelSelector.decision]', {
      messageId,
      projectId,
      chosenModel: modelDecision.model,
      provider: modelDecision.provider,
      profile: modelDecision.profile,
      candidates: modelDecision.candidates.map(c => `${c.provider}:${c.model} (${c.score.toFixed(2)})`),
      reason: modelDecision.reason,
      fallbackChain: modelDecision.fallbackChain,
    });

    const llmStartTime = Date.now();

    // Phase 168.3: Use Vision API if images are attached
    if (imageAttachments && imageAttachments.length > 0) {
      console.log('[Desktop IDE Chat] Using Vision API with', imageAttachments.length, 'images');

      // Build context string for vision
      const contextString = contextParts.length > 0 ? contextParts.join('\n\n') : undefined;

      // Phase 176.8: Add language instruction to Vision API for audio/image analysis
      const visionMessageWithLang = `${languageInstruction}\n\n${message}`;
      console.log('[Desktop IDE Chat] Vision API with language instruction:', {
        lang: effectiveLocale,
        languageInstructionPrefix: languageInstruction.slice(0, 100),
        originalMessageLength: message.length,
        finalMessageLength: visionMessageWithLang.length,
      });

      // Phase 188: Log Vision API request
      console.log('[LLM.request]', {
        messageId,
        provider: 'openai', // Vision uses OpenAI GPT-4o
        model: 'gpt-4o',
        profile: 'multimodal',
        inputLength: visionMessageWithLang.length,
        imageCount: imageAttachments.length,
      });

      const visionResponse = await callVisionAgent(
        visionMessageWithLang, // Phase 176.8: Include language instruction for proper language response
        imageAttachments,
        effectiveLocale,
        contextString
      );

      // Phase 188: Log Vision API response
      const visionLatency = Date.now() - llmStartTime;
      console.log('[LLM.response]', {
        messageId,
        provider: 'openai',
        model: 'gpt-4o',
        latencyMs: visionLatency,
        outputLength: visionResponse?.length || 0,
        success: true,
      });

      agentResponse = {
        visible: visionResponse,
        ready: true,
        intent: 'chat',
        clarity_score: 1.0,
      };
    } else {
      // No images - use standard agent
      // Phase 176.6.1 + 176.6.3: Prepend strong language instruction to ensure correct response language
      const messageWithLanguageInstruction = `${languageInstruction}\n\n${enhancedMessage}`;

      // Phase 176.6.3: Debug logging for language enforcement
      console.log('[Desktop IDE Chat] Calling askAgent:', {
        lang: effectiveLocale,
        languageInstructionPrefix: languageInstruction.slice(0, 100),
        hasFileContext: !!fileContext,
        hasRagContext,
        enhancedMessageLength: enhancedMessage.length,
        finalMessageLength: messageWithLanguageInstruction.length,
      });

      // Phase 188: Log LLM request
      console.log('[LLM.request]', {
        messageId,
        provider: modelDecision.provider,
        model: modelDecision.model,
        profile: modelDecision.profile,
        inputLength: messageWithLanguageInstruction.length,
      });

      agentResponse = await askAgent(messageWithLanguageInstruction, {
        projectId,
        brief,
        techStack,
        memory,
        lang: effectiveLocale,
        taskClassification,
        conversationHistory, // Phase 177: Chat memory support
      });

      // Phase 188: Log LLM response
      const llmLatency = Date.now() - llmStartTime;
      console.log('[LLM.response]', {
        messageId,
        provider: modelDecision.provider,
        model: modelDecision.model,
        latencyMs: llmLatency,
        outputLength: agentResponse.visible?.length || 0,
        success: true,
      });
    }

    // 7. Try to generate refactor edits if in refactor mode
    let edits: IdeRefactorEdit[] = [];

    if (mode === 'refactor' && fileContext && shouldUsePatchMode(taskClassification.taskKind)) {
      console.log('[Desktop IDE Chat] Generating refactor edits...');

      try {
        const patchResult = await previewPatch({
          projectId,
          agentResponse: agentResponse.text,
          userMessage: message,
          taskKind: taskClassification.taskKind,
          locale: effectiveLocale,
        });

        if (patchResult?.patches && patchResult.patches.length > 0) {
          // Convert patches to IdeRefactorEdit format
          edits = patchResult.patches.map(p => ({
            filePath: p.filePath || fileContext.filePath,
            type: 'full-replace' as const,
            newText: extractNewTextFromDiff(p.diff || '', fileContext.fullText),
            description: `Refactor: ${taskClassification.taskKind}`,
          }));

          console.log(`[Desktop IDE Chat] Generated ${edits.length} refactor edits`);
        }
      } catch (patchError) {
        console.error('[Desktop IDE Chat] Patch generation error:', patchError);
        // Continue without edits
      }
    }

    // 8. Log to activity (Phase 109.6 unified logging)
    // Fire-and-forget: don't block response on Firestore write
    logAiOperation({
      origin: 'desktop-ide',
      projectId,
      mode: mapToAiLogMode(mode),
      success: true,
      filePath: fileContext?.filePath,
      summary: `${taskClassification.taskKind}: ${message.slice(0, 100)}`,
      uid,
      metadata: {
        taskKind: taskClassification.taskKind,
        editsCount: edits.length,
        hasFileContext: !!fileContext,
        hasImageAttachments: !!(imageAttachments && imageAttachments.length > 0), // Phase 168.3
        imageCount: imageAttachments?.length || 0, // Phase 168.3
      },
    }).catch(err => console.warn('[Desktop IDE Chat] Non-blocking log failed:', err?.message));

    // 9. Build response
    // NOTE: askAgent returns { visible, plan, ready, ... } - NOT { text }!
    console.log('[Desktop IDE Chat] Agent response keys:', Object.keys(agentResponse));
    console.log('[Desktop IDE Chat] Agent visible length:', agentResponse.visible?.length || 0);

    const agentMessage = agentResponse.visible || agentResponse.plan?.summary ||
      (effectiveLocale === 'ar' ? 'لم أتمكن من توليد رد. حاول مرة أخرى.' : 'Could not generate a response. Please try again.');

    // Phase 112.3: Get auto-fix actions if we have an insight
    const autoFixActions = runnerInsight
      ? getAutoFixActionsForInsight(runnerInsight)
      : [];

    // Phase 188: Calculate final latency
    const finalLatency = Date.now() - llmStartTime;

    // Phase 188: Determine actual model used (Vision uses GPT-4o directly)
    const actualProvider = (imageAttachments && imageAttachments.length > 0) ? 'openai' : modelDecision.provider;
    const actualModel = (imageAttachments && imageAttachments.length > 0) ? 'gpt-4o' : modelDecision.model;
    const actualProfile = (imageAttachments && imageAttachments.length > 0) ? 'multimodal' : modelDecision.profile;

    const response: DesktopIdeChatResponse = {
      kind: edits.length > 0 ? 'refactor' : 'chat',
      messages: [agentMessage],
      edits: edits.length > 0 ? edits : undefined,
      // Phase 112.2: Include runner insight if available
      runnerInsight,
      // Phase 112.3: Include auto-fix actions
      autoFixActions: autoFixActions.length > 0 ? autoFixActions : undefined,
      // Phase 188: Include model metadata for debugging (dev mode)
      meta: {
        provider: actualProvider,
        model: actualModel,
        profile: actualProfile,
        fallbackChain: modelDecision.fallbackChain,
        latencyMs: finalLatency,
      },
    };

    console.log('[Desktop IDE Chat] Response:', {
      kind: response.kind,
      messagesCount: response.messages.length,
      editsCount: response.edits?.length || 0,
      hasRunnerInsight: !!runnerInsight,
      autoFixActionsCount: autoFixActions.length,
    });

    return jsonResponse({
      ok: true,
      result: response,
    });

  } catch (error: any) {
    console.error('[Desktop IDE Chat] Error:', error);

    // Log error (Phase 109.6 unified logging) - fire-and-forget
    logAiOperation({
      origin: 'desktop-ide',
      projectId,
      mode: mapToAiLogMode(mode),
      success: false,
      errorMessage: error?.message || 'Unknown error',
      filePath: fileContext?.filePath,
    }).catch(() => {}); // Silent fail for logging

    return jsonResponse({
      ok: false,
      errorCode: 'AGENT_ERROR',
      message: error?.message || 'Unexpected error while running Cloud Agent',
    }, 500);
  }
}

/**
 * Helper to extract new text from diff
 * Simple implementation - extracts lines starting with +
 */
function extractNewTextFromDiff(diff: string, originalText: string): string {
  if (!diff) return originalText;

  // Try to find code blocks in the response
  const codeBlockMatch = diff.match(/```[\w]*\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1];
  }

  // If diff format, extract + lines
  const lines = diff.split('\n');
  const newLines: string[] = [];
  let inDiff = false;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      inDiff = true;
      continue;
    }
    if (inDiff) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        newLines.push(line.substring(1));
      } else if (line.startsWith(' ')) {
        newLines.push(line.substring(1));
      }
    }
  }

  if (newLines.length > 0) {
    return newLines.join('\n');
  }

  // Fallback: return original
  return originalText;
}
