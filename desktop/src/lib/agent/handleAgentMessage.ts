// desktop/src/lib/agent/handleAgentMessage.ts
// Phase 122.2: Agent Message Handler with RAG Integration
// Phase 167.1: Code Location Intent - search entire project for code location queries
// Enriches agent messages with indexed project context

import { buildContextMessages, type ContextFile } from '../rag';
import type { F0ChatMessage } from '../../f0/apiClient';
import { searchProjectIndex } from '../../../indexer/searchProjectIndex';
import type { ProjectSearchResult } from '../../../indexer/types';

/**
 * Input for handling agent messages
 */
export interface HandleAgentMessageInput {
  projectRoot?: string | null;
  userQuestion: string;
  activeFilePath?: string | null;
  activeFileContent?: string | null;
  language?: 'ar' | 'en';
  existingMessages?: F0ChatMessage[];
}

/**
 * Result from RAG context building
 */
export interface RagEnrichedResult {
  messages: F0ChatMessage[];
  contextFiles: ContextFile[];
  usedRag: boolean;
}

/**
 * Strong system prompt that forces LLM to use only context files
 */
const RAG_SYSTEM_PROMPT_AR = `أنت وكيل كود F0 تعمل داخل مشروع حقيقي.

يجب عليك:
- الإجابة فقط بناءً على ملفات المشروع الموجودة في السياق
- الإشارة للملفات بوضوح مثل: (src/app/page.tsx)
- إذا لم تجد الإجابة في الملفات، قل بوضوح: "لا أرى الكود الخاص بهذا الموضوع في الملفات اللي قدامي"

ممنوع:
- اختراع تقنيات أو بنية مشروع غير موجودة
- الافتراض بدون دليل من الكود
- إعطاء أمثلة عامة بدلاً من الكود الفعلي`;

const RAG_SYSTEM_PROMPT_EN = `You are the F0 Code Agent working inside a real project.

You MUST:
- Answer ONLY based on the project files in the context
- Reference files explicitly like: (src/app/page.tsx)
- If the answer is not present in the context files, say clearly: "I don't see code for this topic in the provided files"

Do NOT:
- Invent technologies, stacks, or project structure
- Make assumptions without evidence from the code
- Give generic examples instead of actual code`;

/**
 * Build file context block for LLM
 */
function buildFileContextBlock(files: ContextFile[]): string {
  return files
    .map((f) => {
      const ext = f.path.split('.').pop() || '';
      const langMap: Record<string, string> = {
        ts: 'typescript',
        tsx: 'tsx',
        js: 'javascript',
        jsx: 'jsx',
        json: 'json',
        css: 'css',
        md: 'markdown',
      };
      const lang = langMap[ext] || ext;

      return `📄 FILE: ${f.path}\n\`\`\`${lang}\n${f.content}\n\`\`\``;
    })
    .join('\n\n');
}

/**
 * Check if question should use RAG
 * Returns true for questions about project structure, features, code
 */
function shouldUseRag(question: string): boolean {
  const ragPatterns = [
    // بنية / structure
    /بنية|هيكل|تنظيم|structure|architecture|organized|folder|directory/i,
    // كيف يعمل / how does it work
    /كيف|إزاي|how\s+(does|do|is|can)/i,
    // أين / where
    /فين|وين|أين|where|find|located/i,
    // اشرح / explain
    /اشرح|explain|describe|tell me about/i,
    // كود / code
    /كود|code|function|class|component|hook/i,
    // ملف / file
    /ملف|file|module|import/i,
    // API / route
    /api|route|endpoint|page/i,
    // أي مكون / any component
    /مكون|component|widget/i,
    // تسجيل / auth
    /login|auth|تسجيل|دخول/i,
    // دفع / payment
    /payment|billing|دفع|فاتورة|stripe/i,
  ];

  return ragPatterns.some((p) => p.test(question));
}

/**
 * Build RAG-enriched messages for the agent
 * If projectRoot is provided and question is relevant, uses indexed context
 */
export async function buildRagEnrichedMessages(
  input: HandleAgentMessageInput
): Promise<RagEnrichedResult> {
  const {
    projectRoot,
    userQuestion,
    activeFilePath,
    activeFileContent,
    language = 'ar',
    existingMessages = [],
  } = input;

  // Check if we should use RAG
  const useRag = projectRoot && shouldUseRag(userQuestion);

  if (!useRag) {
    // No RAG - use default messages
    const systemPrompt =
      language === 'ar'
        ? 'أنت وكيل كود F0 داخل F0 Desktop IDE. ساعد المستخدم في كتابة وتحسين الكود.'
        : 'You are the F0 Code Agent inside F0 Desktop IDE. Help the user write and improve code.';

    const messages: F0ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...existingMessages.filter((m) => m.role !== 'system'),
      { role: 'user', content: userQuestion },
    ];

    return {
      messages,
      contextFiles: [],
      usedRag: false,
    };
  }

  // Use RAG - get context from index
  console.log('[RAG] Building enriched messages for:', userQuestion.slice(0, 50));

  try {
    const { messages: ragMessages, contextFiles } = await buildContextMessages({
      projectRoot: projectRoot!,
      userQuestion,
      activeFilePath,
      activeFileContent,
      language,
    });

    // Convert to F0ChatMessage format
    const f0Messages: F0ChatMessage[] = ragMessages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    // Replace system prompt with our stronger version
    if (f0Messages.length > 0 && f0Messages[0].role === 'system') {
      f0Messages[0].content =
        language === 'ar' ? RAG_SYSTEM_PROMPT_AR : RAG_SYSTEM_PROMPT_EN;
    }

    console.log('[RAG] Context files found:', contextFiles.length);
    console.log(
      '[RAG] Files:',
      contextFiles.map((f) => f.path)
    );

    return {
      messages: f0Messages,
      contextFiles,
      usedRag: true,
    };
  } catch (err) {
    console.error('[RAG] Error building context:', err);

    // Fallback to non-RAG
    const systemPrompt =
      language === 'ar'
        ? 'أنت وكيل كود F0. حدث خطأ في تحميل السياق.'
        : 'You are the F0 Code Agent. Error loading context.';

    return {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuestion },
      ],
      contextFiles: [],
      usedRag: false,
    };
  }
}

/**
 * Build context string for Cloud Agent API
 * This is sent as part of the message to include RAG context
 */
export async function buildRagContextForCloudAgent(
  input: HandleAgentMessageInput
): Promise<{ enrichedMessage: string; contextFiles: ContextFile[]; usedRag: boolean }> {
  const {
    projectRoot,
    userQuestion,
    activeFilePath,
    activeFileContent,
    language = 'ar',
  } = input;

  // Check if we should use RAG
  if (!projectRoot || !shouldUseRag(userQuestion)) {
    return {
      enrichedMessage: userQuestion,
      contextFiles: [],
      usedRag: false,
    };
  }

  try {
    const { contextFiles } = await buildContextMessages({
      projectRoot: projectRoot!,
      userQuestion,
      activeFilePath,
      activeFileContent,
      language,
    });

    if (contextFiles.length === 0) {
      return {
        enrichedMessage: userQuestion,
        contextFiles: [],
        usedRag: false,
      };
    }

    // Build enriched message with context
    const contextBlock = buildFileContextBlock(contextFiles);

    const prefix =
      language === 'ar'
        ? '📚 ملفات المشروع ذات الصلة:\n\n'
        : '📚 Relevant project files:\n\n';

    const suffix =
      language === 'ar'
        ? '\n\n---\n\n❓ السؤال:\n'
        : '\n\n---\n\n❓ Question:\n';

    const enrichedMessage = `${prefix}${contextBlock}${suffix}${userQuestion}`;

    console.log('[RAG] Enriched message length:', enrichedMessage.length);
    console.log('[RAG] Context files included:', contextFiles.length);

    return {
      enrichedMessage,
      contextFiles,
      usedRag: true,
    };
  } catch (err) {
    console.error('[RAG] Error building context for cloud:', err);
    return {
      enrichedMessage: userQuestion,
      contextFiles: [],
      usedRag: false,
    };
  }
}

export default buildRagEnrichedMessages;

// ============================================
// Phase 167.1: Code Location Intent Detection
// Phase 167.2: Code Location v2 - Improved keyword extraction & normalization
// ============================================

/**
 * Phase 167.2: Normalize question before intent detection
 * - Remove Arabic quotes (« »)
 * - Remove question marks (? ؟)
 * - Remove extra spaces
 * - Trim whitespace
 */
function normalizeQuestion(question: string): string {
  return question
    .replace(/[«»"„"]/g, '"')     // Normalize quotes
    .replace(/[?؟!]/g, '')        // Remove question marks
    .replace(/\s+/g, ' ')          // Collapse multiple spaces
    .trim();
}

/**
 * Phase 167.2: Extract keywords with multiple variations
 * e.g., "Code Evolution Engine" → ["Code Evolution Engine", "CodeEvolutionEngine", "evolutionEngine", "Code Evolution"]
 */
function extractKeywordVariations(phrase: string): string[] {
  const variations: string[] = [];
  const trimmed = phrase.trim();

  if (!trimmed) return variations;

  // Original phrase
  variations.push(trimmed);

  // PascalCase version (CodeEvolutionEngine)
  const pascalCase = trimmed
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
  if (pascalCase !== trimmed) {
    variations.push(pascalCase);
  }

  // camelCase version (codeEvolutionEngine)
  const camelCase = trimmed
    .split(/\s+/)
    .map((w, i) => i === 0
      ? w.toLowerCase()
      : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join('');
  if (camelCase !== trimmed && camelCase !== pascalCase) {
    variations.push(camelCase);
  }

  // snake_case version (code_evolution_engine)
  const snakeCase = trimmed.toLowerCase().replace(/\s+/g, '_');
  if (snakeCase !== trimmed.toLowerCase()) {
    variations.push(snakeCase);
  }

  // kebab-case version (code-evolution-engine)
  const kebabCase = trimmed.toLowerCase().replace(/\s+/g, '-');
  if (kebabCase !== trimmed.toLowerCase()) {
    variations.push(kebabCase);
  }

  // Individual words if phrase has multiple words
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    // Last two words combined
    const lastTwo = words.slice(-2).join(' ');
    if (!variations.includes(lastTwo)) {
      variations.push(lastTwo);
    }

    // Each significant word (length > 3)
    words.forEach(word => {
      if (word.length > 3 && !variations.includes(word)) {
        variations.push(word);
      }
    });
  }

  return variations;
}

/**
 * Intent detection result
 */
export interface CodeLocationIntent {
  isCodeLocation: boolean;
  keywords: string[];
  topic: string;
  normalizedQuestion: string; // Phase 167.2: Store normalized question
}

/**
 * Code location search result with file info
 */
export interface CodeLocationResult {
  path: string;
  score: number;
  reason: string;
  snippet?: string;
  isMainEntry?: boolean; // Phase 167.2: Mark main entrypoint file
}

/**
 * Result from code location search
 */
export interface CodeLocationSearchResult {
  intent: CodeLocationIntent;
  results: CodeLocationResult[];
  usedSearch: boolean;
}

/**
 * Phase 167.1: Detect if user is asking "where is the code that handles X?"
 * Phase 167.2: Now uses normalizeQuestion before pattern matching
 * Patterns supported:
 * - Arabic: "فين الكود اللي...", "أي ملف مسؤول عن...", "الكود اللي بيعمل..."
 * - English: "where is the code that...", "which file handles...", "find the code for..."
 */
export function detectCodeLocationIntent(question: string): CodeLocationIntent {
  // Phase 167.2: Normalize question first
  const normalized = normalizeQuestion(question);
  const q = normalized.toLowerCase();

  // Arabic patterns for code location
  const arabicPatterns = [
    /فين\s+(الكود|الملف|الفانكشن|الـ?\s*function|الـ?\s*hook|المكون|الـ?\s*component)/i,
    /أين\s+(الكود|الملف|الفانكشن|الـ?\s*function)/i,
    /وين\s+(الكود|الملف|الفانكشن)/i,
    /أي\s+ملف\s+(مسؤول|بيتعامل|بيعمل|handles?)/i,
    /الكود\s+(اللي\s+)?بيتعامل\s+مع/i,
    /الكود\s+(اللي\s+)?بيعمل/i,
    /مين\s+المسؤول\s+عن/i,
    /مكان\s+(الكود|الملف)/i,
  ];

  // English patterns for code location
  const englishPatterns = [
    /where\s+(is|are|can\s+i\s+find)\s+(the\s+)?(code|file|function|hook|component)/i,
    /which\s+(file|module|component)\s+(handles?|deals?\s+with|is\s+responsible)/i,
    /find\s+(the\s+)?(code|file|function)\s+(for|that|which)/i,
    /locate\s+(the\s+)?(code|file|function)/i,
    /what\s+file\s+(handles?|contains?|has)/i,
    /where\s+do\s+(we|i)\s+(handle|process|implement)/i,
    /show\s+me\s+(the\s+)?(code|file|files?)\s+(for|that)/i,
  ];

  // Check Arabic patterns
  for (const pattern of arabicPatterns) {
    if (pattern.test(q)) {
      const keywords = extractKeywordsV2(normalized);
      const topic = extractTopic(normalized, 'ar');
      return {
        isCodeLocation: true,
        keywords,
        topic,
        normalizedQuestion: normalized,
      };
    }
  }

  // Check English patterns
  for (const pattern of englishPatterns) {
    if (pattern.test(q)) {
      const keywords = extractKeywordsV2(normalized);
      const topic = extractTopic(normalized, 'en');
      return {
        isCodeLocation: true,
        keywords,
        topic,
        normalizedQuestion: normalized,
      };
    }
  }

  return {
    isCodeLocation: false,
    keywords: [],
    topic: '',
    normalizedQuestion: normalized,
  };
}

/**
 * Extract keywords from a code location question (legacy)
 */
function extractKeywords(question: string): string[] {
  const q = question.toLowerCase();
  const keywords: string[] = [];

  // Common technical terms that might be search keywords
  const technicalTerms = [
    'auth', 'login', 'logout', 'register', 'signup', 'signin',
    'payment', 'billing', 'stripe', 'checkout', 'cart',
    'user', 'profile', 'account', 'settings',
    'api', 'route', 'endpoint', 'handler',
    'database', 'firebase', 'firestore', 'mongo',
    'upload', 'download', 'file', 'image', 'media',
    'error', 'validation', 'form', 'input',
    'navigation', 'router', 'routing', 'page',
    'component', 'hook', 'context', 'provider',
    'email', 'notification', 'message', 'chat',
    'search', 'filter', 'sort', 'pagination',
    'dashboard', 'admin', 'panel', 'analytics',
  ];

  // Extract technical terms found in the question
  for (const term of technicalTerms) {
    if (q.includes(term)) {
      keywords.push(term);
    }
  }

  // Also try to extract quoted terms or specific file names
  const quotedMatch = question.match(/["'`]([^"'`]+)["'`]/);
  if (quotedMatch) {
    keywords.push(quotedMatch[1]);
  }

  // Extract camelCase or snake_case identifiers
  const identifierMatch = question.match(/[a-zA-Z][a-zA-Z0-9_]*(?:[A-Z][a-zA-Z0-9]*)+/g);
  if (identifierMatch) {
    keywords.push(...identifierMatch);
  }

  return [...new Set(keywords)]; // Remove duplicates
}

/**
 * Phase 167.2: Improved keyword extraction with variations
 * Extracts quoted phrases, technical terms, and generates variations
 */
function extractKeywordsV2(question: string): string[] {
  const keywords: string[] = [];
  const q = question.toLowerCase();

  // 1. Extract quoted phrases first (highest priority)
  // Support multiple quote styles: "", '', ``, «»
  const quotedMatches = question.matchAll(/["'"«»`]([^"'"«»`]+)["'"«»`]/g);
  for (const match of quotedMatches) {
    const phrase = match[1].trim();
    if (phrase.length > 2) {
      // Add the phrase and all its variations
      keywords.push(...extractKeywordVariations(phrase));
    }
  }

  // 2. Extract camelCase/PascalCase identifiers from the question
  const identifierMatches = question.matchAll(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g);
  for (const match of identifierMatches) {
    keywords.push(match[1]);
    // Also add space-separated version
    const spaced = match[1].replace(/([A-Z])/g, ' $1').trim();
    if (!keywords.includes(spaced)) {
      keywords.push(spaced);
    }
  }

  // 3. Extract snake_case identifiers
  const snakeMatches = question.matchAll(/\b([a-z]+(?:_[a-z]+)+)\b/g);
  for (const match of snakeMatches) {
    keywords.push(match[1]);
  }

  // 4. Common technical terms (fallback if no specific terms found)
  const technicalTerms = [
    'auth', 'login', 'logout', 'register', 'signup', 'signin',
    'payment', 'billing', 'stripe', 'checkout', 'cart', 'wallet',
    'user', 'profile', 'account', 'settings', 'preferences',
    'api', 'route', 'endpoint', 'handler', 'controller',
    'database', 'firebase', 'firestore', 'mongo', 'sql',
    'upload', 'download', 'file', 'image', 'media', 'attachment',
    'error', 'validation', 'form', 'input', 'schema',
    'navigation', 'router', 'routing', 'page', 'layout',
    'component', 'hook', 'context', 'provider', 'store',
    'email', 'notification', 'message', 'chat', 'realtime',
    'search', 'filter', 'sort', 'pagination', 'query',
    'dashboard', 'admin', 'panel', 'analytics', 'metrics',
    'agent', 'orchestrator', 'executor', 'engine', 'runner',
    'rag', 'memory', 'embedding', 'vector', 'similarity',
    'ide', 'editor', 'code', 'patch', 'diff', 'refactor',
    'deploy', 'build', 'preview', 'production', 'staging',
    'test', 'spec', 'mock', 'fixture', 'assertion',
    'evolution', 'optimization', 'quality', 'score', 'ace',
  ];

  for (const term of technicalTerms) {
    if (q.includes(term) && !keywords.some(k => k.toLowerCase().includes(term))) {
      keywords.push(term);
    }
  }

  // 5. Remove duplicates and empty strings
  const uniqueKeywords = [...new Set(keywords.filter(k => k && k.length > 1))];

  console.log('[Code Location v2] Extracted keywords:', uniqueKeywords);
  return uniqueKeywords;
}

/**
 * Extract the topic/subject from the question
 */
function extractTopic(question: string, lang: 'ar' | 'en'): string {
  const q = question.trim();

  if (lang === 'ar') {
    // Try to extract topic after common phrases
    const topicPatterns = [
      /بيتعامل\s+مع\s+(.+?)(?:\?|$)/i,
      /بيعمل\s+(.+?)(?:\?|$)/i,
      /مسؤول\s+عن\s+(.+?)(?:\?|$)/i,
      /الخاص\s+بـ?\s*(.+?)(?:\?|$)/i,
    ];

    for (const pattern of topicPatterns) {
      const match = q.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
  } else {
    // English topic extraction
    const topicPatterns = [
      /handles?\s+(.+?)(?:\?|$)/i,
      /deals?\s+with\s+(.+?)(?:\?|$)/i,
      /responsible\s+for\s+(.+?)(?:\?|$)/i,
      /(?:code|file|function)\s+(?:for|that)\s+(.+?)(?:\?|$)/i,
    ];

    for (const pattern of topicPatterns) {
      const match = q.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
  }

  return '';
}

/**
 * Phase 167.1: Search project for code location
 * Uses searchProjectIndex to find relevant files
 */
export async function searchCodeLocation(
  projectRoot: string,
  intent: CodeLocationIntent,
  limit: number = 10
): Promise<CodeLocationResult[]> {
  if (!intent.isCodeLocation || intent.keywords.length === 0) {
    // Try searching with the topic if no keywords
    if (intent.topic) {
      const results = await searchProjectIndex(projectRoot, intent.topic, 'all', limit);
      return results.map(r => ({
        path: r.path,
        score: r.score,
        reason: r.reason,
        snippet: r.snippet,
      }));
    }
    return [];
  }

  // Search for each keyword and merge results
  const allResults = new Map<string, CodeLocationResult>();

  for (const keyword of intent.keywords) {
    try {
      const results = await searchProjectIndex(projectRoot, keyword, 'all', limit);

      for (const result of results) {
        const existing = allResults.get(result.path);
        if (!existing || result.score > existing.score) {
          allResults.set(result.path, {
            path: result.path,
            score: result.score,
            reason: result.reason,
            snippet: result.snippet,
          });
        }
      }
    } catch (err) {
      console.error(`[Code Location] Error searching for "${keyword}":`, err);
    }
  }

  // Also search with the topic
  if (intent.topic) {
    try {
      const topicResults = await searchProjectIndex(projectRoot, intent.topic, 'all', limit);
      for (const result of topicResults) {
        const existing = allResults.get(result.path);
        if (!existing || result.score > existing.score) {
          allResults.set(result.path, {
            path: result.path,
            score: result.score,
            reason: result.reason,
            snippet: result.snippet,
          });
        }
      }
    } catch (err) {
      console.error(`[Code Location] Error searching for topic "${intent.topic}":`, err);
    }
  }

  // Sort by score and return top results
  const sortedResults = Array.from(allResults.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  console.log('[Code Location] Found', sortedResults.length, 'files');
  return sortedResults;
}

/**
 * Phase 167.2: Special system prompt for code_location intent
 * Instructs the LLM to return a clear list of files with roles
 */
const CODE_LOCATION_SYSTEM_PROMPT_AR = `أنت وكيل F0 متخصص في تحديد مواقع الكود.

مهمتك:
1. حلل الملفات المقدمة في السياق
2. حدد الملف الرئيسي (main entrypoint) اللي بيتعامل مع الموضوع المطلوب
3. اذكر الملفات الثانوية المرتبطة

تنسيق الرد المطلوب (مهم جداً):
📍 **الملفات المتعلقة بـ [الموضوع]:**

⭐ **نقطة الدخول الرئيسية:**
- \`path/to/main/file.ts\` - [وصف قصير للدور]

📁 **ملفات مرتبطة:**
1. \`path/to/related/file1.ts\` - [الدور]
2. \`path/to/related/file2.ts\` - [الدور]

ملاحظات:
- اكتب مسار الملف كاملاً بين backticks
- لا تذكر ملفات غير موجودة في السياق`;

const CODE_LOCATION_SYSTEM_PROMPT_EN = `You are the F0 Agent specialized in locating code.

Your task:
1. Analyze the files provided in the context
2. Identify the main entrypoint file that handles the requested topic
3. List related secondary files

Required response format (very important):
📍 **Files related to [topic]:**

⭐ **Main entrypoint:**
- \`path/to/main/file.ts\` - [short role description]

📁 **Related files:**
1. \`path/to/related/file1.ts\` - [role]
2. \`path/to/related/file2.ts\` - [role]

Notes:
- Write the full file path between backticks
- Do not mention files that are not in the context`;

/**
 * Phase 167.1 + 167.2: Build enriched message with code location results
 * Formats search results as RAG context for the LLM
 * Phase 167.2: Now includes special system prompt and clearer file format
 */
export function buildCodeLocationContext(
  results: CodeLocationResult[],
  language: 'ar' | 'en'
): string {
  if (results.length === 0) {
    return '';
  }

  // Phase 167.2: Add system prompt for code_location intent
  const systemPrompt = language === 'ar'
    ? CODE_LOCATION_SYSTEM_PROMPT_AR
    : CODE_LOCATION_SYSTEM_PROMPT_EN;

  const contextHeader = language === 'ar'
    ? '📚 **ملفات المشروع المتعلقة بالسؤال:**\n\n'
    : '📚 **Project files related to the question:**\n\n';

  // Phase 167.2: Format files in a way that parseGeneratedFiles can detect
  const fileList = results.map((r, i) => {
    const isMain = i === 0 && r.score >= 70;
    const roleMarker = isMain ? '⭐ (main)' : '';
    const snippetPreview = r.snippet
      ? `\n   Preview: ${r.snippet.slice(0, 150).replace(/\n/g, ' ')}...`
      : '';

    return `${i + 1}. \`${r.path}\` ${roleMarker}
   Relevance: ${r.reason}${snippetPreview}`;
  }).join('\n\n');

  const instruction = language === 'ar'
    ? '\n\n---\n⚡ **تعليمات:** بناءً على الملفات أعلاه، حدد الملف الرئيسي والملفات المرتبطة بشكل واضح.'
    : '\n\n---\n⚡ **Instructions:** Based on the files above, clearly identify the main file and related files.';

  return `[SYSTEM_INSTRUCTION]\n${systemPrompt}\n[/SYSTEM_INSTRUCTION]\n\n${contextHeader}${fileList}${instruction}`;
}

/**
 * Phase 167.2: Check if a result should be marked as main entrypoint
 */
export function markMainEntrypoint(results: CodeLocationResult[]): CodeLocationResult[] {
  if (results.length === 0) return results;

  // Sort by score descending
  const sorted = [...results].sort((a, b) => b.score - a.score);

  // Mark the highest scoring file as main entry if score >= 70
  return sorted.map((r, i) => ({
    ...r,
    isMainEntry: i === 0 && r.score >= 70,
  }));
}

/**
 * Phase 167.1: Combined function to detect intent and search
 */
export async function handleCodeLocationQuery(
  projectRoot: string,
  userQuestion: string,
  language: 'ar' | 'en' = 'ar'
): Promise<CodeLocationSearchResult> {
  // Detect intent
  const intent = detectCodeLocationIntent(userQuestion);

  if (!intent.isCodeLocation) {
    return {
      intent,
      results: [],
      usedSearch: false,
    };
  }

  console.log('[Code Location] Intent detected:', {
    keywords: intent.keywords,
    topic: intent.topic,
  });

  // Search project
  const results = await searchCodeLocation(projectRoot, intent);

  return {
    intent,
    results,
    usedSearch: true,
  };
}

// ============================================
// Phase 180: Shell Agent and Browser Agent Re-exports
// ============================================

export {
  detectShellCommandIntent,
  formatShellResult,
  formatBlockedMessage,
  type ShellCommandIntent,
} from './shellAgent';

export {
  detectBrowserIntent,
  fetchWebContent,
  formatFetchedContent,
  formatBlockedUrlMessage,
  // Phase 180.9: Web Search Intent
  detectWebSearchIntent,
  buildSearchUrl,
  formatWebSearchContext,
  mightNeedWebSearch,
  type BrowserFetchIntent,
  type FetchedContent,
  type WebSearchIntent,
} from './browserAgent';
