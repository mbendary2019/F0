// desktop/src/f0/apiClient.ts
export type AgentMode = 'local' | 'cloud';

export type F0DesktopSettings = {
  backendUrl: string;
  apiKey: string;
  projectId?: string;
  // Phase 109.5.4: Cloud Agent mode
  agentMode?: AgentMode;
  cloudApiBase?: string; // e.g. "http://localhost:3030" or production URL
  // Phase 109.5.5: Cloud Auth Token (F0_DESKTOP_API_KEY)
  cloudAuthToken?: string;
  // Phase 110: Locale for Cloud Agent responses
  locale?: 'ar' | 'en';
};

export type F0ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type F0StreamDelta = {
  content?: string;
  role?: string;
  done?: boolean;
};

export async function sendChatCompletion(
  settings: F0DesktopSettings,
  messages: F0ChatMessage[],
  fzContext?: any
): Promise<string> {
  const backendUrl = settings.backendUrl.replace(/\/+$/, ''); // remove trailing /
  const url = `${backendUrl}/chat/completions`;

  const body: any = {
    model: 'f0-code-agent',
    stream: false,
    ideType: 'desktop',
    projectId: settings.projectId || 'desktop-project',
    messages,
  };

  if (fzContext) {
    body.fz_context = fzContext;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `F0 API error (${res.status}): ${text || res.statusText || 'Unknown error'}`
    );
  }

  const json = await res.json();
  const content =
    json?.choices?.[0]?.message?.content ??
    'No content returned from F0 Code Agent.';
  return String(content);
}

/**
 * Phase 109.3: Streaming chat completion using Server-Sent Events (SSE)
 * Phase 109.4.2: Added fzContext parameter for context-aware agent
 */
export async function streamChatCompletion(
  settings: F0DesktopSettings,
  messages: F0ChatMessage[],
  onDelta: (delta: F0StreamDelta) => void,
  signal?: AbortSignal,
  fzContext?: any
): Promise<void> {
  const backendUrl = settings.backendUrl.replace(/\/+$/, '');
  const url = `${backendUrl}/chat/completions`;

  const body: any = {
    model: 'f0-code-agent',
    stream: true,
    ideType: 'desktop',
    projectId: settings.projectId || 'desktop-project',
    messages,
  };

  if (fzContext) {
    body.fz_context = fzContext;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `F0 API error (${res.status}): ${text || res.statusText || 'Unknown error'}`
    );
  }

  if (!res.body) {
    throw new Error('No response body for streaming');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue; // Skip empty or comment lines

        if (trimmed === 'data: [DONE]') {
          onDelta({ done: true });
          return;
        }

        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6); // Remove "data: " prefix
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed?.choices?.[0]?.delta?.content;
            if (content) {
              onDelta({ content });
            }
          } catch (e) {
            console.warn('[streamChatCompletion] Failed to parse SSE chunk:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
