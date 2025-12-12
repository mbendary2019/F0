/**
 * F0 API Client for Xcode Helper
 * Phase 84.8.2: Communicates with F0 backend
 */

import fetch from 'node-fetch';
import { authManager } from './authManager';
import { sessionManager } from './sessionManager';

const BACKEND = process.env.F0_BACKEND_URL || 'http://localhost:3030';

export const f0Client = {
  async chat(
    message: string,
    fileContext: any,
    workspaceContext: any
  ): Promise<any> {
    const sessionId = await sessionManager.ensureSession();
    const projectId = process.env.F0_PROJECT_ID || 'default';

    const payload = {
      message,
      sessionId,
      projectId,
      fileContext,
      workspaceContext,
      locale: 'en',
    };

    const res = await fetch(`${BACKEND}/api/ide/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authManager.getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API error: ${res.status} ${errorText}`);
    }

    return res.json();
  },
};
