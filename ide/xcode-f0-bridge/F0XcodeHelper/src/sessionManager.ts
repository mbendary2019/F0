/**
 * Session Manager for Xcode Helper
 * Phase 84.8.2: Manages IDE sessions
 */

import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { authManager } from './authManager';

const SESSION_PATH = path.join(process.cwd(), '.f0', 'session.json');
const BACKEND = process.env.F0_BACKEND_URL || 'http://localhost:3030';

export const sessionManager = {
  async ensureSession(): Promise<string> {
    // Check existing session
    if (fs.existsSync(SESSION_PATH)) {
      try {
        const data = fs.readFileSync(SESSION_PATH, 'utf-8');
        const { sessionId } = JSON.parse(data);
        if (sessionId) {
          return sessionId;
        }
      } catch {
        // Continue to create new session
      }
    }

    // Create new session
    const projectId = process.env.F0_PROJECT_ID || 'default';

    const res = await fetch(`${BACKEND}/api/ide/session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authManager.getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        clientKind: 'cursor-like', // Xcode uses same protocol
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to create session: ${res.status}`);
    }

    const json = await res.json();
    const sessionId = json.id;

    // Save session
    const dir = path.dirname(SESSION_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(SESSION_PATH, JSON.stringify({ sessionId }, null, 2));

    return sessionId;
  },
};
