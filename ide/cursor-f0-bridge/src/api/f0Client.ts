/**
 * F0 API Client for Cursor Bridge CLI
 * Phase 84.8: Communicates with F0 backend using IDE protocol
 */

import fetch from 'node-fetch';
import { AuthManager } from '../auth/authManager';
import {
  IdeSession,
  IdeChatRequest,
  IdeChatResponse,
  IdeFileContext,
  IdeWorkspaceContext,
  IdeSessionRequest,
} from './types';

/**
 * F0 API Client for CLI
 */
export class F0Client {
  constructor(private authManager: AuthManager) {}

  /**
   * Get API base URL
   */
  private getApiBase(): string {
    return this.authManager.getApiBase();
  }

  /**
   * Build headers for API requests
   */
  private async buildHeaders(): Promise<Record<string, string>> {
    const token = await this.authManager.ensureAuthenticated();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token.accessToken}`,
    };
  }

  /**
   * Create a new IDE session
   */
  async createSession(projectId: string): Promise<IdeSession> {
    const apiBase = this.getApiBase();
    const headers = await this.buildHeaders();

    const body: IdeSessionRequest = {
      projectId,
      clientKind: 'cursor-like',
    };

    const res = await fetch(`${apiBase}/api/ide/session`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to create session: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    return data as IdeSession;
  }

  /**
   * Send chat message to F0 agent
   */
  async sendChat(payload: {
    sessionId: string;
    projectId: string;
    message: string;
    locale?: string;
    fileContext?: IdeFileContext;
    workspaceContext?: IdeWorkspaceContext;
  }): Promise<IdeChatResponse> {
    const apiBase = this.getApiBase();
    const headers = await this.buildHeaders();

    const body: IdeChatRequest = {
      sessionId: payload.sessionId,
      projectId: payload.projectId,
      message: payload.message,
      locale: payload.locale || 'en',
      fileContext: payload.fileContext,
      workspaceContext: payload.workspaceContext,
    };

    const res = await fetch(`${apiBase}/api/ide/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to send chat: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    return data as IdeChatResponse;
  }

  /**
   * Upload workspace context to backend
   */
  async uploadContext(workspaceContext: IdeWorkspaceContext): Promise<void> {
    const apiBase = this.getApiBase();
    const headers = await this.buildHeaders();

    const res = await fetch(`${apiBase}/api/ide/context`, {
      method: 'POST',
      headers,
      body: JSON.stringify(workspaceContext),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to upload context: ${res.status} ${errorText}`);
    }
  }

  /**
   * Get workspace context from backend
   */
  async getContext(projectId: string, sessionId: string): Promise<IdeWorkspaceContext | null> {
    const apiBase = this.getApiBase();
    const headers = await this.buildHeaders();

    const res = await fetch(
      `${apiBase}/api/ide/context?projectId=${projectId}&sessionId=${sessionId}`,
      {
        method: 'GET',
        headers,
      }
    );

    if (!res.ok) {
      if (res.status === 404) {
        return null; // No context found
      }
      const errorText = await res.text();
      throw new Error(`Failed to get context: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    return data as IdeWorkspaceContext;
  }
}
