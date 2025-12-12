/**
 * F0 API Client for VS Code Extension
 * Phase 84.4: Refactored to use AuthManager
 * Phase 84.7: Added workspace context support
 */

import {
  IdeSession,
  IdeChatRequest,
  IdeChatResponse,
  IdeFileContext,
  IdeWorkspaceContext,
} from './types';
import { AuthManager } from '../auth/authManager';
import { getProjectBinding } from '../config/projectBinding';

/**
 * F0 API Client - manages communication with F0 backend
 */
export class F0Client {
  constructor(private authManager: AuthManager) {}

  /**
   * Get current configuration (project binding + auth token)
   */
  private async getConfig() {
    const binding = getProjectBinding();
    if (!binding) {
      throw new Error('No F0 project linked. Please run "F0: Link Project" first.');
    }

    const token = await this.authManager.ensureSignedIn();

    return {
      apiBase: binding.apiBase,
      projectId: binding.projectId,
      accessToken: token.accessToken,
    };
  }

  /**
   * Build headers for API requests
   */
  private buildHeaders(accessToken: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };
  }

  /**
   * Create a new IDE session
   */
  async createIdeSession(): Promise<IdeSession> {
    const { apiBase, projectId, accessToken } = await this.getConfig();

    const res = await fetch(`${apiBase}/api/ide/session`, {
      method: 'POST',
      headers: this.buildHeaders(accessToken),
      body: JSON.stringify({
        projectId,
        clientKind: 'vscode',
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to create IDE session: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    return data as IdeSession;
  }

  /**
   * Send chat message to F0 agent
   * Phase 84.7: Added workspace context support
   */
  async sendIdeChat(payload: {
    sessionId: string;
    message: string;
    locale?: string;
    fileContext?: IdeFileContext;
    workspaceContext?: IdeWorkspaceContext;
  }): Promise<IdeChatResponse> {
    const { apiBase, projectId, accessToken } = await this.getConfig();

    const requestBody: IdeChatRequest = {
      sessionId: payload.sessionId,
      projectId,
      message: payload.message,
      locale: payload.locale,
      fileContext: payload.fileContext,
      workspaceContext: payload.workspaceContext,
    };

    const res = await fetch(`${apiBase}/api/ide/chat`, {
      method: 'POST',
      headers: this.buildHeaders(accessToken),
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to send chat message: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    return data as IdeChatResponse;
  }

  /**
   * Fix selected code - helper function
   */
  async sendFixSelectedCode(
    sessionId: string,
    message: string,
    fileContext: IdeFileContext,
    locale?: string
  ): Promise<IdeChatResponse> {
    return this.sendIdeChat({
      sessionId,
      message,
      fileContext,
      locale,
    });
  }

  /**
   * Validate project ownership
   * Phase 84.6: Verify user owns the project
   */
  async validateProject(projectId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const binding = getProjectBinding();
      if (!binding) {
        return { ok: false, error: 'NO_BINDING' };
      }

      const token = await this.authManager.ensureSignedIn();

      const res = await fetch(`${binding.apiBase}/api/ide/project/validate`, {
        method: 'POST',
        headers: this.buildHeaders(token.accessToken),
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          return { ok: false, error: 'UNAUTHORIZED' };
        }
        if (res.status === 403) {
          return { ok: false, error: 'NOT_OWNER' };
        }
        if (res.status === 404) {
          return { ok: false, error: 'PROJECT_NOT_FOUND' };
        }
        return { ok: false, error: 'UNKNOWN_ERROR' };
      }

      const data = await res.json();
      return data as { ok: boolean; error?: string };
    } catch (err) {
      console.error('validateProject error:', err);
      return { ok: false, error: 'NETWORK_ERROR' };
    }
  }
}
