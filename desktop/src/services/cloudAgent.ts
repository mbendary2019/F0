/**
 * Phase 109.5.4 + 109.5.5: Cloud Agent Service
 * Connects Desktop IDE to the F0 Cloud Agent
 *
 * Phase 109.5.5 additions:
 * - Unified API response format { ok, result } or { ok, errorCode, message }
 * - testCloudAgentConnection() for Settings test button
 * - CloudAgentConfig type for cleaner API
 */

// Types matching the server-side definitions
export type IdeClientSource = 'web-ide' | 'desktop-ide' | 'vscode' | 'cursor';
export type IdeMode = 'chat' | 'refactor' | 'plan' | 'explain';

export interface SelectionPosition {
  line: number;   // 1-based
  column: number; // 1-based
}

export interface SelectionContext {
  filePath: string;
  languageId: string;
  fullText: string;
  selectionStart: SelectionPosition;
  selectionEnd: SelectionPosition;
  selectedText?: string;
}

// Phase 168.3: Image attachment for vision analysis
export interface ImageAttachmentData {
  name: string;
  base64: string;
  mimeType: string;
}

// Phase 170.2: Document attachment for PDF/Word/Excel analysis
export interface DocumentAttachmentData {
  name: string;
  base64: string;
  mimeType: string;
  type: 'pdf' | 'word' | 'excel' | 'unknown';
}

// Phase 177: Conversation history message format
export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Phase 187: Local project index for context-aware analysis
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

export interface DesktopIdeChatRequest {
  projectId: string;
  source: IdeClientSource;
  mode: IdeMode;
  message: string;
  fileContext?: SelectionContext;
  locale?: 'ar' | 'en';
  sessionId?: string;
  clientVersion?: string;
  testOnly?: boolean;  // Phase 109.5.5
  runnerContext?: string; // Phase 112.2: Runner output for error analysis
  imageAttachments?: ImageAttachmentData[]; // Phase 168.3: Image attachments for vision
  documentAttachments?: DocumentAttachmentData[]; // Phase 170.2: PDF/Word/Excel attachments
  conversationHistory?: ChatHistoryMessage[]; // Phase 177: Chat memory support
  projectIndex?: LocalProjectIndex; // Phase 187: Local project index for context-aware analysis
}

export interface IdeRefactorEdit {
  filePath: string;
  type: 'replace-range' | 'insert' | 'delete' | 'full-replace';
  range?: {
    start: SelectionPosition;
    end: SelectionPosition;
  };
  newText: string;
  description?: string;
}

// Phase 112.2: Runner Error Insight
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

// Phase 112.3: Auto-Fix Action
export interface RunnerAutoFixAction {
  id: string;
  label: string;
  labelAr: string;
  description?: string;
  descriptionAr?: string;
  command: string;
}

// Phase 188: Model metadata for debugging
export interface ModelMeta {
  provider: string;
  model: string;
  profile: string;
  fallbackChain: string[];
  latencyMs?: number;
}

export interface DesktopIdeChatResponse {
  kind: 'chat' | 'refactor' | 'error';
  messages: string[];
  edits?: IdeRefactorEdit[];
  error?: string;
  errorCode?: string;
  runnerInsight?: RunnerInsight; // Phase 112.2
  autoFixActions?: RunnerAutoFixAction[]; // Phase 112.3
  meta?: ModelMeta; // Phase 188: Model metadata
}

// Phase 109.5.5: Unified API response types
export type IdeDesktopErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVALID_API_KEY'
  | 'INVALID_PROJECT'
  | 'AGENT_ERROR'
  | 'BAD_REQUEST';

// Phase 112.1: Command intent for CLI commands
export interface CommandIntent {
  type: 'run';
  command: string;
}

export interface IdeDesktopChatSuccess {
  ok: true;
  result: DesktopIdeChatResponse;
  commandIntent?: CommandIntent; // Phase 112.1
}

export interface IdeDesktopChatError {
  ok: false;
  errorCode: IdeDesktopErrorCode;
  message: string;
}

export type IdeDesktopChatApiResponse =
  | IdeDesktopChatSuccess
  | IdeDesktopChatError;

// Desktop app's safe selection type
export interface SafeSelection {
  filePath: string;
  languageId: string;
  fullText: string;
  selectedText: string;
  start: { line: number; column: number };
  end: { line: number; column: number };
}

/**
 * Phase 109.5.5: Cloud Agent configuration
 */
export interface CloudAgentConfig {
  apiBase: string;       // e.g. "http://localhost:3030"
  projectId: string;
  apiKey?: string;       // F0_DESKTOP_API_KEY
}

/**
 * Convert SafeSelection to SelectionContext
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
 * Robust extraction of assistant message from various response formats
 */
function extractAssistantMessage(raw: any): string {
  const result = raw?.result ?? raw;

  // 1) لو فيه text مباشر في result
  if (typeof result?.text === 'string' && result.text.trim().length > 0) {
    console.log('[CloudAgent] ✅ Found text in result.text');
    return result.text.trim();
  }

  // 2) لو فيه messages array
  const msgs = result?.messages;
  if (Array.isArray(msgs) && msgs.length > 0) {
    console.log('[CloudAgent] ✅ Found messages array, length:', msgs.length);
    // ناخد آخر رسالة فيها نص
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (!m) continue;

      // لو الرسالة string مباشرة
      if (typeof m === 'string' && m.trim().length > 0) {
        console.log('[CloudAgent] ✅ Message is a string');
        return m.trim();
      }

      // لو object: نحاول نقرأ من أكتر من key
      if (typeof m === 'object') {
        const candidate =
          m.content ??
          m.text ??
          m.message ??
          (m.preview && typeof m.preview.text === 'string'
            ? m.preview.text
            : null);

        if (typeof candidate === 'string' && candidate.trim().length > 0) {
          console.log('[CloudAgent] ✅ Found message in object property');
          return candidate.trim();
        }
      }
    }
  }

  // 3) لو مفيش ولا حاجة من اللي فوق اشتغلت → نرجع fallback
  console.error('[CloudAgent] ❌ Could not extract message, raw:', JSON.stringify(raw, null, 2));
  return '⚠️ استلمت رد من الخادم لكن مش قادر أفسّره.';
}

/**
 * Internal helper to POST to desktop-chat endpoint
 */
async function postToDesktopChat(
  config: CloudAgentConfig,
  body: DesktopIdeChatRequest,
): Promise<IdeDesktopChatApiResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const url = `${config.apiBase}/api/ide/desktop-chat`;

  console.log('[CloudAgent] Sending request to:', url);
  console.log('[CloudAgent] Request body:', {
    projectId: body.projectId,
    source: body.source,
    mode: body.mode,
    messageLength: body.message?.length,
    locale: body.locale,
    testOnly: body.testOnly,
  });

  let res: Response;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _actualUrl = url; // Used for debugging

  // Phase 170.3: Extended timeout (90s) for first request when server needs to compile
  const TIMEOUT_MS = 90000;

  // Helper function to fetch with timeout
  const fetchWithTimeout = async (fetchUrl: string): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  try {
    res = await fetchWithTimeout(url);
  } catch (fetchError: any) {
    // Check if it was a timeout
    if (fetchError.name === 'AbortError') {
      console.error('[CloudAgent] Request timed out after', TIMEOUT_MS / 1000, 'seconds');
      return {
        ok: false,
        errorCode: 'AGENT_ERROR',
        message: `Request timed out after ${TIMEOUT_MS / 1000}s. The server may be compiling - please try again.`,
      };
    }

    // Phase 186: Auto-fallback to port 3031 if 3030 fails
    if (url.includes(':3030')) {
      const fallbackUrl = url.replace(':3030', ':3031');
      console.log('[CloudAgent] Port 3030 failed, trying fallback port 3031:', fallbackUrl);
      try {
        res = await fetchWithTimeout(fallbackUrl);
        _actualUrl = fallbackUrl;
        console.log('[CloudAgent] ✅ Fallback to port 3031 succeeded');
      } catch (fallbackError: any) {
        console.error('[CloudAgent] Fallback also failed:', fallbackError);
        return {
          ok: false,
          errorCode: 'AGENT_ERROR',
          message: `Failed to connect to ${config.apiBase} (and fallback port 3031) - ${fetchError?.message || 'Network error'}`,
        };
      }
    } else {
      // Network error - server not running or CORS issue
      console.error('[CloudAgent] Fetch failed:', fetchError);
      return {
        ok: false,
        errorCode: 'AGENT_ERROR',
        message: `Failed to connect to ${config.apiBase} - ${fetchError?.message || 'Network error'}`,
      };
    }
  }

  console.log('[CloudAgent] Response status:', res.status);

  let raw: any;
  try {
    raw = await res.json();
    console.log('[CloudAgent] Response JSON (raw):', JSON.stringify(raw, null, 2));
  } catch (parseError: any) {
    console.error('[CloudAgent] Failed to parse response:', parseError);
    return {
      ok: false,
      errorCode: 'AGENT_ERROR',
      message: `Invalid response from server (status ${res.status})`,
    };
  }

  // Handle different response formats from F0 API
  // Format 1: { ok: true, result: { kind, messages, edits } }
  // Format 2: { ok: true, result: { text, diffs } }
  // Format 3: { ok: false, errorCode, message }

  if (raw.ok === false) {
    return {
      ok: false,
      errorCode: raw.errorCode || 'AGENT_ERROR',
      message: raw.message || 'Unknown error from server',
    };
  }

  // Debug: print the messages array specifically
  console.log('[CloudAgent] DEBUG messages array:', raw?.result?.messages);

  // Extract assistant message using robust extraction
  const assistantMessage = extractAssistantMessage(raw);
  console.log('[CloudAgent] Final assistantMessage:', assistantMessage.slice(0, 200));

  // Build normalized response
  const normalizedResult: DesktopIdeChatResponse = {
    kind: raw?.result?.kind || 'chat',
    messages: [assistantMessage],
    edits: raw?.result?.edits || raw?.result?.diffs || raw?.diffs || undefined,
    // Phase 112.2: Include runnerInsight if present
    runnerInsight: raw?.result?.runnerInsight,
    // Phase 112.3: Include autoFixActions if present
    autoFixActions: raw?.result?.autoFixActions,
  };

  // Phase 112.1: Extract commandIntent from raw response
  const commandIntent = raw?.commandIntent || raw?.result?.commandIntent;

  console.log('[CloudAgent] Normalized response:', {
    kind: normalizedResult.kind,
    messageLength: assistantMessage.length,
    hasEdits: !!normalizedResult.edits?.length,
    commandIntent: commandIntent ?? null,
    hasRunnerInsight: !!normalizedResult.runnerInsight,
    autoFixActionsCount: normalizedResult.autoFixActions?.length ?? 0, // Phase 112.3
  });

  return {
    ok: true,
    result: normalizedResult,
    commandIntent,
  };
}

/**
 * Send selection to Cloud Agent for refactoring
 */
export async function sendSelectionToCloudAgent(params: {
  apiBase: string;
  projectId: string;
  message: string;
  selection: SelectionContext;
  locale?: 'ar' | 'en';
  token?: string;
}): Promise<DesktopIdeChatResponse> {
  const { apiBase, projectId, message, selection, locale = 'en', token } = params;

  const config: CloudAgentConfig = {
    apiBase,
    projectId,
    apiKey: token,
  };

  const body: DesktopIdeChatRequest = {
    projectId,
    source: 'desktop-ide',
    mode: 'refactor',
    message,
    fileContext: selection,
    locale,
    clientVersion: '109.5.5',
  };

  console.log('[Cloud Agent] Sending refactor request:', {
    apiBase,
    projectId,
    filePath: selection.filePath,
    messageLength: message.length,
  });

  const response = await postToDesktopChat(config, body);

  if (!response.ok) {
    console.error('[Cloud Agent] Error:', response.errorCode, response.message);
    throw new Error(`[CloudAgent:${response.errorCode}] ${response.message}`);
  }

  console.log('[Cloud Agent] Response:', {
    kind: response.result.kind,
    messagesCount: response.result.messages?.length || 0,
    editsCount: response.result.edits?.length || 0,
  });

  return response.result;
}

// Phase 112.2: Extended response type for chat (includes commandIntent and runnerInsight)
export interface CloudChatResult extends DesktopIdeChatResponse {
  commandIntent?: CommandIntent;
  runnerInsight?: RunnerInsight;
}

/**
 * Send a simple chat message (no selection)
 * Phase 112.2: Now supports runnerContext for error analysis
 * Phase 168.3: Now supports image attachments for vision analysis
 * Phase 177: Now supports conversation history for chat memory
 */
export async function sendChatToCloudAgent(params: {
  apiBase: string;
  projectId: string;
  message: string;
  locale?: 'ar' | 'en';
  token?: string;
  filePath?: string;
  fileContent?: string;
  languageId?: string;
  runnerContext?: string; // Phase 112.2
  imageAttachments?: ImageAttachmentData[]; // Phase 168.3
  documentAttachments?: DocumentAttachmentData[]; // Phase 170.2: PDF/Word/Excel
  conversationHistory?: ChatHistoryMessage[]; // Phase 177: Chat memory
  projectIndex?: LocalProjectIndex; // Phase 187: Local project index
}): Promise<CloudChatResult> {
  const { apiBase, projectId, message, locale = 'en', token, filePath, fileContent, languageId, runnerContext, imageAttachments, documentAttachments, conversationHistory, projectIndex } = params;

  const config: CloudAgentConfig = {
    apiBase,
    projectId,
    apiKey: token,
  };

  const body: DesktopIdeChatRequest = {
    projectId,
    source: 'desktop-ide',
    mode: 'chat',
    message,
    locale,
    clientVersion: '170.2', // Phase 170.2: Document attachments
    runnerContext, // Phase 112.2
    imageAttachments, // Phase 168.3: Image attachments
    documentAttachments, // Phase 170.2: PDF/Word/Excel attachments
    conversationHistory, // Phase 177: Chat memory support
    projectIndex, // Phase 187: Local project index
    fileContext: filePath && fileContent ? {
      filePath,
      languageId: languageId || 'plaintext',
      fullText: fileContent,
      selectionStart: { line: 1, column: 1 },
      selectionEnd: { line: 1, column: 1 },
    } : undefined,
  };

  console.log('[Cloud Agent] Sending chat:', {
    apiBase,
    projectId,
    messageLength: message.length,
    hasRunnerContext: !!runnerContext,
    imageAttachmentsCount: imageAttachments?.length ?? 0, // Phase 168.3
    documentAttachmentsCount: documentAttachments?.length ?? 0, // Phase 170.2
    historyLength: conversationHistory?.length ?? 0, // Phase 177
    hasProjectIndex: !!projectIndex, // Phase 187
    projectFilesCount: projectIndex?.totalFiles ?? 0, // Phase 187
  });

  const response = await postToDesktopChat(config, body);

  if (!response.ok) {
    console.error('[Cloud Agent] Error:', response.errorCode, response.message);
    throw new Error(`[CloudAgent:${response.errorCode}] ${response.message}`);
  }

  // Phase 188: Log model meta for debugging (if available)
  if (response.result?.meta) {
    console.log('[CloudAgent][Debug] Model used:', {
      provider: response.result.meta.provider,
      model: response.result.meta.model,
      profile: response.result.meta.profile,
      latencyMs: response.result.meta.latencyMs,
      fallbackChain: response.result.meta.fallbackChain,
    });
  }

  // Phase 112.1: Include commandIntent if present
  return {
    ...response.result,
    commandIntent: response.commandIntent,
  };
}

/**
 * Phase 109.5.5: Test Cloud Agent connection
 * Used by Settings modal "Test Connection" button
 */
export async function testCloudAgentConnection(config: CloudAgentConfig): Promise<IdeDesktopChatApiResponse> {
  const body: DesktopIdeChatRequest = {
    projectId: config.projectId || 'test-project',
    source: 'desktop-ide',
    mode: 'chat',
    message: '__ping__',
    testOnly: true,
    clientVersion: '109.5.5',
  };

  console.log('[Cloud Agent] Testing connection:', {
    apiBase: config.apiBase,
    projectId: config.projectId,
    hasApiKey: !!config.apiKey,
  });

  try {
    const response = await postToDesktopChat(config, body);
    return response;
  } catch (err: any) {
    return {
      ok: false,
      errorCode: 'AGENT_ERROR',
      message: err?.message || 'Connection failed',
    };
  }
}

/**
 * Check if cloud agent is available (simple health check)
 */
export async function checkCloudAgentHealth(apiBase: string): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}
