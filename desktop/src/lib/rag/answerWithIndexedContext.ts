// desktop/src/lib/rag/answerWithIndexedContext.ts
// Phase 122.1: RAG-Lite Strategy - Answer questions using indexed context
// Builds LLM prompt with relevant files from the project index

import {
  getContextFilesFromIndex,
  getQuickContext,
  type ContextFile,
} from './projectContextFromIndex';

/**
 * LLM chat message format
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LLM client interface
 */
export interface LLMClient {
  chat(messages: ChatMessage[]): Promise<string>;
}

/**
 * Options for answering with indexed context
 */
export interface AnswerWithContextOptions {
  llm: LLMClient;
  projectRoot: string;
  userQuestion: string;
  activeFilePath?: string | null;
  activeFileContent?: string | null;
  maxContextFiles?: number;
  maxCharsPerFile?: number;
  language?: 'en' | 'ar';
}

/**
 * Result from answering with context
 */
export interface AnswerWithContextResult {
  answer: string;
  contextFiles: ContextFile[];
  tokensEstimate?: number;
}

/**
 * Get language extension from file path
 */
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    json: 'json',
    css: 'css',
    scss: 'scss',
    html: 'html',
    md: 'markdown',
    py: 'python',
    rs: 'rust',
    go: 'go',
  };
  return langMap[ext] || ext;
}

/**
 * Build the context prompt from files
 */
function buildContextPrompt(files: ContextFile[]): string {
  return files
    .map((f) => {
      const lang = getLanguageFromPath(f.path);
      return `📄 FILE: ${f.path}\n\`\`\`${lang}\n${f.content}\n\`\`\``;
    })
    .join('\n\n');
}

/**
 * Estimate token count (rough: 4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if question is about project architecture/structure
 */
function isArchitectureQuestion(question: string): boolean {
  const patterns = [
    /بنية|هيكل|تنظيم|structure|architecture|organized/i,
    /كيف يعمل|إزاي شغال|how (does|do|is).*work/i,
    /ملفات أساسية|main files|entry point/i,
    /folder|directory|مجلد/i,
  ];
  return patterns.some((p) => p.test(question));
}

/**
 * Check if question is about a specific feature
 */
function isFeatureQuestion(question: string): boolean {
  const patterns = [
    /login|auth|تسجيل|دخول|authentication/i,
    /checkout|payment|دفع|فاتورة|billing|subscription/i,
    /api|endpoint|route/i,
    /database|firestore|storage/i,
    /component|مكون/i,
    /hook|state|redux|zustand/i,
  ];
  return patterns.some((p) => p.test(question));
}

/**
 * Answer a question using indexed context from the project
 *
 * This is the main RAG-lite function that:
 * 1. Searches the project index for relevant files
 * 2. Includes the active file if provided
 * 3. Builds a context-rich prompt
 * 4. Sends to LLM and returns the answer
 */
export async function answerWithIndexedContext(
  options: AnswerWithContextOptions
): Promise<AnswerWithContextResult> {
  const {
    llm,
    projectRoot,
    userQuestion,
    activeFilePath,
    activeFileContent,
    maxContextFiles = 6,
    maxCharsPerFile = 4000,
    language = 'en',
  } = options;

  // 1) Get relevant files from the index
  const isArch = isArchitectureQuestion(userQuestion);
  const isFeature = isFeatureQuestion(userQuestion);

  let contextFiles: ContextFile[];

  if (isArch) {
    // For architecture questions, search broadly
    contextFiles = await getContextFilesFromIndex({
      projectRoot,
      query: 'app page layout route component',
      strategy: 'hybrid',
      maxFiles: maxContextFiles,
      maxCharsPerFile,
    });
  } else if (isFeature) {
    // For feature questions, use the user's query
    contextFiles = await getContextFilesFromIndex({
      projectRoot,
      query: userQuestion,
      strategy: 'hybrid',
      maxFiles: maxContextFiles,
      maxCharsPerFile,
    });
  } else {
    // Default: quick search with user's query
    contextFiles = await getQuickContext(projectRoot, userQuestion, maxContextFiles);
  }

  // 2) Add active file if provided (always first in context)
  const filesForPrompt = [...contextFiles];

  if (activeFilePath && activeFileContent) {
    // Check if active file is already in results
    const alreadyIncluded = filesForPrompt.some(
      (f) => f.path === activeFilePath
    );

    if (!alreadyIncluded) {
      filesForPrompt.unshift({
        path: activeFilePath,
        content: activeFileContent.slice(0, maxCharsPerFile + 2000), // Extra space for active file
        score: 100,
        reason: 'active file in editor',
      });
    }
  }

  // Dedupe by path (in case of duplicates)
  const seen = new Set<string>();
  const uniqueFiles = filesForPrompt.filter((f) => {
    if (seen.has(f.path)) return false;
    seen.add(f.path);
    return true;
  });

  // 3) Build the prompt
  const systemPrompt =
    language === 'ar'
      ? `أنت وكيل كود F0. أجب بناءً على ملفات المشروع المقدمة فقط.
عند الشرح، استخدم مسارات الملفات. إذا لم يكن شيء في السياق، قل أنك غير متأكد.
استخدم العربية في الرد.`
      : `You are the F0 Code Agent. Answer strictly based on the provided project files.
When explaining, reference file paths. If something is not in the context, say you are not sure.`;

  const contextBlocks = buildContextPrompt(uniqueFiles);

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'assistant',
      content: `Here are relevant project files from the index:\n\n${contextBlocks}`,
    },
    {
      role: 'user',
      content: `Question:\n${userQuestion}\n\nUse ONLY the files above. Explain with file references like (src/app/page.tsx).`,
    },
  ];

  // 4) Call the LLM
  const answer = await llm.chat(messages);

  // Calculate token estimate
  const totalText = messages.map((m) => m.content).join('\n');
  const tokensEstimate = estimateTokens(totalText) + estimateTokens(answer);

  return {
    answer,
    contextFiles: uniqueFiles,
    tokensEstimate,
  };
}

/**
 * Build messages for streaming (returns messages without calling LLM)
 */
export async function buildContextMessages(
  options: Omit<AnswerWithContextOptions, 'llm'>
): Promise<{ messages: ChatMessage[]; contextFiles: ContextFile[] }> {
  const {
    projectRoot,
    userQuestion,
    activeFilePath,
    activeFileContent,
    maxContextFiles = 6,
    maxCharsPerFile = 4000,
    language = 'en',
  } = options;

  // Get context files
  const contextFiles = await getQuickContext(projectRoot, userQuestion, maxContextFiles);

  // Add active file
  const filesForPrompt = [...contextFiles];
  if (activeFilePath && activeFileContent) {
    const alreadyIncluded = filesForPrompt.some((f) => f.path === activeFilePath);
    if (!alreadyIncluded) {
      filesForPrompt.unshift({
        path: activeFilePath,
        content: activeFileContent.slice(0, maxCharsPerFile + 2000),
        score: 100,
        reason: 'active file',
      });
    }
  }

  // Dedupe
  const seen = new Set<string>();
  const uniqueFiles = filesForPrompt.filter((f) => {
    if (seen.has(f.path)) return false;
    seen.add(f.path);
    return true;
  });

  // Build messages
  const systemPrompt =
    language === 'ar'
      ? `أنت وكيل كود F0. أجب بناءً على ملفات المشروع المقدمة فقط.`
      : `You are the F0 Code Agent. Answer based on the provided project files only.`;

  const contextBlocks = buildContextPrompt(uniqueFiles);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'assistant', content: `Project files:\n\n${contextBlocks}` },
    { role: 'user', content: userQuestion },
  ];

  return { messages, contextFiles: uniqueFiles };
}

export default answerWithIndexedContext;
