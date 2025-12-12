// src/services/apiClient.ts
import * as vscode from 'vscode';
import { IdeEventEnvelope, IdeCommandEnvelope } from '../types/ideBridge';

/**
 * Get API base URL from configuration
 */
function getApiBase(): string {
  const config = vscode.workspace.getConfiguration('f0');
  return config.get<string>('apiBase') || 'http://localhost:3030';
}

/**
 * Get authentication token
 * Phase 87: Reuse Phase 84 OAuth token mechanism
 */
async function getAuthToken(): Promise<string> {
  // TODO: Integrate with AuthManager from Phase 84
  // For now, return empty string - will be updated in integration step
  const config = vscode.workspace.getConfiguration('f0');
  return config.get<string>('apiKey') || '';
}

/**
 * Send IDE event to Cloud Functions
 */
export async function sendIdeEvent(event: IdeEventEnvelope): Promise<void> {
  const base = getApiBase();
  const url = `${base}/ideIngestEvent`;
  const token = await getAuthToken();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to send IDE event: ${res.status} ${errorText}`);
  }
}

export interface GetCommandsResponse {
  commands: IdeCommandEnvelope[];
}

/**
 * Poll for IDE commands from Cloud Functions
 */
export async function pollIdeCommands(
  sessionId: string,
  projectId: string,
  since?: string
): Promise<GetCommandsResponse> {
  const base = getApiBase();
  const params = new URLSearchParams({
    sessionId,
    projectId,
  });
  if (since) {
    params.set('since', since);
  }

  const url = `${base}/ideGetCommands?${params}`;
  const token = await getAuthToken();

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to poll commands: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  return data as GetCommandsResponse;
}
