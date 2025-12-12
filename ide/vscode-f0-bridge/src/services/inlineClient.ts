// src/services/inlineClient.ts
import * as vscode from 'vscode';
import {
  InlineSuggestionRequest,
  InlineSuggestionResponse,
} from '../types/inlineSuggestions';

function getApiBase(): string {
  const config = vscode.workspace.getConfiguration('f0');
  const base = config.get<string>('apiBase');
  if (!base) {
    throw new Error(
      'F0: apiBase is not configured. Set "f0.apiBase" in settings.'
    );
  }
  return base.replace(/\/+$/, '');
}

// TODO: Integrate with Phase 84 OAuth token mechanism
async function getAuthToken(): Promise<string | undefined> {
  // For now, return undefined
  // Will be integrated with AuthManager in future phase
  return undefined;
}

/**
 * Request inline code suggestion from F0 Agent
 */
export async function requestInlineSuggestion(
  payload: InlineSuggestionRequest
): Promise<InlineSuggestionResponse | null> {
  try {
    const base = getApiBase();
    const url = `${base}/api/ide/inline-suggest`;
    const token = await getAuthToken();

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('[F0 Inline Suggest] Failed:', res.status, txt);
      return null;
    }

    return (await res.json()) as InlineSuggestionResponse;
  } catch (err) {
    console.error('[F0 Inline Suggest] Error:', err);
    return null;
  }
}
