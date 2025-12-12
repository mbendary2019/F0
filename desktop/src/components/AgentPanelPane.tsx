// desktop/src/components/AgentPanelPane.tsx
import React, { useState, useCallback } from 'react';
import { useDesktopSettings } from '../hooks/useDesktopSettings';
import { sendChatCompletion, type F0ChatMessage } from '../f0/apiClient';
import { DiffPreviewModal } from './DiffPreviewModal';
import { RefactorDock } from './RefactorDock';
import { RunnerPanel, type RunnerFinishedPayload } from './RunnerPanel';
// Phase 115.3: Import triggerPreviewReload for auto-refresh
import { triggerPreviewReload } from '../state/previewState';
// Phase 112: Runner Context for Agent
import { enrichMessageWithRunnerContext } from '../hooks/useRunner';
import type { ProjectState } from '../hooks/useProjectState';
// Phase 109.5.4: Cloud Agent integration
import {
  sendSelectionToCloudAgent,
  sendChatToCloudAgent,
  mapSafeToSelectionContext,
  type SafeSelection,
  type IdeRefactorEdit,
  type RunnerInsight,
  type ChatHistoryMessage, // Phase 177: Chat memory support
  type RunnerAutoFixAction,
  type ImageAttachmentData, // Phase 168.3
  type DocumentAttachmentData, // Phase 170.2: PDF/Word/Excel
} from '../services/cloudAgent';
// Phase 112.2: Import getRunnerContext for "Ask Agent about last run"
import { getRunnerContext } from '../hooks/useRunner';
// Phase 118: Agent-Aware Runtime Debugging
import { getLastErrorLogs } from '../state/previewLogsState';
import { buildRuntimeDebugContext } from '../lib/agent/runtimeContext';
// Phase 122: RAG-Lite Integration
// Phase 167.1: Code Location Intent Detection
// Phase 180: Shell Agent and Browser Agent
import {
  buildRagContextForCloudAgent,
  handleCodeLocationQuery,
  buildCodeLocationContext,
  type CodeLocationResult,
  // Phase 180.1: Shell Agent
  detectShellCommandIntent,
  formatShellResult,
  formatBlockedMessage,
  type ShellCommandIntent,
  // Phase 180.2: Browser Agent
  detectBrowserIntent,
  fetchWebContent,
  formatFetchedContent,
  formatBlockedUrlMessage,
  type BrowserFetchIntent,
} from '../lib/agent/handleAgentMessage';
import { RagContextPanel } from './RagContextPanel';
import { CodeLocationPanel } from './CodeLocationPanel';
import type { ContextFile } from '../lib/rag';
// Phase 170: Attachment Memory for Multi-Modal Follow-Ups
// Phase 176.7: Import detectMessageLanguage for proper locale detection
import { detectAttachmentReference, detectMessageLanguage } from '../../../src/lib/ide/localeDetector';
// Phase 123: Project Snapshot
import SnapshotButton from './SnapshotButton';
// Phase 124.2 Part 2: Snapshot Context Integration
import { useAgentContext } from '../hooks/useAgentContext';
// Phase 187: Local Project Index for context-aware analysis
import { useProjectIndex } from '../hooks/useProjectIndex';
import type { LocalProjectIndex } from '../services/cloudAgent';

/**
 * Phase 109.4.4: Apply Generated Files with Diff Preview & Undo
 * Now includes diff preview modal and undo functionality
 */
/**
 * Phase 171.15: Analysis status for attachments
 * PENDING = analysis is in progress
 * READY = analysis completed successfully
 * FAILED = analysis failed
 * SKIPPED = analysis was skipped (e.g., text file, unsupported type)
 */
export type AnalysisStatus = 'PENDING' | 'READY' | 'FAILED' | 'SKIPPED';

/**
 * Phase 171.16: Extraction strength classification
 * STRONG = 1200+ chars extracted (reliable analysis)
 * WEAK = 250-1199 chars (partial extraction, may be unreliable)
 * EMPTY = <250 chars (extraction failed or very minimal)
 */
export type ExtractionStrength = 'STRONG' | 'WEAK' | 'EMPTY';

/**
 * Phase 168.2: Image attachment for chat
 * Phase 168.5: Extended for document attachments (PDF, Word, Excel)
 * Phase 171.15: Added analysisStatus for proper state management
 * Phase 171.16: Added extractionStrength to guard against hallucination
 */
export type ImageAttachment = {
  id: string;
  name: string;
  path: string;       // Temp file path
  base64?: string;    // Base64 data for API
  previewUrl: string; // Blob URL for preview (or icon for documents)
  mimeType: string;
  /** Phase 168.5: Attachment type - image uses Vision API, document sends text */
  attachmentType?: 'image' | 'document' | 'audio';
  /** Phase 168.5: Extracted text content for documents (PDF, Word, Excel) */
  extractedText?: string;
  /** Phase 168.5: Document metadata */
  documentMetadata?: {
    pageCount?: number;
    sheetCount?: number;
  };
  /** Phase 171: Auto-analyzed flag (deprecated - use analysisStatus) */
  autoAnalyzed?: boolean;
  /** Phase 171.15: Analysis status - PENDING/READY/FAILED/SKIPPED */
  analysisStatus?: AnalysisStatus;
  /** Phase 171.15: Analysis error message if status is FAILED */
  analysisError?: string;
  /** Phase 171.16: Length of extracted text (for hallucination guard) */
  extractedTextLen?: number;
  /** Phase 171.16: Extraction strength classification */
  extractionStrength?: ExtractionStrength;
};

type Props = {
  settingsVersion: number;
  currentFilePath: string | null;
  currentFileContent: string;
  rootPath: string | null;
  projectState: ProjectState;
  /** Phase 168.2: Pending image attachments from drag & drop */
  pendingAttachments?: ImageAttachment[];
  onClearAttachments?: () => void;
  /** Phase 179.1: Callback to update attachment's extracted text (for transcript editing) */
  onUpdateAttachmentText?: (attachmentId: string, newText: string) => void;
  /** Phase 167.3: Callback to open file in Editor (from Code Location Panel) */
  onOpenFile?: (path: string, name: string, language?: string | null) => void;
};

type GeneratedFileBlock = {
  filePath: string;
  code: string;
};

/**
 * Phase 109.5.2: Selection context for refactoring
 * Stores the selection state at the time of message send
 */
type SelectionContext = {
  filePath: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
};

/**
 * Phase 168.7: Attachment stored in message history
 * Simplified version without base64 data (to avoid memory issues)
 */
type MessageAttachment = {
  id: string;
  name: string;
  previewUrl: string;
  mimeType: string;
  attachmentType: 'image' | 'document' | 'audio';
  /** Brief description shown in chat */
  description?: string;
};

type LocalMessage = {
  id?: string;
  role: 'system' | 'user' | 'assistant' | 'error';
  content: string;
  generatedFiles?: GeneratedFileBlock[];
  // Phase 109.5.2: Selection context for refactoring responses
  selectionContext?: SelectionContext;
  // Phase 109.5.2: Extracted snippets for selection refactor
  extractedSnippets?: string[];
  // Phase 168.7: Attachments shown in chat history
  attachments?: MessageAttachment[];
};

/**
 * Phase 179.1: Audio Transcript Viewer State
 * Tracks which audio attachment's transcript is currently expanded
 */
type AudioTranscriptViewState = {
  attachmentId: string;
  isEditing: boolean;
  editedText: string;
};

/**
 * Phase 170: Remembered attachment for multi-modal follow-ups
 * Stores full attachment data (including base64) for reuse
 */
type RememberedAttachment = ImageAttachment & {
  /** When this attachment was last used */
  lastUsedAt: number;
};

/**
 * Helper to guess language ID from file extension
 */
function guessLanguageId(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.tsx')) return 'typescriptreact';
  if (lower.endsWith('.ts')) return 'typescript';
  if (lower.endsWith('.jsx')) return 'javascriptreact';
  if (lower.endsWith('.js')) return 'javascript';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.html')) return 'html';
  if (lower.endsWith('.md')) return 'markdown';
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.go')) return 'go';
  if (lower.endsWith('.rs')) return 'rust';
  return 'plaintext';
}

/**
 * Check if a string looks like a valid file path
 * Must contain a path separator and end with a file extension
 */
function looksLikeFilePath(text: string): boolean {
  // Must have a path separator (/ or \) and end with a file extension
  return /[\\/]/.test(text) && /\.[a-z]{1,5}$/i.test(text);
}

/**
 * Extract file path from a heading that may contain descriptive text
 * e.g., "Overview of `/api/account/export` Endpoint" -> "/api/account/export"
 * or "src/components/Button.tsx" -> "src/components/Button.tsx"
 */
const FILE_IN_HEADING_REGEX = /`([^`]+\.(?:ts|tsx|js|jsx|json|md|css|scss|html|py|go|rs|vue|svelte))`/;

function extractFilePathFromHeading(heading: string): string | null {
  // First, try to extract from backticks (e.g., `src/file.tsx`)
  const backtickMatch = heading.match(FILE_IN_HEADING_REGEX);
  if (backtickMatch) {
    return backtickMatch[1];
  }

  // If the entire heading looks like a file path, use it directly
  const trimmed = heading.trim();
  if (looksLikeFilePath(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Phase 109.4.3: Parse generated files from agent response
 * Looks for markdown headers like "### src/components/Button.tsx"
 * followed by code blocks
 */
function parseGeneratedFiles(content: string): GeneratedFileBlock[] {
  console.log('[parseGeneratedFiles] Starting parse, content length:', content.length);
  const blocks: GeneratedFileBlock[] = [];

  // Match pattern: ### path/to/file.ext followed by ```language\ncode\n```
  const headingRegex = /^###\s+(.+)\s*$/gm;
  let match;
  let matchCount = 0;

  while ((match = headingRegex.exec(content)) !== null) {
    matchCount++;
    const rawHeading = match[1].trim();
    const filePath = extractFilePathFromHeading(rawHeading);
    const startIndex = match.index + match[0].length;

    console.log(`[parseGeneratedFiles] Found heading #${matchCount}: "${rawHeading}"`);

    // Skip if no valid file path extracted
    if (!filePath) {
      console.log(`[parseGeneratedFiles] Skipping - not a file path: "${rawHeading}"`);
      continue;
    }

    console.log(`[parseGeneratedFiles] Extracted file path: "${filePath}"`);

    // Find the next code block after this heading
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/;
    const remainingContent = content.slice(startIndex);
    const codeMatch = codeBlockRegex.exec(remainingContent);

    if (codeMatch && codeMatch[1]) {
      console.log(`[parseGeneratedFiles] Found code block for "${filePath}", code length:`, codeMatch[1].length);
      blocks.push({
        filePath,
        code: codeMatch[1].trim(),
      });
    } else {
      console.warn(`[parseGeneratedFiles] No code block found after heading "${filePath}"`);
    }
  }

  console.log('[parseGeneratedFiles] Total headings found:', matchCount);
  console.log('[parseGeneratedFiles] Total blocks extracted:', blocks.length);
  return blocks;
}

/**
 * Phase 109.5.2: Extract code snippets from agent response
 * For selection-aware refactoring, we look for code blocks without file headers
 * Returns array of code snippets (usually just one for selection refactor)
 */
function extractSnippets(content: string): string[] {
  console.log('[extractSnippets] Starting extraction, content length:', content.length);
  const snippets: string[] = [];

  // Match all code blocks: ```language\ncode\n```
  const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match[1] && match[1].trim().length > 0) {
      snippets.push(match[1].trim());
      console.log(`[extractSnippets] Found snippet #${snippets.length}, length:`, match[1].trim().length);
    }
  }

  console.log('[extractSnippets] Total snippets extracted:', snippets.length);
  return snippets;
}

/**
 * Phase 112.1: Format runner logs payload into a string for agent context
 * Converts the stored RunnerFinishedPayload into a readable format
 */
function formatRunnerLogsForContext(payload: RunnerFinishedPayload | null): string | undefined {
  if (!payload) return undefined;

  const statusEmoji = payload.status === 'success' ? '✅' :
                      payload.status === 'failed' ? '❌' : '⏹️';

  const parts: string[] = [
    `${statusEmoji} Command: ${payload.command}`,
    `Exit Code: ${payload.exitCode ?? 'N/A'}`,
    `Status: ${payload.status}`,
    `Duration: ${payload.duration ? `${(payload.duration / 1000).toFixed(1)}s` : 'N/A'}`,
    '',
    '--- Output ---',
  ];

  // Add logs (prioritize stderr for errors, limit total lines)
  const stderrLogs = payload.logs.filter(l => l.stream === 'stderr');
  const stdoutLogs = payload.logs.filter(l => l.stream === 'stdout');

  // If there are errors, show stderr first
  if (stderrLogs.length > 0) {
    parts.push('[stderr]');
    stderrLogs.slice(-30).forEach(l => parts.push(l.chunk.trimEnd()));
  }

  // Then show stdout (limited)
  if (stdoutLogs.length > 0 && stderrLogs.length < 20) {
    parts.push('[stdout]');
    stdoutLogs.slice(-20).forEach(l => parts.push(l.chunk.trimEnd()));
  }

  return parts.join('\n');
}

/**
 * Phase 112.1 (Simplified): Extract command from agent response
 * Fallback if server doesn't return commandIntent
 *
 * Just looks for any line starting with pnpm/npm/yarn/npx/bun
 * Works with backticks, code blocks, or plain text
 */
function extractCommandFromResponse(content: string): string | null {
  // Remove markdown formatting
  const cleaned = content
    .replace(/```[\w]*\n?/g, '')  // Remove code block markers
    .replace(/`/g, '');           // Remove backticks

  // Check each line
  for (const line of cleaned.split('\n')) {
    const trimmed = line.trim();
    // أي سطر يبدأ بـ pnpm / npm / yarn / npx / bun
    if (/^(pnpm|npm|yarn|npx|bun)\s+/i.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

/**
 * Phase 109.5.3: Compute match score between selection and snippet
 * Returns 0-1 score based on token overlap
 * Helps detect when agent returns unrelated generic code
 */
function computeSelectionMatchScore(selected: string, snippet: string): number {
  const tokenize = (code: string) =>
    Array.from(
      new Set(
        code
          .split(/[^A-Za-z0-9_]+/)
          .filter((t) =>
            t.length >= 3 &&
            !['const', 'let', 'var', 'import', 'from', 'react', 'function', 'return', 'export', 'default', 'async', 'await'].includes(t.toLowerCase())
          )
      )
    );

  const selTokens = tokenize(selected);
  const snipTokens = tokenize(snippet);

  if (selTokens.length === 0 || snipTokens.length === 0) return 0;

  let overlap = 0;
  for (const t of selTokens) {
    if (snipTokens.some(st => st.toLowerCase() === t.toLowerCase())) overlap++;
  }

  const score = overlap / selTokens.length;
  console.log('[computeSelectionMatchScore] Score:', score, 'Overlap:', overlap, '/', selTokens.length);
  return score;
}

export const AgentPanelPane: React.FC<Props> = ({
  settingsVersion,
  currentFilePath,
  currentFileContent,
  rootPath,
  projectState,
  pendingAttachments = [],
  onClearAttachments,
  onUpdateAttachmentText,
  onOpenFile,
}) => {
  const settings = useDesktopSettings(settingsVersion);

  // Phase 187: Local Project Index for context-aware analysis
  const { index: projectIndex } = useProjectIndex(rootPath || undefined);

  // Phase 124.2 Part 2: Snapshot Context Hook
  const {
    snapshot,
    snapshotSummary,
    hasSnapshot,
    isFresh: isSnapshotFresh,
    buildEnrichedMessage: buildSnapshotEnrichedMessage,
    getSystemMessage: getSnapshotSystemMessage,
  } = useAgentContext({
    projectRoot: rootPath || '',
    projectId: settings.projectId,
    autoLoad: true,
    language: (settings.locale || 'ar') as 'ar' | 'en',
  });

  // Phase 113.3: Bilingual support
  const locale = settings.locale || 'ar';
  const isArabic = locale === 'ar';

  // Phase 113.3: Bilingual labels
  const labels = {
    title: isArabic ? 'وكيل F0' : 'F0 CODE AGENT',
    greeting: isArabic
      ? 'مرحباً! أنا وكيل F0 للأكواد. اضبط الإعدادات واسألني أي شيء!'
      : "Hello! I'm your F0 Code Agent. Configure your settings and ask me anything!",
    you: isArabic ? 'أنت:' : 'You:',
    agent: isArabic ? 'وكيل F0:' : 'F0 Agent:',
    error: isArabic ? 'خطأ:' : 'Error:',
    system: isArabic ? 'النظام:' : 'System:',
    thinking: isArabic ? 'جاري التفكير...' : 'Thinking...',
    send: isArabic ? 'إرسال' : 'Send',
    sending: isArabic ? 'جاري الإرسال...' : 'Sending...',
    undoLastChange: isArabic ? 'تراجع عن آخر تغيير' : 'Undo last AI change',
    revertedChange: isArabic ? '↩️ تم التراجع عن آخر تغيير AI' : '↩️ Reverted last AI change',
    context: isArabic ? 'السياق' : 'Context',
    cloudAgent: isArabic ? '☁️ وكيل سحابي' : '☁️ Cloud Agent',
    cloudDev: isArabic ? '☁️ سحابي (تطوير)' : '☁️ Cloud (Dev)',
    localAgent: isArabic ? '🏠 وكيل محلي' : '🏠 Local Agent',
    reviewApply: isArabic ? 'مراجعة وتطبيق' : 'Review & Apply',
    applyToSelection: isArabic ? 'تطبيق على التحديد' : 'Apply to Selection',
    applyAnyway: isArabic ? '⚠️ تطبيق على أي حال' : '⚠️ Apply Anyway',
    mayNotMatch: isArabic ? '⚠️ قد لا يتطابق مع تحديدك' : '⚠️ May not match your selection',
    snippet: isArabic ? 'مقطع' : 'Snippet',
    chars: isArabic ? 'حرف' : 'chars',
    refactoredCode: isArabic ? '🎯 كود معاد بناؤه للتحديد في:' : '🎯 Refactored code for selection in:',
    selectionDetected: isArabic ? 'تم اكتشاف تحديد' : 'Selection detected',
    describeRefactor: isArabic ? '- وصف كيفية إعادة البناء' : '- describe how to refactor it',
    placeholderSelection: isArabic
      ? 'اطلب من F0 إعادة بناء الكود المحدد... (مثلاً، "أضف معالجة الأخطاء"، "استخرج كمكون")'
      : "Ask F0 to refactor the selected code... (e.g., 'Add error handling', 'Extract to component')",
    placeholderGeneral: isArabic
      ? 'اطلب من F0 المساعدة في الكود... (Cmd/Ctrl+Enter للإرسال)'
      : 'Ask F0 to help with your code... (Cmd/Ctrl+Enter to send)',
    runQa: isArabic ? '🧪 تشغيل QA' : '🧪 Run QA',
    runningQa: isArabic ? '⏳ جاري QA...' : '⏳ Running QA...',
    hideRunner: isArabic ? '🖥️ إخفاء Runner' : '🖥️ Hide Runner',
    showRunner: isArabic ? '🖥️ إظهار Runner' : '🖥️ Show Runner',
    configureApiKey: isArabic ? 'يرجى إعداد مفتاح API في الإعدادات أولاً.' : 'Please configure your API Key in Settings first.',
    configureProjectId: isArabic ? 'يرجى إعداد معرف المشروع في الإعدادات لوضع السحابة.' : 'Please configure your Project ID in Settings for Cloud mode.',
    noFolderOpened: isArabic ? 'لا يمكن تطبيق تغييرات الملف: لم يتم فتح مجلد مشروع.' : 'Cannot apply file changes: no project folder opened.',
    appliedFile: isArabic ? '✅ تم تطبيق الملف المولد على:' : '✅ Applied generated file to:',
    appliedSelection: isArabic ? '✅ تم تطبيق الكود المعاد بناؤه على التحديد في:' : '✅ Applied refactored code to selection in:',
    appliedEdit: isArabic ? '✅ تم تطبيق التعديل على:' : '✅ Applied edit to:',
    // Phase 122.6: AuthGuard labels
    protectWithAuth: isArabic ? '🔐 حماية بـ Auth' : '🔐 Protect with Auth',
    protectingWithAuth: isArabic ? '⏳ جاري الحماية...' : '⏳ Protecting...',
    protectedWithAuth: isArabic ? '✅ تمت إضافة AuthGuard' : '✅ AuthGuard added',
    noFileOpen: isArabic ? 'لا يوجد ملف مفتوح للحماية' : 'No file open to protect',
  };

  const [messages, setMessages] = useState<LocalMessage[]>([
    {
      role: 'assistant',
      content: labels.greeting,
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Phase 109.4.4: State for diff preview modal
  const [diffPreviewState, setDiffPreviewState] = useState<{
    file: GeneratedFileBlock;
    oldContent: string;
  } | null>(null);

  // Phase 109.5.2: State for selection refactor diff preview
  const [selectionDiffState, setSelectionDiffState] = useState<{
    snippet: string;
    selectionContext: SelectionContext;
  } | null>(null);

  // Phase 110.2: State for RefactorDock (pending edits from Cloud Agent)
  const [pendingEdits, setPendingEdits] = useState<IdeRefactorEdit[]>([]);
  const [isRefactorDockOpen, setIsRefactorDockOpen] = useState(false);
  const [isApplyingEdit, setIsApplyingEdit] = useState(false);

  // Phase 110.3: State for QA
  const [isRunningQa, setIsRunningQa] = useState(false);
  const [qaResult, setQaResult] = useState<{ status: 'passed' | 'failed' | 'error'; summary: string } | null>(null);

  // Phase 111.4: State for Runner integration
  const [suggestedCommand, setSuggestedCommand] = useState<string | null>(null);
  const [isRunnerVisible, setIsRunnerVisible] = useState(false);
  // Phase 112.1: Badge to show when command is ready
  const [runnerAutoOpen, setRunnerAutoOpen] = useState(false);
  // Phase 112.1: Store last runner logs for auto-attaching to agent messages
  const [lastRunnerLogs, setLastRunnerLogs] = useState<RunnerFinishedPayload | null>(null);
  // Phase 112.2: Store runner insight for display
  const [runnerInsight, setRunnerInsight] = useState<RunnerInsight | null>(null);
  // Phase 112.3: Store auto-fix actions
  const [autoFixActions, setAutoFixActions] = useState<RunnerAutoFixAction[]>([]);

  // Phase 122: RAG context files for display
  const [ragContextFiles, setRagContextFiles] = useState<ContextFile[]>([]);
  const [showRagContext, setShowRagContext] = useState(false);
  const [isLoadingRag, setIsLoadingRag] = useState(false);

  // Phase 167.1: Code Location results for display
  const [codeLocationResults, setCodeLocationResults] = useState<CodeLocationResult[]>([]);
  const [showCodeLocation, setShowCodeLocation] = useState(false);

  // Phase 170: Attachment Memory for Multi-Modal Follow-Ups
  // Remembers the last attachment sent so user can refer to it in follow-ups
  const [lastAttachment, setLastAttachment] = useState<RememberedAttachment | null>(null);

  // Phase 122.6: AuthGuard protection state
  const [isProtectingWithAuth, setIsProtectingWithAuth] = useState(false);

  // Phase 179.1: Audio Transcript Viewer state
  const [transcriptView, setTranscriptView] = useState<AudioTranscriptViewState | null>(null);

  // Helper to append a new message
  const appendMessage = (msg: LocalMessage) => {
    setMessages((prev) => [...prev, msg]);
  };

  // Helper to update assistant message by ID
  const updateAssistantMessage = (id: string, deltaContent: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, content: m.content + deltaContent } : m
      )
    );
  };

  /**
   * Build fz_context from current file (Phase 109.4.2 + Phase 109.5)
   * Now includes selection if user has text selected
   */
  const buildFzContext = () => {
    if (!currentFilePath) return undefined;

    const languageId = guessLanguageId(currentFilePath);
    const { selection } = projectState;

    // Base context
    const context: Record<string, unknown> = {
      currentFile: {
        path: currentFilePath,
        content: currentFileContent,
        languageId,
      },
      openFiles: [
        {
          path: currentFilePath,
          content: currentFileContent,
          languageId,
        },
      ],
    };

    // Phase 109.5: Add selection if present and valid
    if (
      selection &&
      selection.filePath === currentFilePath &&
      selection.selectedText.trim().length > 0
    ) {
      context.selection = {
        path: selection.filePath,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
        selectedText: selection.selectedText,
      };
      console.log('[AgentPanelPane] Including selection in fz_context:', {
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
        length: selection.selectedText.length,
      });
    }

    return context;
  };

  /**
   * Phase 109.4.4: Helper to normalize file paths
   */
  const normalizeFullPath = (root: string, filePath: string) => {
    console.log('[normalizeFullPath] Input root:', root);
    console.log('[normalizeFullPath] Input filePath:', filePath);

    const trimmedRoot = root.replace(/\/+$/, '');      // Remove trailing / from root

    console.log('[normalizeFullPath] Trimmed root:', trimmedRoot);

    // 🔹 Check if filePath already starts with root (as absolute path)
    if (filePath.startsWith(trimmedRoot + '/') || filePath === trimmedRoot) {
      console.log('[normalizeFullPath] ✅ File already has full path, returning as-is:', filePath);
      return filePath;
    }

    // 🔹 Otherwise: treat it as relative path under root
    const trimmedFile = filePath.replace(/^\/+/, '');  // Remove leading / from filePath
    const result = `${trimmedRoot}/${trimmedFile}`;
    console.log('[normalizeFullPath] ✅ Combined path:', result);
    return result;
  };

  /**
   * Phase 109.4.4: Handle Apply button click
   * Opens diff preview modal instead of directly applying
   */
  const handleApplyClick = async (file: GeneratedFileBlock) => {
    if (!rootPath) {
      appendMessage({
        id: `err-${Date.now()}`,
        role: 'error',
        content: 'Cannot apply file changes: no project folder opened.',
      });
      return;
    }

    const fullPath = normalizeFullPath(rootPath, file.filePath);

    // Read current file content
    const api = window.f0Desktop;
    if (!api) return;

    try {
      const currentContent = await api.readFile(fullPath);
      setDiffPreviewState({ file, oldContent: currentContent });
    } catch (err) {
      // File doesn't exist - use empty string
      setDiffPreviewState({ file, oldContent: '' });
    }
  };

  /**
   * Phase 109.4.4: Confirm diff and apply changes
   * Phase 124.6.1: Auto code review after apply
   */
  const handleConfirmDiff = async () => {
    if (!diffPreviewState || !rootPath) return;

    const { file, oldContent } = diffPreviewState;
    const fullPath = normalizeFullPath(rootPath, file.filePath);

    // 1. Store undo entry
    projectState.pushUndoEntry({
      path: fullPath,
      previousContent: oldContent,
      appliedAt: Date.now(),
      source: 'agent',
    });

    // 2. Apply the change
    await projectState.applyExternalFileChange(fullPath, file.code);

    // 3. Success message
    appendMessage({
      id: `sys-${Date.now()}`,
      role: 'system',
      content: `✅ Applied generated file to: ${file.filePath}`,
    });

    // 4. Close modal
    setDiffPreviewState(null);

    // Phase 115.3: Auto-refresh browser preview after applying file change
    triggerPreviewReload();

    // Phase 124.6.1: Auto code review after apply
    const api = window.f0Desktop as Record<string, unknown> | undefined;
    if (api?.codeReview && typeof api.codeReview === 'function') {
      void (api.codeReview as (input: {
        filePath: string;
        before?: string | null;
        after: string;
        projectRoot?: string;
      }) => Promise<{
        success: boolean;
        issues: Array<{ severity: string; lineStart: number; message: string }>;
      }>)({
        filePath: fullPath,
        before: oldContent,
        after: file.code,
        projectRoot: rootPath,
      }).then((result) => {
        if (result.success && result.issues.length > 0) {
          appendMessage({
            id: `review-${Date.now()}`,
            role: 'system',
            content: `🔍 Code review found ${result.issues.length} issue(s) in ${file.filePath}:\n${result.issues.map((i) => `• [${i.severity}] Line ${i.lineStart}: ${i.message}`).join('\n')}`,
          });
        }
      }).catch(console.error);
    }
  };

  /**
   * Phase 109.5.2: Handle Apply to Selection button click
   * Opens the selection diff preview modal
   */
  const handleApplySelectionClick = (snippet: string, selContext: SelectionContext) => {
    console.log('[AgentPanelPane] handleApplySelectionClick:', {
      snippetLength: snippet.length,
      filePath: selContext.filePath,
      startOffset: selContext.startOffset,
      endOffset: selContext.endOffset,
    });
    setSelectionDiffState({ snippet, selectionContext: selContext });
  };

  /**
   * Phase 109.5.2: Confirm selection diff and apply changes
   * Injects the snippet at the selection position
   */
  const handleConfirmSelectionDiff = async () => {
    if (!selectionDiffState || !rootPath) return;

    const { snippet, selectionContext } = selectionDiffState;
    const fullPath = normalizeFullPath(rootPath, selectionContext.filePath);

    console.log('[AgentPanelPane] Applying selection refactor:', {
      fullPath,
      startOffset: selectionContext.startOffset,
      endOffset: selectionContext.endOffset,
      snippetLength: snippet.length,
    });

    // 1. Get current file content
    const api = window.f0Desktop;
    if (!api) {
      appendMessage({
        role: 'error',
        content: 'File system API not available.',
      });
      return;
    }

    let fileContent: string;
    try {
      fileContent = await api.readFile(fullPath);
    } catch (err) {
      appendMessage({
        role: 'error',
        content: `Failed to read file: ${fullPath}`,
      });
      return;
    }

    // 2. Store undo entry with full file content
    projectState.pushUndoEntry({
      path: fullPath,
      previousContent: fileContent,
      appliedAt: Date.now(),
      source: 'agent',
    });

    // 3. Inject snippet at selection position
    // newContent = before + snippet + after
    const before = fileContent.slice(0, selectionContext.startOffset);
    const after = fileContent.slice(selectionContext.endOffset);
    const newContent = before + snippet + after;

    console.log('[AgentPanelPane] Injecting snippet:', {
      beforeLength: before.length,
      snippetLength: snippet.length,
      afterLength: after.length,
      newContentLength: newContent.length,
    });

    // 4. Apply the change
    await projectState.applyExternalFileChange(fullPath, newContent);

    // 5. Success message
    const fileName = selectionContext.filePath.split(/[\\/]/).pop() || selectionContext.filePath;
    appendMessage({
      id: `sys-${Date.now()}`,
      role: 'system',
      content: `✅ Applied refactored code to selection in: ${fileName}`,
    });

    // 6. Close modal
    setSelectionDiffState(null);

    // Phase 115.3: Auto-refresh browser preview after applying selection refactor
    triggerPreviewReload();

    // Phase 124.6.1: Auto code review after selection refactor
    const api2 = window.f0Desktop as Record<string, unknown> | undefined;
    if (api2?.codeReview && typeof api2.codeReview === 'function') {
      void (api2.codeReview as (input: {
        filePath: string;
        before?: string | null;
        after: string;
        projectRoot?: string;
      }) => Promise<{
        success: boolean;
        issues: Array<{ severity: string; lineStart: number; message: string }>;
      }>)({
        filePath: fullPath,
        before: fileContent,
        after: newContent,
        projectRoot: rootPath,
      }).then((result) => {
        if (result.success && result.issues.length > 0) {
          appendMessage({
            id: `review-${Date.now()}`,
            role: 'system',
            content: `🔍 Code review found ${result.issues.length} issue(s) in ${fileName}:\n${result.issues.map((i) => `• [${i.severity}] Line ${i.lineStart}: ${i.message}`).join('\n')}`,
          });
        }
      }).catch(console.error);
    }
  };

  /**
   * Phase 110.2: Handle edits from Cloud Agent - open RefactorDock
   */
  const handleCloudEdits = useCallback((edits: IdeRefactorEdit[]) => {
    if (edits && edits.length > 0) {
      console.log('[AgentPanelPane] Opening RefactorDock with', edits.length, 'edits');
      setPendingEdits(edits);
      setIsRefactorDockOpen(true);
    }
  }, []);

  /**
   * Phase 110.2: Apply a single edit from RefactorDock
   */
  const handleApplyEdit = useCallback(async (edit: IdeRefactorEdit, index: number) => {
    if (!rootPath) return;

    setIsApplyingEdit(true);
    const api = window.f0Desktop;
    if (!api) {
      setIsApplyingEdit(false);
      return;
    }

    try {
      const fullPath = edit.filePath.startsWith(rootPath)
        ? edit.filePath
        : `${rootPath.replace(/\/+$/, '')}/${edit.filePath.replace(/^\/+/, '')}`;

      // Read current content for undo
      let oldContent = '';
      try {
        oldContent = await api.readFile(fullPath);
      } catch {
        // New file
      }

      // Store undo entry
      projectState.pushUndoEntry({
        path: fullPath,
        previousContent: oldContent,
        appliedAt: Date.now(),
        source: 'agent',
      });

      // Apply the change
      await projectState.applyExternalFileChange(fullPath, edit.newText);

      // Remove from pending edits
      setPendingEdits((prev) => prev.filter((_, i) => i !== index));

      appendMessage({
        id: `sys-${Date.now()}`,
        role: 'system',
        content: `✅ Applied edit to: ${edit.filePath}`,
      });

      // Phase 115.3: Auto-refresh browser preview after applying edit
      triggerPreviewReload();

      // Close dock if no more edits
      if (pendingEdits.length <= 1) {
        setIsRefactorDockOpen(false);
      }
    } catch (err: any) {
      appendMessage({
        id: `err-${Date.now()}`,
        role: 'error',
        content: `Failed to apply edit: ${err?.message || 'Unknown error'}`,
      });
    } finally {
      setIsApplyingEdit(false);
    }
  }, [rootPath, projectState, pendingEdits.length, appendMessage]);

  /**
   * Phase 110.2: Discard a single edit
   */
  const handleDiscardEdit = useCallback((index: number) => {
    setPendingEdits((prev) => prev.filter((_, i) => i !== index));
    if (pendingEdits.length <= 1) {
      setIsRefactorDockOpen(false);
    }
  }, [pendingEdits.length]);

  /**
   * Phase 110.2: Apply all pending edits
   */
  const handleApplyAllEdits = useCallback(async () => {
    for (let i = 0; i < pendingEdits.length; i++) {
      await handleApplyEdit(pendingEdits[i], 0); // Always index 0 since we remove applied edits
    }
  }, [pendingEdits, handleApplyEdit]);

  /**
   * Phase 110.2: Discard all pending edits
   */
  const handleDiscardAllEdits = useCallback(() => {
    setPendingEdits([]);
    setIsRefactorDockOpen(false);
  }, []);

  /**
   * Phase 110.3: Run QA tests
   */
  const handleRunQa = useCallback(async () => {
    if (!settings.projectId) {
      appendMessage({
        role: 'error',
        content: 'Please configure Project ID in Settings to run QA.',
      });
      return;
    }

    setIsRunningQa(true);
    setQaResult(null);

    try {
      const apiBase = settings.cloudApiBase || 'http://localhost:3030';
      const response = await fetch(`${apiBase}/api/ide/desktop-run-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.cloudAuthToken ? { 'Authorization': `Bearer ${settings.cloudAuthToken}` } : {}),
        },
        body: JSON.stringify({
          projectId: settings.projectId,
          qaMode: 'static', // Default to static QA
          locale: settings.locale || 'ar',
        }),
      });

      const data = await response.json();

      if (data.ok) {
        const result = data.result;
        setQaResult({
          status: result.passed ? 'passed' : 'failed',
          summary: result.summary || (result.passed ? 'All checks passed!' : 'Some issues found'),
        });

        appendMessage({
          id: `sys-${Date.now()}`,
          role: 'system',
          content: result.passed
            ? `✅ QA Passed: ${result.summary || 'All checks passed!'}`
            : `⚠️ QA Issues: ${result.summary || 'Some issues found'}`,
        });
      } else {
        setQaResult({
          status: 'error',
          summary: data.message || 'QA check failed',
        });
        appendMessage({
          role: 'error',
          content: `QA Error: ${data.message || 'Unknown error'}`,
        });
      }
    } catch (err: any) {
      setQaResult({
        status: 'error',
        summary: err?.message || 'Network error',
      });
      appendMessage({
        role: 'error',
        content: `QA Error: ${err?.message || 'Failed to connect to server'}`,
      });
    } finally {
      setIsRunningQa(false);
    }
  }, [settings, appendMessage]);

  /**
   * Phase 122.6: Handle "Protect with Auth" button
   * Sends current file to agent to wrap with AuthGuard
   */
  const handleProtectWithAuth = useCallback(async () => {
    if (!currentFilePath) {
      appendMessage({
        role: 'error',
        content: labels.noFileOpen,
      });
      return;
    }

    // Check if it's a page/component file
    const isPageOrComponent = currentFilePath.endsWith('.tsx') || currentFilePath.endsWith('.jsx');
    if (!isPageOrComponent) {
      appendMessage({
        role: 'error',
        content: isArabic
          ? 'يمكن حماية ملفات .tsx و .jsx فقط'
          : 'Only .tsx and .jsx files can be protected',
      });
      return;
    }

    setIsProtectingWithAuth(true);

    // Build the prompt for the agent
    const prompt = isArabic
      ? `أضف AuthGuard لحماية هذا الملف:
📁 الملف: ${currentFilePath}

المطلوب:
1. أضف import لـ AuthGuard من "@/components/AuthGuard"
2. لف المكون الأساسي بـ <AuthGuard>...</AuthGuard>
3. لا تغير أي كود آخر

الكود الحالي:
\`\`\`tsx
${currentFileContent}
\`\`\``
      : `Add AuthGuard to protect this file:
📁 File: ${currentFilePath}

Requirements:
1. Add import for AuthGuard from "@/components/AuthGuard"
2. Wrap the main component with <AuthGuard>...</AuthGuard>
3. Do not change any other code

Current code:
\`\`\`tsx
${currentFileContent}
\`\`\``;

    // Set input and send
    setInput(prompt);
    setIsProtectingWithAuth(false);

    appendMessage({
      id: `sys-${Date.now()}`,
      role: 'system',
      content: isArabic
        ? '💡 تم إعداد طلب حماية الصفحة. اضغط Enter للإرسال.'
        : '💡 Auth protection request prepared. Press Enter to send.',
    });
  }, [currentFilePath, currentFileContent, isArabic, labels.noFileOpen, appendMessage]);

  /**
   * Phase 112.2: Handle "Ask Agent about last run" button
   * Gets runner context and sends it to the agent for error analysis
   */
  const handleAskAboutLastRun = useCallback(async () => {
    if (isSending) return;

    // Get runner context
    const context = await getRunnerContext(100);
    if (!context || context.trim().length === 0) {
      appendMessage({
        role: 'error',
        content: settings.locale === 'ar'
          ? 'لا توجد نتائج حديثة من الـ Runner. شغّل أمر أولاً.'
          : 'No recent Runner output. Run a command first.',
      });
      return;
    }

    // Set input with the question
    const question = settings.locale === 'ar'
      ? 'شوف نتيجة آخر Run وقولي إيه المشكلة وإزاي أصلحها'
      : 'Look at the last Run output and tell me what the issue is and how to fix it';

    setInput(question);

    // Auto-send after short delay
    setTimeout(async () => {
      // The enrichMessageWithRunnerContext will automatically add the context
      // because the question contains triggers like "آخر Run" and "fix"
      setIsSending(true);
      const assistantId = `asst-${Date.now()}`;

      appendMessage({ role: 'user', content: question });
      appendMessage({ id: assistantId, role: 'assistant', content: '' });
      setInput('');

      try {
        const cloudResponse = await sendChatToCloudAgent({
          apiBase: settings.cloudApiBase || 'http://localhost:3030',
          projectId: settings.projectId || '',
          message: question,
          locale: settings.locale || 'ar',
          runnerContext: context, // Phase 112.2: Send runner context directly
          token: settings.cloudAuthToken,
        });

        const replyText = cloudResponse.messages?.length
          ? cloudResponse.messages.join('\n\n')
          : settings.locale === 'ar'
            ? '⚠️ لا يوجد رد من الوكيل'
            : '⚠️ No response from agent';

        updateAssistantMessage(assistantId, replyText);

        // Check for command intent
        if (cloudResponse.commandIntent?.type === 'run') {
          setSuggestedCommand(cloudResponse.commandIntent.command);
          setIsRunnerVisible(true);
          setRunnerAutoOpen(true); // 👈 Show badge
        }
      } catch (err: any) {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        appendMessage({
          role: 'error',
          content: err?.message || 'Failed to send request',
        });
      } finally {
        setIsSending(false);
      }
    }, 100);
  }, [settings, isSending, appendMessage, updateAssistantMessage, setRunnerAutoOpen]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    // Phase 171.2: Check if user asks to analyze already-analyzed attachment
    // If attachment was auto-analyzed, show the analysis directly
    // RULE: Media files (PDF/Image) are analyzed ONLY by Media Agent.
    // Chat Agent must NEVER analyze files or respond to them.
    const analyzeKeywords = [
      'حلل', 'تحليل', 'analyze', 'analysis', 'ملخص', 'summary', 'اشرح', 'explain',
      'ما هذا', 'what is', 'what\'s this', 'ايش ده', 'شو هاد', 'افهمني',
      'الملف', 'file', 'pdf', 'صورة', 'image', 'document', 'مستند'
    ];
    const isAnalyzeRequest = analyzeKeywords.some(k => trimmed.toLowerCase().includes(k.toLowerCase()));
    // Phase 171.11: Minimum extracted text length to consider valid (not placeholder)
    // Must match server MIN_TEXT_LEN = 800 to prevent false positives
    const MIN_EXTRACTED_TEXT_LEN = 800;

    // Phase 171.11: Helper to check if extracted text is valid (not placeholder)
    const hasValidExtractedText = (text: string | undefined): boolean => {
      if (!text) return false;
      const trimmed = text.trim();
      // Check length AND that it's not a known placeholder/error pattern
      const isPlaceholder =
        trimmed.includes('[PDF Document:') ||  // App.tsx placeholder
        trimmed.includes('[Word Document:') ||
        trimmed.includes('PDF_TEXT_EXTRACTION_FAILED') ||  // Server failure marker
        trimmed.includes('NO_PHASE_DATA_FOUND') ||
        trimmed.includes('Could not extract') ||
        trimmed.includes('لم نتمكن من استخراج') ||
        trimmed.includes('Please open the file manually') ||
        trimmed.includes('افتح الملف يدوياً');

      return trimmed.length >= MIN_EXTRACTED_TEXT_LEN && !isPlaceholder;
    };

    // Phase 171.15: Use analysisStatus instead of autoAnalyzed
    const autoAnalyzedAttachment = pendingAttachments.find(
      att => att.analysisStatus === 'READY' && hasValidExtractedText(att.extractedText)
    );

    // Debug log for Phase 171.2 / 171.15
    console.log('[AgentPanelPane] Phase 171.15 check:', {
      input: trimmed,
      isAnalyzeRequest,
      pendingAttachmentsCount: pendingAttachments.length,
      attachmentStatuses: pendingAttachments.map(a => ({ name: a.name, status: a.analysisStatus })),
      attachmentsWithExtractedText: pendingAttachments.filter(a => a.extractedText).map(a => ({
        name: a.name,
        length: a.extractedText?.length || 0,
        isValid: hasValidExtractedText(a.extractedText),
        status: a.analysisStatus,
      })),
      foundReady: autoAnalyzedAttachment?.name,
    });

    // Phase 171.15: If there's a document attachment that's PENDING, show loading message
    const documentBeingAnalyzed = pendingAttachments.find(
      att => att.attachmentType === 'document' && att.analysisStatus === 'PENDING'
    );
    if (isAnalyzeRequest && documentBeingAnalyzed) {
      console.log('[AgentPanelPane] Phase 171.15: Document status PENDING:', documentBeingAnalyzed.name);
      appendMessage({
        role: 'assistant',
        content: locale === 'ar'
          ? `⏳ جاري تحليل الملف "${documentBeingAnalyzed.name}"... سيُعرض التحليل تلقائياً عند الانتهاء.`
          : `⏳ Analyzing "${documentBeingAnalyzed.name}"... Analysis will appear automatically when ready.`,
      });
      return;
    }

    // Phase 171.15: If analysis FAILED, show error message
    const documentFailed = pendingAttachments.find(
      att => att.attachmentType === 'document' && att.analysisStatus === 'FAILED'
    );
    if (isAnalyzeRequest && documentFailed) {
      console.log('[AgentPanelPane] Phase 171.15: Document status FAILED:', documentFailed.name, documentFailed.analysisError);
      appendMessage({
        role: 'assistant',
        content: locale === 'ar'
          ? `❌ فشل تحليل الملف "${documentFailed.name}": ${documentFailed.analysisError || 'خطأ غير معروف'}`
          : `❌ Failed to analyze "${documentFailed.name}": ${documentFailed.analysisError || 'Unknown error'}`,
      });
      onClearAttachments?.();
      return;
    }

    // Phase 171.2b: If auto-analyzed attachment exists, show it directly
    // Phase 171.16: Only show if extraction is STRONG
    const autoAnalyzedStrength = autoAnalyzedAttachment?.extractionStrength ?? 'EMPTY';
    if (isAnalyzeRequest && autoAnalyzedAttachment && autoAnalyzedStrength === 'STRONG') {
      console.log('[AgentPanelPane] Phase 171.16: Using pre-analyzed attachment (STRONG):', autoAnalyzedAttachment.name);

      // Add user message
      appendMessage({
        role: 'user',
        content: trimmed,
        attachments: [{
          id: autoAnalyzedAttachment.id,
          name: autoAnalyzedAttachment.name,
          previewUrl: autoAnalyzedAttachment.previewUrl,
          mimeType: autoAnalyzedAttachment.mimeType,
          attachmentType: autoAnalyzedAttachment.attachmentType || 'document',
          description: locale === 'ar' ? '📄 تم تحليله تلقائياً' : '📄 Auto-analyzed',
        }],
      });
      setInput('');

      // Show the pre-analyzed result directly
      const assistantId = `asst-${Date.now()}`;
      appendMessage({
        id: assistantId,
        role: 'assistant',
        content: autoAnalyzedAttachment.extractedText || '',
      });

      // Clear the attachment after showing analysis
      onClearAttachments?.();

      return; // Don't send to Cloud Agent
    }

    // Phase 171.2c: GUARD - If there's any document attachment, handle it properly
    // This prevents Chat Agent from ever handling document files
    // Phase 171.15: Use analysisStatus instead of autoAnalyzed
    // Phase 171.16: Add extraction strength guard to prevent hallucination
    const anyDocumentAttachment = pendingAttachments.find(att => att.attachmentType === 'document');
    if (anyDocumentAttachment) {
      const isValidText = hasValidExtractedText(anyDocumentAttachment.extractedText);
      const extractedLen = anyDocumentAttachment.extractedTextLen ?? 0;
      const pageCount = anyDocumentAttachment.documentMetadata?.pageCount ?? 0;
      const strength = anyDocumentAttachment.extractionStrength ?? 'EMPTY';

      console.log('[AgentPanelPane] Phase 171.16: Document attachment found', {
        name: anyDocumentAttachment.name,
        analysisStatus: anyDocumentAttachment.analysisStatus,
        extractedTextLength: anyDocumentAttachment.extractedText?.length || 0,
        extractedTextLen: extractedLen,
        pageCount,
        extractionStrength: strength,
        isValidExtractedText: isValidText,
        willShowAnalysis: anyDocumentAttachment.analysisStatus === 'READY' && isValidText && strength === 'STRONG',
      });

      // Phase 171.16: STRICT GUARD - Block weak extraction from showing as "analysis"
      // If extraction is not STRONG, show honest warning instead of hallucinated content
      if (anyDocumentAttachment.analysisStatus === 'READY' && strength !== 'STRONG') {
        console.log('[AgentPanelPane] Phase 171.16: Blocking weak extraction:', strength);
        appendMessage({
          role: 'user',
          content: trimmed,
          attachments: [{
            id: anyDocumentAttachment.id,
            name: anyDocumentAttachment.name,
            previewUrl: anyDocumentAttachment.previewUrl,
            mimeType: anyDocumentAttachment.mimeType,
            attachmentType: 'document',
            description: locale === 'ar' ? '⚠️ استخراج ضعيف' : '⚠️ Weak extraction',
          }],
        });
        setInput('');

        // Show honest warning about weak extraction
        const warningMessage = locale === 'ar'
          ? `📄 **تم رفع الملف "${anyDocumentAttachment.name}" لكن استخراج النص غير كافٍ لتحليل موثوق.**

**المعلومات المتاحة:**
- عدد الصفحات: ${pageCount || 'غير معروف'}
- حجم النص المستخرج: ${extractedLen} حرف
- قوة الاستخراج: ${strength === 'WEAK' ? 'ضعيف' : 'فارغ'}

**⚠️ تحذير:** لا يمكن تقديم تحليل موثوق (مثل Roadmap أو Phases) بناءً على هذا الاستخراج.

**➡️ اقتراحات:**
- جرّب PDF آخر بنص قابل للنسخ (ليس صورة)
- استخدم أداة OCR لتحويل الصور لنص
- أو أرسل الملف كصورة للتحليل البصري`
          : `📄 **File "${anyDocumentAttachment.name}" uploaded, but text extraction is insufficient for reliable analysis.**

**Available information:**
- Page count: ${pageCount || 'Unknown'}
- Extracted text size: ${extractedLen} characters
- Extraction strength: ${strength}

**⚠️ Warning:** Cannot provide reliable analysis (like Roadmap or Phases) based on this extraction.

**➡️ Suggestions:**
- Try another PDF with copyable text (not scanned images)
- Use an OCR tool to convert images to text
- Or send the file as an image for visual analysis`;

        appendMessage({
          role: 'assistant',
          content: warningMessage,
        });
        onClearAttachments?.();
        return;
      }

      // IMPORTANT: Only show analysis if status is READY AND text is valid AND extraction is STRONG
      // Phase 171.15/171.16: Use analysisStatus and extractionStrength
      if (anyDocumentAttachment.analysisStatus === 'READY' && hasValidExtractedText(anyDocumentAttachment.extractedText) && strength === 'STRONG') {
        // Show the REAL analysis that was done by Media Agent
        appendMessage({
          role: 'user',
          content: trimmed,
          attachments: [{
            id: anyDocumentAttachment.id,
            name: anyDocumentAttachment.name,
            previewUrl: anyDocumentAttachment.previewUrl,
            mimeType: anyDocumentAttachment.mimeType,
            attachmentType: 'document',
            description: locale === 'ar' ? '📄 تم تحليله تلقائياً' : '📄 Auto-analyzed',
          }],
        });
        setInput('');
        appendMessage({
          role: 'assistant',
          content: anyDocumentAttachment.extractedText,
        });
        onClearAttachments?.();
        return;
      } else if (anyDocumentAttachment.analysisStatus !== 'READY') {
        // Analysis not ready yet - wait for auto-analyze to complete
        appendMessage({
          role: 'assistant',
          content: locale === 'ar'
            ? `⏳ جاري تحليل الملف "${anyDocumentAttachment.name}" تلقائياً... انتظر قليلاً ثم أعد المحاولة.`
            : `⏳ Auto-analyzing "${anyDocumentAttachment.name}"... Please wait a moment and try again.`,
        });
        return;
      }
    }

    // Phase 109.5.4: Check agent mode
    const isCloudMode = settings.agentMode === 'cloud';

    // Validate settings based on mode
    if (!isCloudMode && !settings.apiKey) {
      appendMessage({
        role: 'error',
        content: 'Please configure your API Key in Settings first.',
      });
      return;
    }

    if (isCloudMode && !settings.projectId) {
      appendMessage({
        role: 'error',
        content: 'Please configure your Project ID in Settings for Cloud mode.',
      });
      return;
    }

    // Phase 112: Enrich message with runner context if relevant
    // This adds runner logs to the message when user asks about errors
    const enrichedMessage = await enrichMessageWithRunnerContext(trimmed);
    if (enrichedMessage !== trimmed) {
      console.log('[AgentPanelPane] Message enriched with runner context');
    }

    // Phase 170: Attachment Memory - Check if user refers to previous attachment
    const attachmentRef = detectAttachmentReference(trimmed);
    let effectiveAttachments = [...pendingAttachments];
    let usedRememberedAttachment = false;

    // If no pending attachments but user refers to a previous one, reuse it
    if (pendingAttachments.length === 0 && attachmentRef.isReferring && lastAttachment) {
      // Check if the type matches (or is generic)
      const typeMatches = !attachmentRef.attachmentType ||
        attachmentRef.attachmentType === lastAttachment.attachmentType;

      // Only reuse if attachment is less than 30 minutes old
      const isRecent = (Date.now() - lastAttachment.lastUsedAt) < 30 * 60 * 1000;

      if (typeMatches && isRecent) {
        console.log('[AgentPanelPane] Phase 170: Reusing remembered attachment:', {
          name: lastAttachment.name,
          type: lastAttachment.attachmentType,
          ageMinutes: Math.round((Date.now() - lastAttachment.lastUsedAt) / 60000),
        });
        effectiveAttachments = [lastAttachment];
        usedRememberedAttachment = true;
      } else {
        console.log('[AgentPanelPane] Phase 170: Attachment reference detected but cannot reuse:', {
          referredType: attachmentRef.attachmentType,
          lastType: lastAttachment.attachmentType,
          isRecent,
        });
      }
    }

    // Phase 109.5.2: Detect selection mode
    const { selection } = projectState;
    const isSelectionActive =
      selection &&
      selection.filePath === currentFilePath &&
      selection.selectedText.trim().length > 0;

    // Capture selection context at send time (for later use in apply)
    const capturedSelection: SelectionContext | undefined = isSelectionActive
      ? {
          filePath: selection.filePath,
          startOffset: selection.startOffset,
          endOffset: selection.endOffset,
          selectedText: selection.selectedText,
        }
      : undefined;

    // Phase 168.7 + 170: Convert effective attachments to message attachments for history
    const messageAttachments: MessageAttachment[] | undefined = effectiveAttachments.length > 0
      ? effectiveAttachments.map(att => ({
          id: att.id,
          name: att.name,
          previewUrl: att.previewUrl,
          mimeType: att.mimeType,
          attachmentType: att.attachmentType || 'image',
          description: usedRememberedAttachment
            ? (locale === 'ar' ? '🔄 مرفق سابق معاد استخدامه' : '🔄 Reused previous attachment')
            : att.attachmentType === 'audio' && att.extractedText?.includes('Transcription')
              ? (locale === 'ar' ? '🎙️ صوت - تم تحويله لنص' : '🎙️ Audio - transcribed')
              : att.attachmentType === 'audio'
                ? (locale === 'ar' ? '🎵 ملف صوتي' : '🎵 Audio file')
                : att.attachmentType === 'document'
                  ? (locale === 'ar' ? '📄 مستند' : '📄 Document')
                  : (locale === 'ar' ? '📷 صورة' : '📷 Image'),
        }))
      : undefined;

    // Add user message with attachments
    appendMessage({
      role: 'user',
      content: trimmed,
      attachments: messageAttachments,
    });
    setInput('');
    setIsSending(true);

    const assistantId = `asst-${Date.now()}`;
    appendMessage({ id: assistantId, role: 'assistant', content: '' });

    try {
      // Phase 109.5.4: Use Cloud Agent if enabled
      if (isCloudMode) {
        console.log('[AgentPanelPane] Using Cloud Agent mode');

        if (isSelectionActive && capturedSelection) {
          // Cloud Agent with selection - use refactor mode
          const safeSelection: SafeSelection = {
            filePath: capturedSelection.filePath,
            languageId: guessLanguageId(capturedSelection.filePath),
            fullText: currentFileContent,
            selectedText: capturedSelection.selectedText,
            start: { line: 1, column: capturedSelection.startOffset }, // Simplified
            end: { line: 1, column: capturedSelection.endOffset },
          };

          const cloudResponse = await sendSelectionToCloudAgent({
            apiBase: settings.cloudApiBase || 'http://localhost:3030',
            projectId: settings.projectId || '',
            message: enrichedMessage, // Phase 112: Use enriched message with runner context
            selection: mapSafeToSelectionContext(safeSelection),
            locale: settings.locale || 'ar', // Phase 110: Use settings locale (default Arabic)
            token: settings.cloudAuthToken, // Phase 109.5.5
          });

          console.log('[AgentPanelPane] Cloud Agent response:', cloudResponse);

          // Update message with cloud response
          const replyText = cloudResponse.messages.join('\n\n');
          updateAssistantMessage(assistantId, replyText);

          // Phase 110.2: Handle edits from cloud agent - open RefactorDock
          if (cloudResponse.edits && cloudResponse.edits.length > 0) {
            handleCloudEdits(cloudResponse.edits);
            const snippets = cloudResponse.edits.map(e => e.newText);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, selectionContext: capturedSelection, extractedSnippets: snippets }
                  : m
              )
            );
          } else {
            // Extract snippets from response text
            const snippets = extractSnippets(replyText);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, selectionContext: capturedSelection, extractedSnippets: snippets }
                  : m
              )
            );
          }
        } else {
          // Cloud Agent without selection - use chat mode
          // Phase 176.7: Detect message language early for logging
          const earlyDetectedLang = detectMessageLanguage(trimmed);
          const earlyEffectiveLocale = earlyDetectedLang === 'ar' ? 'ar'
            : earlyDetectedLang === 'en' ? 'en'
            : (settings.locale as 'ar' | 'en') || 'ar';
          console.log('[AgentPanelPane] Calling sendChatToCloudAgent with:', {
            apiBase: settings.cloudApiBase || 'http://localhost:3030',
            projectId: settings.projectId || '',
            messageLength: trimmed.length,
            settingsLocale: settings.locale || 'ar',
            detectedLanguage: earlyDetectedLang, // Phase 176.7
            locale: earlyEffectiveLocale, // Phase 176.7: Use detected language
          });

          // Phase 180.1: Shell Agent - Detect shell command intent
          const shellIntent = detectShellCommandIntent(trimmed, earlyEffectiveLocale);
          if (shellIntent.detected) {
            console.log('[AgentPanelPane] Shell command intent detected:', shellIntent);

            if (!shellIntent.isSafe) {
              // Blocked command - show message and return
              const blockedMsg = formatBlockedMessage(shellIntent, earlyEffectiveLocale);
              updateAssistantMessage(assistantId, blockedMsg);
              setIsSending(false);
              return;
            }

            // Safe command - execute via IPC
            if (shellIntent.fullCommand && window.f0Desktop?.runShellCommand) {
              try {
                const result = await window.f0Desktop.runShellCommand(
                  shellIntent.fullCommand,
                  rootPath || undefined
                );
                const formattedResult = formatShellResult(
                  shellIntent,
                  result.output || result.error || '',
                  result.exitCode,
                  earlyEffectiveLocale
                );
                updateAssistantMessage(assistantId, formattedResult);
                setIsSending(false);
                return;
              } catch (err: any) {
                console.error('[AgentPanelPane] Shell command error:', err);
                const errorMsg = earlyEffectiveLocale === 'ar'
                  ? `❌ خطأ في تنفيذ الأمر: ${err.message}`
                  : `❌ Error executing command: ${err.message}`;
                updateAssistantMessage(assistantId, errorMsg);
                setIsSending(false);
                return;
              }
            } else {
              // No IPC available - inform user
              const noIpcMsg = earlyEffectiveLocale === 'ar'
                ? '⚠️ تنفيذ الأوامر غير متاح في هذا الوضع'
                : '⚠️ Shell command execution is not available in this mode';
              updateAssistantMessage(assistantId, noIpcMsg);
              setIsSending(false);
              return;
            }
          }

          // Phase 180.2: Browser Agent - Detect URL fetch intent
          const browserIntent = detectBrowserIntent(trimmed, earlyEffectiveLocale);
          if (browserIntent.detected) {
            console.log('[AgentPanelPane] Browser fetch intent detected:', browserIntent);

            if (!browserIntent.isValidUrl) {
              // Blocked URL - show message and return
              const blockedMsg = formatBlockedUrlMessage(browserIntent, earlyEffectiveLocale);
              updateAssistantMessage(assistantId, blockedMsg);
              setIsSending(false);
              return;
            }

            // Valid URL - fetch content via API
            if (browserIntent.url) {
              try {
                const apiBase = settings.cloudApiBase || 'http://localhost:3030';
                const fetchResult = await fetchWebContent(browserIntent.url, `${apiBase}/api/ide/web-fetch`);
                const formattedContent = formatFetchedContent(fetchResult, earlyEffectiveLocale);
                updateAssistantMessage(assistantId, formattedContent);
                setIsSending(false);
                return;
              } catch (err: any) {
                console.error('[AgentPanelPane] Browser fetch error:', err);
                const errorMsg = earlyEffectiveLocale === 'ar'
                  ? `❌ خطأ في جلب المحتوى: ${err.message}`
                  : `❌ Error fetching content: ${err.message}`;
                updateAssistantMessage(assistantId, errorMsg);
                setIsSending(false);
                return;
              }
            }
          }

          // Phase 112.1: Auto-attach runner logs if available (failed runs only)
          const autoRunnerContext = (lastRunnerLogs && lastRunnerLogs.status !== 'success')
            ? formatRunnerLogsForContext(lastRunnerLogs)
            : undefined;

          // Phase 167.1: Code Location Intent Detection
          // Check if user is asking "where is the code that handles X?"
          let codeLocationContext = '';
          let foundCodeLocationFiles: CodeLocationResult[] = [];

          if (rootPath) {
            try {
              console.log('[AgentPanelPane] Checking for Code Location intent:', trimmed.slice(0, 50));
              const codeLocationResult = await handleCodeLocationQuery(
                rootPath,
                trimmed,
                earlyEffectiveLocale
              );

              if (codeLocationResult.usedSearch && codeLocationResult.results.length > 0) {
                foundCodeLocationFiles = codeLocationResult.results;
                codeLocationContext = buildCodeLocationContext(codeLocationResult.results, earlyEffectiveLocale);
                setCodeLocationResults(foundCodeLocationFiles);
                setShowCodeLocation(true);
                console.log('[AgentPanelPane] Code Location found:', foundCodeLocationFiles.length, 'files');
              } else {
                setCodeLocationResults([]);
                setShowCodeLocation(false);
              }
            } catch (err) {
              console.error('[AgentPanelPane] Code Location error:', err);
            }
          }

          // Phase 122: Build RAG context from indexed project files
          let ragEnrichedMessage = enrichedMessage;
          let ragFiles: ContextFile[] = [];

          if (rootPath) {
            setIsLoadingRag(true);
            try {
              console.log('[AgentPanelPane] Building RAG context for:', trimmed.slice(0, 50));
              const ragResult = await buildRagContextForCloudAgent({
                projectRoot: rootPath,
                userQuestion: trimmed,
                activeFilePath: currentFilePath,
                activeFileContent: currentFileContent,
                language: (settings.locale || 'ar') as 'ar' | 'en',
              });

              if (ragResult.usedRag) {
                ragEnrichedMessage = ragResult.enrichedMessage;
                ragFiles = ragResult.contextFiles;
                setRagContextFiles(ragFiles);
                console.log('[AgentPanelPane] RAG context added:', ragFiles.length, 'files');
              }
            } catch (err) {
              console.error('[AgentPanelPane] RAG error:', err);
            } finally {
              setIsLoadingRag(false);
            }
          }

          // Phase 124.2 Part 2: Enrich message with snapshot context
          // Only if snapshot exists and no RAG files were added (to avoid duplication)
          let finalEnrichedMessage = ragEnrichedMessage;
          if (hasSnapshot && snapshot && ragFiles.length === 0) {
            console.log('[AgentPanelPane] Adding snapshot context to message');
            finalEnrichedMessage = buildSnapshotEnrichedMessage(ragEnrichedMessage, locale as 'ar' | 'en');
          } else if (hasSnapshot) {
            console.log('[AgentPanelPane] Snapshot available but skipped (RAG files present)');
          }

          // Phase 167.1: Prepend Code Location context if found
          if (codeLocationContext) {
            console.log('[AgentPanelPane] Prepending Code Location context to message');
            finalEnrichedMessage = codeLocationContext + '\n\n' + finalEnrichedMessage;
          }

          // Phase 168.3 + 168.5 + 170: Convert effective attachments to API format
          // Images go to Vision API, documents get their text appended to message
          const imageAttachments: ImageAttachmentData[] = effectiveAttachments
            .filter(att => att.base64 && att.attachmentType === 'image') // Only images for Vision API
            .map(att => ({
              name: att.name,
              base64: att.base64!,
              mimeType: att.mimeType,
            }));

          // Phase 168.5 + 176.10: Append extracted document/audio text to the message
          // Phase 176.10: Proper language labels for audio transcriptions
          const documentAttachments = effectiveAttachments.filter(att => att.extractedText);
          if (documentAttachments.length > 0) {
            const isArabicLocale = earlyEffectiveLocale === 'ar';
            const docContexts = documentAttachments.map(att => {
              // Phase 176.10: Properly identify audio files and use correct language labels
              const isAudio = att.attachmentType === 'audio' ||
                              att.mimeType.includes('audio') ||
                              att.extractedText?.includes('Transcription:') ||
                              att.extractedText?.includes('تحويل الصوت:');

              const docType = isAudio
                ? (isArabicLocale ? '🎙️ تحويل صوتي' : '🎙️ Audio Transcription')
                : att.mimeType.includes('pdf')
                  ? 'PDF'
                  : att.mimeType.includes('word')
                    ? 'Word'
                    : att.mimeType.includes('excel') || att.mimeType.includes('spreadsheet')
                      ? 'Excel'
                      : (isArabicLocale ? 'مستند' : 'Document');

              const metaInfo = att.documentMetadata?.pageCount
                ? ` (${att.documentMetadata.pageCount} ${isArabicLocale ? 'صفحات' : 'pages'})`
                : att.documentMetadata?.sheetCount
                  ? ` (${att.documentMetadata.sheetCount} ${isArabicLocale ? 'أوراق' : 'sheets'})`
                  : '';

              // Phase 176.10: Add language instruction specifically for audio transcription
              const audioLangHint = isAudio && isArabicLocale
                ? '\n\n⚠️ **ملاحظة مهمة:** حتى لو النص المحول بالإنجليزية، يجب أن يكون ردك كاملاً بالعربية!'
                : '';

              return `📎 **${docType}:** \`${att.name}\`${metaInfo}\n\n\`\`\`\n${att.extractedText!.slice(0, 15000)}\n\`\`\`${audioLangHint}`;
            });

            // Prepend document context to message with proper language
            // Phase 176.10: Use detected locale for proper Arabic/English prefixes
            const hasAudio = documentAttachments.some(att =>
              att.attachmentType === 'audio' || att.mimeType.includes('audio')
            );

            const docPrefix = isArabicLocale
              ? hasAudio
                ? `🎙️ **ملف صوتي مرفق للتحليل (رد بالعربي!):**\n\n${docContexts.join('\n\n')}\n\n---\n\n`
                : `📄 **مستندات مرفقة للتحليل:**\n\n${docContexts.join('\n\n')}\n\n---\n\n`
              : hasAudio
                ? `🎙️ **Attached audio for analysis:**\n\n${docContexts.join('\n\n')}\n\n---\n\n`
                : `📄 **Attached documents for analysis:**\n\n${docContexts.join('\n\n')}\n\n---\n\n`;

            finalEnrichedMessage = docPrefix + finalEnrichedMessage;
            console.log('[AgentPanelPane] Phase 176.10: Added', documentAttachments.length, 'document/audio attachments to message, locale:', earlyEffectiveLocale);
          }

          // Phase 176.7: Use the early detected locale (already computed above)
          // earlyEffectiveLocale is already computed at the start of this branch

          // Phase 177: Build conversation history for Cloud Agent
          // Only include completed user/assistant exchanges (not the current pending message)
          const conversationHistory: ChatHistoryMessage[] = messages
            .filter((m) => m.role !== 'error' && m.role !== 'system')
            .map((m) => ({
              role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
              content: m.content,
            }))
            // Limit to last 10 messages (5 exchanges) to avoid token overflow
            .slice(-10);

          console.log('[AgentPanelPane] Phase 177: Sending', conversationHistory.length, 'history messages to Cloud Agent');

          // Phase 187: Build local project index for context-aware analysis
          const localProjectIndexPayload: LocalProjectIndex | undefined = projectIndex ? {
            projectRoot: projectIndex.projectRoot,
            totalFiles: projectIndex.totalFiles,
            files: projectIndex.files.slice(0, 100).map(f => ({ // Limit to 100 files to avoid payload bloat
              relativePath: f.relativePath,
              name: f.name,
              lang: f.lang,
              snippet: f.snippet?.slice(0, 500), // Limit snippet size
              exports: f.exports?.slice(0, 10),
              symbols: f.symbols?.slice(0, 20),
            })),
          } : undefined;

          // Phase 170.2: Build document attachments for server-side extraction (PDF, Word, Excel)
          // Only send documents that don't have local-extracted text (to avoid duplicate processing)
          const documentAttachmentsForServer: DocumentAttachmentData[] = effectiveAttachments
            .filter(att => att.base64 && att.attachmentType === 'document' && !att.extractedText?.includes('--- Page'))
            .map(att => ({
              name: att.name,
              base64: att.base64!,
              mimeType: att.mimeType,
              type: att.mimeType.includes('pdf') ? 'pdf' as const
                : att.mimeType.includes('word') ? 'word' as const
                : att.mimeType.includes('excel') || att.mimeType.includes('spreadsheet') ? 'excel' as const
                : 'unknown' as const,
            }));

          if (documentAttachmentsForServer.length > 0) {
            console.log('[AgentPanelPane] Phase 170.2: Sending', documentAttachmentsForServer.length, 'documents to server for extraction');
          }

          const cloudResponse = await sendChatToCloudAgent({
            apiBase: settings.cloudApiBase || 'http://localhost:3030',
            projectId: settings.projectId || '',
            message: finalEnrichedMessage, // Phase 124.2: Use snapshot+RAG enriched message
            locale: earlyEffectiveLocale, // Phase 176.7: Use detected message language, not just settings
            filePath: currentFilePath || undefined,
            fileContent: currentFileContent || undefined,
            languageId: currentFilePath ? guessLanguageId(currentFilePath) : undefined,
            token: settings.cloudAuthToken, // Phase 109.5.5
            runnerContext: autoRunnerContext, // Phase 112.1: Auto-attach failed runner logs
            imageAttachments: imageAttachments.length > 0 ? imageAttachments : undefined, // Phase 168.3
            documentAttachments: documentAttachmentsForServer.length > 0 ? documentAttachmentsForServer : undefined, // Phase 170.2
            conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined, // Phase 177: Chat memory
            projectIndex: localProjectIndexPayload, // Phase 187: Local project index
          });

          // Phase 168.3 + 170: Clear pending attachments and remember for future follow-ups
          if (effectiveAttachments.length > 0) {
            // Phase 170: Remember the first attachment for follow-ups (with timestamp)
            const firstAtt = effectiveAttachments[0];
            if (firstAtt.base64) {
              setLastAttachment({
                ...firstAtt,
                lastUsedAt: Date.now(),
              });
              console.log('[AgentPanelPane] Phase 170: Remembered attachment for follow-ups:', firstAtt.name);
            }

            // Only clear if they were newly pending (not reused remembered attachment)
            if (!usedRememberedAttachment && pendingAttachments.length > 0) {
              onClearAttachments?.();
            }
          }

          console.log('[AgentPanelPane] Cloud Agent response received:', {
            ok: true,
            kind: cloudResponse.kind,
            messagesCount: cloudResponse.messages?.length || 0,
            firstMessagePreview: cloudResponse.messages?.[0]?.slice(0, 100) || '(empty)',
            commandIntent: cloudResponse.commandIntent ?? null, // 👈 Add to log
          });

          // Handle response - check for messages array
          const replyText = cloudResponse.messages?.length
            ? cloudResponse.messages.join('\n\n')
            : '⚠️ لا يوجد رد من الوكيل - حاول مرة أخرى';

          if (!cloudResponse.messages || cloudResponse.messages.length === 0) {
            console.warn('[AgentPanelPane] Cloud Agent returned empty messages array');
          } else {
            console.log('[AgentPanelPane] Reply text length:', replyText.length);
          }

          updateAssistantMessage(assistantId, replyText);

          // Parse file blocks from response
          const parsedFiles = parseGeneratedFiles(replyText);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, generatedFiles: parsedFiles } : m
            )
          );

          // Phase 112.1: Check for commandIntent from server (takes priority)
          if (cloudResponse.commandIntent?.type === 'run') {
            const cmd = cloudResponse.commandIntent.command;
            console.log('[AgentPanelPane] Command intent from server:', cmd);
            setSuggestedCommand(cmd);
            setIsRunnerVisible(true);
            setRunnerAutoOpen(true); // 👈 Show badge
          } else {
            // Phase 111.4: Fallback - Extract command suggestion from response text
            const extractedCmd = extractCommandFromResponse(replyText);
            if (extractedCmd) {
              console.log('[AgentPanelPane] Extracted command suggestion:', extractedCmd);
              setSuggestedCommand(extractedCmd);
              setIsRunnerVisible(true);
              setRunnerAutoOpen(true); // 👈 Show badge
            }
          }

          // Phase 112.2: Extract and store runnerInsight
          if (cloudResponse.runnerInsight) {
            console.log('[AgentPanelPane] Runner insight received:', cloudResponse.runnerInsight.category);
            setRunnerInsight(cloudResponse.runnerInsight);
          }

          // Phase 112.3: Extract and store autoFixActions
          if (cloudResponse.autoFixActions && cloudResponse.autoFixActions.length > 0) {
            console.log('[AgentPanelPane] Auto-fix actions received:', cloudResponse.autoFixActions.length);
            setAutoFixActions(cloudResponse.autoFixActions);
          } else {
            setAutoFixActions([]);
          }
        }
      } else {
        // Local mode - original implementation
        console.log('[AgentPanelPane] Using Local Agent mode');

        // Build history for API (exclude error messages)
        const historyForApi: F0ChatMessage[] = messages
          .filter((m) => m.role !== 'error')
          .map((m) => ({
            role: (m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : 'assistant') as 'system' | 'user' | 'assistant',
            content: m.content,
          }));

        // Phase 109.5.3: Build system prompt based on mode
        let systemPrompt: string;
        if (isSelectionActive) {
          systemPrompt = `You are a refactoring assistant running inside the F0 Desktop IDE.

The user has SELECTED a specific region of code in the current file.
Your job is to modify **ONLY that selected region**, keeping the rest of the file exactly the same.

Rules:
- Work only on the selected code, not the whole file.
- Preserve the original logic and data flow unless the user clearly asks otherwise.
- Prefer small, focused changes (e.g. add error handling, add loading state, extract helper).
- Never invent unrelated example components (like generic Button examples) if they are not part of the selection.
- Always return ONLY the updated version of the selected region, not the entire file.
- Keep the same indentation and formatting style as the original.

Output format:
- Wrap the UPDATED selection code in a single fenced code block:
  \`\`\`tsx
  // updated selection
  \`\`\`
- Do NOT include explanations, comments outside the code, or any extra text.
- Do NOT include file headers like "### path/to/file.ext"`;
          console.log('[AgentPanelPane] Selection-aware mode activated (Phase 109.5.3)');
        } else {
          systemPrompt =
            'You are the F0 Code Agent inside the F0 Desktop IDE. Use the provided file context (fz_context) to write or refactor real project code. When generating files, use markdown headers like "### path/to/file.ext" followed by code blocks.';
        }

        historyForApi.unshift({
          role: 'system',
          content: systemPrompt,
        });

        historyForApi.push({ role: 'user', content: enrichedMessage }); // Phase 112: Use enriched message

        const fzContext = buildFzContext();

        if (fzContext) {
          const currentFile = fzContext.currentFile as { path: string; languageId: string; content: string };
          console.log('[AgentPanelPane] Sending fz_context:', {
            file: currentFile.path,
            language: currentFile.languageId,
            contentLength: currentFile.content.length,
            hasSelection: !!fzContext.selection,
          });
        }

        const replyText = await sendChatCompletion(settings, historyForApi, fzContext);
        console.log('[AgentPanelPane] Received response, length:', replyText.length);

        updateAssistantMessage(assistantId, replyText);

        setMessages((prev) => {
          const updated = prev.map((m) => {
            if (m.id === assistantId) {
              if (isSelectionActive && capturedSelection) {
                const snippets = extractSnippets(m.content);
                return { ...m, selectionContext: capturedSelection, extractedSnippets: snippets };
              } else {
                const parsedFiles = parseGeneratedFiles(m.content);
                return { ...m, generatedFiles: parsedFiles };
              }
            }
            return m;
          });
          return updated;
        });

        // Phase 111.4: Extract command suggestion from response (Local mode)
        const extractedCmd = extractCommandFromResponse(replyText);
        if (extractedCmd) {
          console.log('[AgentPanelPane] Extracted command suggestion (local):', extractedCmd);
          setSuggestedCommand(extractedCmd);
          setIsRunnerVisible(true);
          setRunnerAutoOpen(true); // 👈 Show badge
        }
      }
    } catch (err: any) {
      console.error('[AgentPanelPane] Error:', err);

      // Remove the empty assistant message that was added before the error
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));

      // Show the error message
      appendMessage({
        id: `err-${Date.now()}`,
        role: 'error',
        content: err?.message || 'Unknown error occurred.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter = Send, Shift+Enter = New line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Ctrl/Cmd+Enter also sends (legacy support)
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  // Context indicator
  const contextBadge = currentFilePath ? (
    <div className="f0-agent-context-badge">
      📄 {labels.context}: {currentFilePath.split(/[\\/]/).pop()}
    </div>
  ) : null;

  // Phase 118: Runtime issues detection from preview logs
  const recentErrors = getLastErrorLogs(3);
  const hasRuntimeIssues = recentErrors.length > 0;

  // Phase 109.5.4 + 109.5.5: Agent mode indicator with token status
  const isCloudModeWithToken = settings.agentMode === 'cloud' && settings.cloudAuthToken;
  const isCloudModeNoToken = settings.agentMode === 'cloud' && !settings.cloudAuthToken;

  const agentModeBadge = (
    <div className={`f0-agent-mode-badge ${
      isCloudModeWithToken ? 'f0-agent-mode-cloud' :
      isCloudModeNoToken ? 'f0-agent-mode-cloud-notoken' :
      'f0-agent-mode-local'
    }`}>
      {settings.agentMode === 'cloud'
        ? (settings.cloudAuthToken ? labels.cloudAgent : labels.cloudDev)
        : labels.localAgent}
    </div>
  );

  return (
    <div className="pane agent-panel-pane">
      <h2 className="pane-title">{labels.title}</h2>
      {agentModeBadge}
      {/* Phase 118: Runtime issues badge */}
      {hasRuntimeIssues && (
        <div className="f0-runtime-issues-badge">
          <span className="f0-runtime-issues-dot" />
          <span>{isArabic ? 'مشاكل في المعاينة' : 'Runtime issues detected'}</span>
        </div>
      )}
      {contextBadge}
      <div className="agent-messages">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`agent-message f0-agent-message-${msg.role}`}
          >
            <strong>
              {msg.role === 'user'
                ? labels.you
                : msg.role === 'assistant'
                  ? labels.agent
                  : msg.role === 'error'
                    ? labels.error
                    : labels.system}
            </strong>

            {/* Phase 168.7: Show attachments in user messages */}
            {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
              <div className="f0-message-attachments">
                {msg.attachments.map((att) => (
                  <div key={att.id} className={`f0-message-attachment f0-message-attachment-${att.attachmentType}`}>
                    <img
                      src={att.previewUrl}
                      alt={att.name}
                      className="f0-message-attachment-thumb"
                    />
                    <div className="f0-message-attachment-info">
                      <span className="f0-message-attachment-name">{att.name}</span>
                      {att.description && (
                        <span className="f0-message-attachment-desc">{att.description}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div>{msg.content}</div>

            {/* Phase 109.4.3: Render generated files with Apply buttons */}
            {msg.generatedFiles && msg.generatedFiles.length > 0 && (
              <div className="f0-agent-files">
                {msg.generatedFiles.map((file, fileIdx) => (
                  <div key={fileIdx} className="f0-agent-file-block">
                    <div className="f0-agent-file-header">
                      <span className="f0-agent-file-path-label">
                        📝 {file.filePath}
                      </span>
                      <button
                        className="f0-btn f0-btn-primary f0-btn-sm"
                        onClick={() => handleApplyClick(file)}
                      >
                        {labels.reviewApply}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Phase 109.5.3: Render extracted snippets with match score warning */}
            {msg.extractedSnippets && msg.extractedSnippets.length > 0 && msg.selectionContext && (
              <div className="f0-agent-snippets">
                <div className="f0-agent-snippet-info">
                  {labels.refactoredCode}{' '}
                  <strong>{msg.selectionContext.filePath.split(/[\\/]/).pop()}</strong>
                </div>
                {msg.extractedSnippets.map((snippet, snippetIdx) => {
                  // Phase 109.5.3: Compute match score
                  const score = computeSelectionMatchScore(
                    msg.selectionContext!.selectedText,
                    snippet
                  );
                  const isSuspicious = score < 0.2; // Less than 20% overlap = likely unrelated

                  return (
                    <div key={snippetIdx} className="f0-agent-snippet-block">
                      <div className="f0-agent-snippet-header">
                        <span className="f0-agent-snippet-label">
                          ✨ {labels.snippet} {snippetIdx + 1} ({snippet.length} {labels.chars})
                        </span>

                        {isSuspicious && (
                          <span className="f0-agent-snippet-warning">
                            {labels.mayNotMatch}
                          </span>
                        )}

                        <button
                          className={`f0-btn f0-btn-sm ${isSuspicious ? 'f0-btn-warning' : 'f0-btn-primary'}`}
                          onClick={() => handleApplySelectionClick(snippet, msg.selectionContext!)}
                          title={
                            isSuspicious
                              ? (isArabic ? 'قد لا يكون هذا الكود مرتبطاً بتحديدك. راجعه بعناية قبل التطبيق.' : 'This code may not be related to your selection. Review carefully before applying.')
                              : (isArabic ? 'طبق هذا الكود ليحل محل التحديد' : 'Apply this code to replace your selected region')
                          }
                        >
                          {isSuspicious ? labels.applyAnyway : labels.applyToSelection}
                        </button>
                      </div>
                      <pre className="f0-agent-snippet-preview">
                        {snippet}
                      </pre>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {isSending && (
          <div className="agent-message f0-agent-message-assistant">
            <strong>{labels.agent}</strong>
            <div>{labels.thinking}</div>
          </div>
        )}
      </div>
      <div className="agent-input">
        {/* Phase 168.2 + 168.5: Attachments preview (images + documents) */}
        {pendingAttachments.length > 0 && (
          <div className="f0-agent-attachments">
            {pendingAttachments.map((att) => (
              <div key={att.id} className={`f0-agent-attachment f0-agent-attachment-${att.attachmentType || 'image'}`}>
                <img
                  src={att.previewUrl}
                  alt={att.name}
                  className="f0-agent-attachment-preview"
                  onClick={() => {
                    // Open image in new tab for full view (only for images)
                    if (att.attachmentType === 'image') {
                      window.open(att.previewUrl, '_blank');
                    }
                  }}
                />
                <div className="f0-agent-attachment-info">
                  <span className="f0-agent-attachment-name">{att.name}</span>
                  {/* Phase 168.5: Show document metadata */}
                  {att.documentMetadata?.pageCount && (
                    <span className="f0-agent-attachment-meta">
                      {att.documentMetadata.pageCount} {isArabic ? 'صفحات' : 'pages'}
                    </span>
                  )}
                  {att.documentMetadata?.sheetCount && (
                    <span className="f0-agent-attachment-meta">
                      {att.documentMetadata.sheetCount} {isArabic ? 'أوراق' : 'sheets'}
                    </span>
                  )}
                  {/* Phase 168.5 + 168.6: Show extraction/transcription status */}
                  {att.extractedText && att.attachmentType === 'audio' && att.extractedText.includes('Transcription') && (
                    <span className="f0-agent-attachment-meta f0-agent-attachment-extracted">
                      🎙️ {isArabic ? 'تم تحويل الصوت لنص' : 'Transcribed'}
                    </span>
                  )}
                  {att.extractedText && att.attachmentType === 'audio' && att.extractedText.includes('⏳') && (
                    <span className="f0-agent-attachment-meta f0-agent-attachment-pending">
                      ⏳ {isArabic ? 'جاري التحويل...' : 'Transcribing...'}
                    </span>
                  )}
                  {att.extractedText && att.attachmentType === 'audio' && att.extractedText.includes('⚠️') && (
                    <span className="f0-agent-attachment-meta f0-agent-attachment-error">
                      ⚠️ {isArabic ? 'فشل التحويل' : 'Transcription failed'}
                    </span>
                  )}
                  {att.extractedText && att.attachmentType !== 'audio' && (
                    <span className="f0-agent-attachment-meta f0-agent-attachment-extracted">
                      ✓ {isArabic ? 'تم استخراج النص' : 'Text extracted'}
                    </span>
                  )}
                  {/* Phase 179.1: View transcript button for audio files */}
                  {att.attachmentType === 'audio' && att.extractedText?.includes('Transcription') && (
                    <button
                      className="f0-agent-attachment-transcript-btn"
                      onClick={() => {
                        // Extract just the transcript text from extractedText
                        const transcriptMatch = att.extractedText?.match(/Transcription:\s*([\s\S]*)/);
                        const transcriptMatchAr = att.extractedText?.match(/تحويل الصوت:\s*([\s\S]*)/);
                        const rawTranscript = transcriptMatch?.[1] || transcriptMatchAr?.[1] || att.extractedText || '';
                        setTranscriptView({
                          attachmentId: att.id,
                          isEditing: false,
                          editedText: rawTranscript.trim(),
                        });
                      }}
                      title={isArabic ? 'عرض النص المستخرج' : 'View transcript'}
                    >
                      📝 {isArabic ? 'عرض النص' : 'View'}
                    </button>
                  )}
                </div>
                <button
                  className="f0-agent-attachment-remove"
                  onClick={() => onClearAttachments?.()}
                  title={isArabic ? 'إزالة' : 'Remove'}
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="f0-agent-attachment-hint">
              {pendingAttachments.some(a => a.attachmentType === 'image')
                ? (isArabic ? '📷 صورة مرفقة - اسأل الوكيل عنها' : '📷 Image attached - ask the agent about it')
                : pendingAttachments.some(a => a.attachmentType === 'document')
                  ? (isArabic ? '📄 مستند مرفق - تم استخراج النص للتحليل' : '📄 Document attached - text extracted for analysis')
                  : pendingAttachments.some(a => a.attachmentType === 'audio' && a.extractedText?.includes('Transcription'))
                    ? (isArabic ? '🎙️ ملف صوتي - تم تحويله لنص للتحليل' : '🎙️ Audio file - transcribed for analysis')
                    : (isArabic ? '🎵 ملف صوتي مرفق - جاري التحويل...' : '🎵 Audio file attached - transcribing...')
              }
            </div>
          </div>
        )}

        {/* Phase 179.1: Audio Transcript Viewer Pane */}
        {transcriptView && (
          <div className="f0-transcript-viewer">
            <div className="f0-transcript-header">
              <span className="f0-transcript-title">
                🎙️ {isArabic ? 'نص التسجيل الصوتي' : 'Audio Transcript'}
              </span>
              <div className="f0-transcript-actions">
                {transcriptView.isEditing ? (
                  <>
                    <button
                      className="f0-transcript-btn f0-transcript-save"
                      onClick={() => {
                        // Find the attachment and update its extractedText
                        const att = pendingAttachments.find(a => a.id === transcriptView.attachmentId);
                        if (att && onUpdateAttachmentText) {
                          // Build new extractedText with the edited transcript
                          const originalHeader = att.extractedText?.split('\n\n')[0] || '';
                          const newExtractedText = `${originalHeader}\n\n${isArabic ? 'تحويل الصوت:' : 'Transcription:'} ${transcriptView.editedText}`;
                          onUpdateAttachmentText(transcriptView.attachmentId, newExtractedText);
                        }
                        setTranscriptView(prev => prev ? { ...prev, isEditing: false } : null);
                      }}
                    >
                      ✓ {isArabic ? 'حفظ' : 'Save'}
                    </button>
                    <button
                      className="f0-transcript-btn f0-transcript-cancel"
                      onClick={() => {
                        // Revert to original text
                        const att = pendingAttachments.find(a => a.id === transcriptView.attachmentId);
                        const transcriptMatch = att?.extractedText?.match(/Transcription:\s*([\s\S]*)/);
                        const transcriptMatchAr = att?.extractedText?.match(/تحويل الصوت:\s*([\s\S]*)/);
                        const originalText = transcriptMatch?.[1] || transcriptMatchAr?.[1] || '';
                        setTranscriptView(prev => prev ? { ...prev, isEditing: false, editedText: originalText.trim() } : null);
                      }}
                    >
                      ✕ {isArabic ? 'إلغاء' : 'Cancel'}
                    </button>
                  </>
                ) : (
                  <button
                    className="f0-transcript-btn f0-transcript-edit"
                    onClick={() => setTranscriptView(prev => prev ? { ...prev, isEditing: true } : null)}
                  >
                    ✏️ {isArabic ? 'تعديل' : 'Edit'}
                  </button>
                )}
                <button
                  className="f0-transcript-btn f0-transcript-close"
                  onClick={() => setTranscriptView(null)}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="f0-transcript-content">
              {transcriptView.isEditing ? (
                <textarea
                  className="f0-transcript-textarea"
                  value={transcriptView.editedText}
                  onChange={(e) => setTranscriptView(prev => prev ? { ...prev, editedText: e.target.value } : null)}
                  placeholder={isArabic ? 'اكتب النص هنا...' : 'Type transcript here...'}
                  autoFocus
                />
              ) : (
                <div className="f0-transcript-text">
                  {transcriptView.editedText || (isArabic ? 'لا يوجد نص' : 'No transcript')}
                </div>
              )}
            </div>
            {!transcriptView.isEditing && (
              <div className="f0-transcript-hint">
                {isArabic ? '💡 اضغط تعديل لتصحيح أي كلمات غلط' : '💡 Click Edit to fix any transcription errors'}
              </div>
            )}
          </div>
        )}

        {/* Phase 170: Remembered attachment indicator (show when no pending attachments) */}
        {pendingAttachments.length === 0 && lastAttachment && (Date.now() - lastAttachment.lastUsedAt) < 30 * 60 * 1000 && (
          <div className="f0-agent-remembered-attachment">
            <span className="f0-agent-remembered-icon">🔄</span>
            <span className="f0-agent-remembered-text">
              {isArabic
                ? `مرفق سابق متاح: "${lastAttachment.name}" - اكتب "بالنسبة للصورة..." لاستخدامه`
                : `Previous attachment available: "${lastAttachment.name}" - type "about the image..." to use it`
              }
            </span>
            <button
              className="f0-agent-remembered-clear"
              onClick={() => setLastAttachment(null)}
              title={isArabic ? 'مسح المرفق المحفوظ' : 'Clear remembered attachment'}
            >
              ✕
            </button>
          </div>
        )}
        {/* Phase 109.5: Selection hint */}
        {projectState.selection && projectState.selection.selectedText.trim().length > 0 && (
          <div className="f0-agent-selection-hint">
            {labels.selectionDetected} ({projectState.selection.selectedText.length} {labels.chars}) {labels.describeRefactor}
          </div>
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            projectState.selection && projectState.selection.selectedText.trim().length > 0
              ? labels.placeholderSelection
              : labels.placeholderGeneral
          }
          rows={3}
          disabled={isSending}
        />
        {/* Phase 123: Reorganized action buttons in rows */}
        <div className="f0-agent-actions-container">
          {/* Row 1: Primary actions - Send */}
          <div className="f0-agent-actions-row f0-agent-actions-primary">
            <button
              className="f0-action-btn f0-action-btn-send"
              onClick={handleSend}
              disabled={isSending || !input.trim()}
            >
              {isSending ? labels.sending : labels.send}
            </button>
          </div>

          {/* Row 2: Quick actions */}
          <div className="f0-agent-actions-row f0-agent-actions-quick">
            {/* Run QA */}
            {settings.agentMode === 'cloud' && settings.projectId && (
              <button
                className={`f0-action-btn f0-action-btn-qa ${
                  qaResult?.status === 'passed' ? 'success' :
                  qaResult?.status === 'failed' ? 'warning' : ''
                }`}
                onClick={handleRunQa}
                disabled={isRunningQa}
                title={qaResult?.summary || (isArabic ? 'تشغيل QA' : 'Run QA')}
              >
                {isRunningQa ? '⏳' : '🧪'} {isArabic ? 'QA' : 'QA'}
              </button>
            )}

            {/* Ask about Run */}
            {settings.agentMode === 'cloud' && settings.projectId && (
              <button
                className="f0-action-btn f0-action-btn-run"
                onClick={handleAskAboutLastRun}
                disabled={isSending}
                title={isArabic ? 'اسأل عن آخر Run' : 'Ask about Run'}
              >
                📟 {isArabic ? 'آخر Run' : 'Last Run'}
              </button>
            )}

            {/* Protect with Auth - Show for .tsx/.jsx files */}
            {currentFilePath && (currentFilePath.endsWith('.tsx') || currentFilePath.endsWith('.jsx')) && (
              <button
                className="f0-action-btn f0-action-btn-auth"
                onClick={handleProtectWithAuth}
                disabled={isProtectingWithAuth || isSending}
                title={isArabic ? 'حماية بـ Auth' : 'Protect with Auth'}
              >
                🔐 Auth
              </button>
            )}

            {/* Fix Preview Errors */}
            {hasRuntimeIssues && settings.agentMode === 'cloud' && settings.projectId && (
              <button
                className="f0-action-btn f0-action-btn-fix"
                onClick={() => {
                  const runtimeCtx = buildRuntimeDebugContext();
                  if (runtimeCtx) {
                    const prompt = isArabic ? 'أصلح أخطاء المعاينة:' : 'Fix preview errors:';
                    setInput(`${prompt}\n\n${runtimeCtx}`);
                  }
                }}
                disabled={isSending}
                title={isArabic ? 'أصلح أخطاء المعاينة' : 'Fix preview errors'}
              >
                🛠 {isArabic ? 'أصلح' : 'Fix'}
              </button>
            )}

            {/* Undo */}
            <button
              className="f0-action-btn f0-action-btn-undo"
              onClick={() => {
                projectState.undoLastAgentChange();
                appendMessage({
                  id: `sys-${Date.now()}`,
                  role: 'system',
                  content: labels.revertedChange,
                });
              }}
              disabled={projectState.undoStack.length === 0}
              title={isArabic ? 'تراجع' : 'Undo'}
            >
              ↩️ {isArabic ? 'تراجع' : 'Undo'}
            </button>
          </div>

          {/* Row 3: Tools - Always visible */}
          <div className="f0-agent-actions-row f0-agent-actions-tools">
            {/* Snapshot Button - Always show if project is open */}
            <SnapshotButton
              projectRoot={rootPath || '/'}
              projectId={settings.projectId}
              locale={locale as 'ar' | 'en'}
              className="f0-action-btn-snapshot"
            />

            {/* Phase 124.2 Part 2: Snapshot Status Indicator */}
            {hasSnapshot && snapshotSummary && (
              <span
                className={`f0-snapshot-status ${isSnapshotFresh ? 'fresh' : 'stale'}`}
                title={`${snapshotSummary.projectName}: ${snapshotSummary.pageCount} ${isArabic ? 'صفحة' : 'pages'}, ${snapshotSummary.apiCount} APIs`}
              >
                {isSnapshotFresh ? '🟢' : '🟡'} {snapshotSummary.pageCount}p/{snapshotSummary.apiCount}a
              </span>
            )}

            {/* RAG Context Toggle */}
            {ragContextFiles.length > 0 && (
              <button
                className={`f0-action-btn f0-action-btn-rag ${showRagContext ? 'active' : ''}`}
                onClick={() => setShowRagContext(!showRagContext)}
                title={isArabic ? 'عرض ملفات السياق' : 'Show context files'}
              >
                📚 {ragContextFiles.length}
              </button>
            )}

            {/* RAG Loading */}
            {isLoadingRag && (
              <span className="f0-rag-loading">
                🔍
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Phase 122: RAG Context Panel */}
      {showRagContext && ragContextFiles.length > 0 && (
        <RagContextPanel
          contextFiles={ragContextFiles}
          isLoading={isLoadingRag}
          locale={settings.locale || 'ar'}
          onClose={() => setShowRagContext(false)}
        />
      )}

      {/* Phase 167.1: Code Location Panel */}
      {showCodeLocation && codeLocationResults.length > 0 && (
        <CodeLocationPanel
          results={codeLocationResults}
          locale={settings.locale || 'ar'}
          onClose={() => setShowCodeLocation(false)}
          onOpenFile={(filePath) => {
            // Phase 167.4: Open file in editor using prop callback from App.tsx
            // Build absolute path by combining rootPath + relative filePath
            const absolutePath = rootPath ? `${rootPath}/${filePath}` : filePath;
            console.log('[AgentPanelPane] Opening file from Code Location:', absolutePath);
            if (onOpenFile) {
              // Extract filename from path
              const fileName = filePath.split('/').pop() || filePath;
              // Detect language from extension
              const ext = fileName.split('.').pop()?.toLowerCase();
              const languageMap: Record<string, string> = {
                'ts': 'typescript',
                'tsx': 'typescriptreact',
                'js': 'javascript',
                'jsx': 'javascriptreact',
                'json': 'json',
                'md': 'markdown',
                'css': 'css',
                'html': 'html',
                'py': 'python',
                'go': 'go',
                'rs': 'rust',
              };
              const language = ext ? languageMap[ext] || null : null;
              onOpenFile(absolutePath, fileName, language);
              // Close the panel after opening file
              setShowCodeLocation(false);
            } else {
              console.warn('[AgentPanelPane] onOpenFile prop not provided');
            }
          }}
        />
      )}

      {/* Phase 109.4.4: Diff Preview Modal */}
      <DiffPreviewModal
        isOpen={diffPreviewState !== null}
        filePath={diffPreviewState?.file.filePath ?? ''}
        oldContent={diffPreviewState?.oldContent ?? ''}
        newContent={diffPreviewState?.file.code ?? ''}
        onCancel={() => setDiffPreviewState(null)}
        onConfirm={handleConfirmDiff}
      />

      {/* Phase 109.5.2: Selection Diff Preview Modal */}
      <DiffPreviewModal
        isOpen={selectionDiffState !== null}
        filePath={selectionDiffState?.selectionContext.filePath ?? ''}
        oldContent={selectionDiffState?.selectionContext.selectedText ?? ''}
        newContent={selectionDiffState?.snippet ?? ''}
        onCancel={() => setSelectionDiffState(null)}
        onConfirm={handleConfirmSelectionDiff}
      />

      {/* Phase 110.2: Refactor Dock for Cloud Agent edits */}
      {isRefactorDockOpen && pendingEdits.length > 0 && (
        <RefactorDock
          edits={pendingEdits}
          rootPath={rootPath}
          onApplyEdit={handleApplyEdit}
          onDiscardEdit={handleDiscardEdit}
          onApplyAll={handleApplyAllEdits}
          onDiscardAll={handleDiscardAllEdits}
          onClose={() => setIsRefactorDockOpen(false)}
          isApplying={isApplyingEdit}
          locale={settings.locale || 'ar'}
        />
      )}

      {/* Phase 112.2: Runner Insight Card */}
      {runnerInsight && (
        <div className={`f0-runner-insight f0-runner-insight-${runnerInsight.severity}`}>
          <div className="f0-runner-insight-header">
            <span className="f0-runner-insight-icon">
              {runnerInsight.severity === 'error' ? '❌' : runnerInsight.severity === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <span className="f0-runner-insight-title">
              {settings.locale === 'ar' ? runnerInsight.titleAr : runnerInsight.title}
            </span>
            <button
              className="f0-runner-insight-close"
              onClick={() => setRunnerInsight(null)}
              title={settings.locale === 'ar' ? 'إغلاق' : 'Close'}
            >
              ✕
            </button>
          </div>
          <p className="f0-runner-insight-summary">
            {settings.locale === 'ar' ? runnerInsight.summaryAr : runnerInsight.summary}
          </p>
          <div className="f0-runner-insight-suggestions">
            <strong>{settings.locale === 'ar' ? '💡 اقتراحات:' : '💡 Suggestions:'}</strong>
            <ul>
              {(settings.locale === 'ar' ? runnerInsight.suggestionsAr : runnerInsight.suggestions).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>

          {/* Phase 112.3: Auto-Fix Buttons */}
          {autoFixActions.length > 0 && (
            <div className="f0-runner-autofix">
              <div className="f0-runner-autofix-title">
                {settings.locale === 'ar' ? '🔧 إصلاح سريع:' : '🔧 Quick Fix:'}
              </div>
              <div className="f0-runner-autofix-buttons">
                {autoFixActions.map((action) => (
                  <button
                    key={action.id}
                    className="f0-btn f0-btn-xs f0-btn-autofix"
                    onClick={() => {
                      console.log('[AgentPanelPane] Running auto-fix:', action.command);
                      setSuggestedCommand(action.command);
                      setIsRunnerVisible(true);
                      setRunnerAutoOpen(true);
                    }}
                    title={settings.locale === 'ar' ? action.descriptionAr : action.description}
                  >
                    {settings.locale === 'ar' ? action.labelAr : action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Phase 111.4: Runner Panel Toggle + Panel */}
      <div className="f0-runner-section">
        <button
          className={`f0-btn f0-btn-sm f0-runner-toggle ${isRunnerVisible ? 'active' : ''} ${suggestedCommand ? 'has-suggestion' : ''} ${runnerAutoOpen ? 'pulse' : ''}`}
          onClick={() => {
            setIsRunnerVisible(!isRunnerVisible);
            // Phase 112.1: Clear auto-open badge when manually toggled
            if (!isRunnerVisible) {
              setRunnerAutoOpen(false);
            }
          }}
          title={suggestedCommand ? `${isArabic ? 'مقترح' : 'Suggested'}: ${suggestedCommand}` : (isArabic ? 'تبديل عرض Runner' : 'Toggle command runner')}
        >
          {isRunnerVisible ? labels.hideRunner : labels.showRunner}
          {/* Phase 112.1: Show badge when command is ready */}
          {(suggestedCommand && !isRunnerVisible) || runnerAutoOpen ? (
            <span className="f0-runner-badge">💡</span>
          ) : null}
        </button>

        {isRunnerVisible && (
          <RunnerPanel
            projectPath={rootPath}
            suggestedCommand={suggestedCommand}
            onSuggestedCommandUsed={() => {
              setSuggestedCommand(null);
              setRunnerAutoOpen(false); // Clear badge when command is used
            }}
            onRunnerFinished={(payload) => {
              // Phase 112.1: Store runner logs for auto-attaching to next agent message
              setLastRunnerLogs(payload);
              console.log('[AgentPanelPane] Runner finished, storing logs for agent context:', {
                command: payload.command,
                status: payload.status,
                exitCode: payload.exitCode,
                logsCount: payload.logs.length,
              });

              // Phase 115.3: Auto-refresh browser preview when runner succeeds
              if (payload.status === 'success') {
                triggerPreviewReload();
              }
            }}
            locale={settings.locale || 'ar'}
          />
        )}
      </div>
    </div>
  );
};

export default AgentPanelPane;
