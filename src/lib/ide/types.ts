/**
 * Phase 109.5.4: Shared IDE Types
 * Contract between Desktop IDE and Web IDE / Cloud API
 */

// مين بيبعت الريكوست: Web IDE ولا Desktop IDE
export type IdeClientSource = 'web-ide' | 'desktop-ide' | 'vscode' | 'cursor';

export type IdeMode = 'chat' | 'refactor' | 'plan' | 'explain';

export interface SelectionPosition {
  line: number;   // 1-based
  column: number; // 1-based
}

export interface SelectionContext {
  filePath: string;              // مثال: "src/components/Button.tsx"
  languageId: string;            // "typescript" | "javascript" | "python" ...
  fullText: string;              // محتوى الملف كامل
  selectionStart: SelectionPosition;
  selectionEnd: SelectionPosition;
  selectedText?: string;         // النص المحدد (اختياري)
}

/**
 * Phase 168.3: Image attachment for vision analysis
 * Used for drag & drop images in Desktop IDE
 */
export interface ImageAttachmentData {
  name: string;
  base64: string;
  mimeType: string;
}

/**
 * Phase 170.2: Document attachment for PDF/Word/Excel analysis
 * Used for drag & drop documents that need text extraction
 */
export interface DocumentAttachmentData {
  name: string;
  base64: string;
  mimeType: string;
  type: 'pdf' | 'word' | 'excel' | 'unknown';
}

/**
 * Phase 177: Chat history message for conversation memory
 * Allows the agent to remember previous exchanges in the session
 */
export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Phase 187: Local project index for context-aware analysis
 * Sent from Desktop IDE to provide local project structure
 */
export interface LocalProjectIndexFile {
  relativePath: string;
  name: string;
  lang: string;
  snippet?: string;
  exports?: string[];
  symbols?: string[];
}

export interface LocalProjectIndex {
  projectRoot: string;
  totalFiles: number;
  files: LocalProjectIndexFile[];
}

/**
 * Desktop IDE Chat Request
 * يستخدم نفس الـ endpoint بتاع Web IDE
 */
export interface DesktopIdeChatRequest {
  projectId: string;
  source: IdeClientSource;       // 'desktop-ide' هنا
  mode: IdeMode;                 // غالباً 'refactor' في selection mode
  message: string;               // طلب المستخدم (بالعربي عادي)
  fileContext?: SelectionContext; // مهم في حالة الـ refactor
  locale?: 'ar' | 'en';
  // Session info (optional - desktop may not have sessions)
  sessionId?: string;
  // Client version for debugging
  clientVersion?: string;
  /**
   * Phase 109.5.5: Test mode flag
   * لو true ده مجرد Ping / Test Connection
   * ما نشغّلش الـ Agent ولا نسجّل Logs تقيلة
   */
  testOnly?: boolean;
  /**
   * Phase 112.2: Runner context
   * آخر نتائج الـ Runner (الـ console output)
   * يساعد الوكيل يفهم الأخطاء ويقترح إصلاحات
   */
  runnerContext?: string;
  /**
   * Phase 168.3: Image attachments for vision analysis
   * Used for drag & drop images that user wants to discuss
   */
  imageAttachments?: ImageAttachmentData[];
  /**
   * Phase 170.2: Document attachments for PDF/Word/Excel analysis
   * Used for drag & drop documents that need text extraction
   */
  documentAttachments?: DocumentAttachmentData[];
  /**
   * Phase 177: Conversation history for chat memory
   * Allows the agent to remember previous exchanges in the current session
   */
  conversationHistory?: ChatHistoryMessage[];
  /**
   * Phase 187: Local project index for context-aware analysis
   * Contains project file structure and code snippets from Desktop IDE
   */
  projectIndex?: LocalProjectIndex;
}

/**
 * Refactor edit - تعديل واحد على ملف
 */
export interface IdeRefactorEdit {
  filePath: string;
  type: 'replace-range' | 'insert' | 'delete' | 'full-replace';
  range?: {
    start: SelectionPosition;
    end: SelectionPosition;
  };
  newText: string;
  // Optional metadata
  description?: string;
}

/**
 * Phase 112.2: Runner Error Insight
 * Structured insight from runner error classification
 */
export interface RunnerInsight {
  category: string;
  title: string;
  titleAr: string;
  summary: string;
  summaryAr: string;
  suggestions: string[];
  suggestionsAr: string[];
  severity: 'error' | 'warning' | 'info';
}

/**
 * Phase 112.3: Auto-Fix Action
 * One-click fix command suggested based on error classification
 */
export interface RunnerAutoFixAction {
  id: string;
  label: string;           // Button label (English)
  labelAr: string;         // Button label (Arabic)
  description?: string;    // Tooltip description
  descriptionAr?: string;  // Tooltip in Arabic
  command: string;         // Command to run in Runner
}

/**
 * Phase 188: Model selection metadata for debugging
 */
export interface ModelMeta {
  provider: string;
  model: string;
  profile: string;
  fallbackChain: string[];
  latencyMs?: number;
}

/**
 * Desktop IDE Chat Response
 */
export interface DesktopIdeChatResponse {
  kind: 'chat' | 'refactor' | 'error';
  messages: string[];              // ردود نصية (explanation / steps)
  edits?: IdeRefactorEdit[];       // التعديلات المقترحة
  // Error info
  error?: string;
  errorCode?: string;
  // Phase 112.2: Runner insight
  runnerInsight?: RunnerInsight;
  // Phase 112.3: Auto-fix actions
  autoFixActions?: RunnerAutoFixAction[];
  // Phase 188: Model metadata (dev mode only)
  meta?: ModelMeta;
}

/**
 * Map from Desktop safe selection to SelectionContext
 */
export interface SafeSelection {
  filePath: string;
  languageId: string;
  fullText: string;
  selectedText: string;
  start: { line: number; column: number };
  end: { line: number; column: number };
}

/**
 * Helper to convert SafeSelection to SelectionContext
 */
export function mapSafeToSelectionContext(s: SafeSelection): SelectionContext {
  return {
    filePath: s.filePath,
    languageId: s.languageId,
    fullText: s.fullText,
    selectedText: s.selectedText,
    selectionStart: { line: s.start.line, column: s.start.column },
    selectionEnd: { line: s.end.line, column: s.end.column },
  };
}

/**
 * Phase 109.5.5: Unified API Error Codes
 */
export type IdeDesktopErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVALID_API_KEY'
  | 'INVALID_PROJECT'
  | 'AGENT_ERROR'
  | 'BAD_REQUEST';

/**
 * Phase 112.1: Command intent for CLI commands
 * When detected, Desktop can auto-run the command in Runner
 */
export interface CommandIntent {
  type: 'run';
  command: string;
}

/**
 * Phase 109.5.5: Success response shape
 */
export interface IdeDesktopChatSuccess {
  ok: true;
  result: DesktopIdeChatResponse;
  /** Phase 112.1: Optional command intent for auto-run */
  commandIntent?: CommandIntent;
}

/**
 * Phase 109.5.5: Error response shape
 */
export interface IdeDesktopChatError {
  ok: false;
  errorCode: IdeDesktopErrorCode;
  message: string;
}

/**
 * Phase 109.5.5: Unified API response type
 */
export type IdeDesktopChatApiResponse =
  | IdeDesktopChatSuccess
  | IdeDesktopChatError;

/**
 * Convert Desktop request to Web IDE request format
 */
export function toWebIdeRequest(desktop: DesktopIdeChatRequest): any {
  return {
    sessionId: desktop.sessionId || `desktop_${Date.now()}`,
    projectId: desktop.projectId,
    message: desktop.message,
    locale: desktop.locale || 'en',
    ideType: 'desktop',
    mode: desktop.mode === 'refactor' ? 'single-file' : 'single-file',
    fileContext: desktop.fileContext ? [{
      filePath: desktop.fileContext.filePath,
      path: desktop.fileContext.filePath,
      content: desktop.fileContext.fullText,
      languageId: desktop.fileContext.languageId,
      selection: {
        startLine: desktop.fileContext.selectionStart.line,
        startCol: desktop.fileContext.selectionStart.column,
        endLine: desktop.fileContext.selectionEnd.line,
        endCol: desktop.fileContext.selectionEnd.column,
      },
    }] : undefined,
    metadata: {
      source: desktop.source,
      clientVersion: desktop.clientVersion,
    },
  };
}
