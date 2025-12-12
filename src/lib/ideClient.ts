/**
 * Phase 84.9.1: IDE Client for Web IDE
 * Connects Web IDE to IDE Bridge Protocol APIs
 */

interface IdeSessionResponse {
  sessionId: string;
  projectId: string;
  clientKind: string;
}

interface IdeChatRequest {
  sessionId: string;
  projectId: string;
  message: string;
  fileContext?: {
    filePath: string;
    content: string;
    selection?: string;
    languageId: string;
  };
  workspaceContext?: {
    projectId: string;
    sessionId: string;
    openedFiles: Array<{ path: string; languageId: string }>;
    currentFile?: { path: string; languageId: string };
    changedFiles?: Array<{ path: string; status: string }>;
    packageJson?: any;
    timestamp: number;
  };
  locale?: string;
}

interface IdeChatResponse {
  replyText: string;
  patchSuggestion?: {
    patches: any[];
    summary: string;
  };
}

/**
 * Create a new IDE session
 */
export async function createIdeSession(args?: {
  projectId?: string;
  clientKind?: string;
}): Promise<string> {
  const { projectId = 'web-ide-default', clientKind = 'web-ide' } = args || {};

  try {
    const res = await fetch('/api/ide/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        clientKind
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to create IDE session: ${res.status} ${errorText}`);
    }

    const data: IdeSessionResponse = await res.json();
    return data.sessionId;
  } catch (error: any) {
    console.error('Error creating IDE session:', error);
    throw error;
  }
}

/**
 * Send a chat message to the AI with file and workspace context
 */
export async function sendIdeChat(payload: IdeChatRequest): Promise<IdeChatResponse> {
  try {
    const fullPayload = {
      ...payload,
      locale: payload.locale || 'en',
      projectId: payload.projectId || 'web-ide-default'
    };

    const res = await fetch('/api/ide/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullPayload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to send IDE chat: ${res.status} ${errorText}`);
    }

    const data: IdeChatResponse = await res.json();
    return data;
  } catch (error: any) {
    console.error('Error sending IDE chat:', error);
    throw error;
  }
}

/**
 * Upload workspace context to the backend
 */
export async function uploadWorkspaceContext(context: {
  projectId: string;
  sessionId: string;
  openedFiles: Array<{ path: string; languageId?: string }>;
  currentFile?: { path: string; languageId?: string };
  changedFiles?: Array<{ path: string; status: string }>;
  packageJson?: any;
}): Promise<void> {
  try {
    const res = await fetch('/api/ide/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...context,
        timestamp: Date.now()
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to upload context: ${res.status} ${errorText}`);
    }
  } catch (error: any) {
    console.error('Error uploading workspace context:', error);
    throw error;
  }
}
