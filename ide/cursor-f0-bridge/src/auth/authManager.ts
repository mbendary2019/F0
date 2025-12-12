/**
 * Authentication Manager for Cursor Bridge CLI
 * Phase 84.8: Handles OAuth flow and token storage for CLI
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import fetch from 'node-fetch';
import { createServer, IncomingMessage, ServerResponse } from 'http';

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface AuthConfig {
  apiBase: string;
  token?: AuthToken;
}

/**
 * CLI Authentication Manager
 * Handles OAuth flow using local HTTP server for callback
 */
export class AuthManager {
  private configPath: string;
  private config: AuthConfig | null = null;

  constructor(apiBase: string = 'http://localhost:3030') {
    // Store config in ~/.f0/config.json
    const configDir = path.join(os.homedir(), '.f0');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    this.configPath = path.join(configDir, 'config.json');
    this.loadConfig(apiBase);
  }

  /**
   * Load configuration from disk
   */
  private loadConfig(apiBase: string): void {
    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf8');
        this.config = JSON.parse(content);
        console.log('[AuthManager] Loaded config from', this.configPath);
      } catch (err) {
        console.warn('[AuthManager] Failed to parse config, creating new one');
        this.config = { apiBase };
      }
    } else {
      this.config = { apiBase };
    }
  }

  /**
   * Save configuration to disk
   */
  private saveConfig(): void {
    if (!this.config) return;
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
    console.log('[AuthManager] Saved config to', this.configPath);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (!this.config?.token?.accessToken) return false;

    // Check token expiration if available
    if (this.config.token.expiresAt) {
      const now = Date.now();
      if (now >= this.config.token.expiresAt) {
        console.log('[AuthManager] Token expired');
        return false;
      }
    }

    return true;
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    if (!this.isAuthenticated()) return null;
    return this.config?.token?.accessToken || null;
  }

  /**
   * Start OAuth flow
   * Opens browser and waits for callback
   */
  async login(): Promise<AuthToken> {
    console.log('[AuthManager] Starting OAuth flow...');

    const callbackPort = 8765;
    const callbackUrl = `http://localhost:${callbackPort}/callback`;
    const apiBase = this.config?.apiBase || 'http://localhost:3030';

    // Build OAuth URL
    const oauthUrl = `${apiBase}/auth/callback?redirect=${encodeURIComponent(callbackUrl)}&client=cli`;

    return new Promise((resolve, reject) => {
      const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        if (!req.url?.startsWith('/callback')) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }

        try {
          // Parse query parameters
          const url = new URL(req.url, `http://localhost:${callbackPort}`);
          const token = url.searchParams.get('token');
          const error = url.searchParams.get('error');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body>
                  <h1>Authentication Failed</h1>
                  <p>Error: ${error}</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            server.close();
            reject(new Error(`OAuth failed: ${error}`));
            return;
          }

          if (!token) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body>
                  <h1>Authentication Failed</h1>
                  <p>No token received</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            server.close();
            reject(new Error('No token received from OAuth'));
            return;
          }

          // Success!
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body>
                <h1>Authentication Successful!</h1>
                <p>You can close this window and return to your terminal.</p>
                <script>setTimeout(() => window.close(), 2000);</script>
              </body>
            </html>
          `);

          // Store token
          const authToken: AuthToken = {
            accessToken: token,
            expiresAt: Date.now() + 3600 * 1000, // 1 hour
          };

          if (this.config) {
            this.config.token = authToken;
            this.saveConfig();
          }

          server.close();
          resolve(authToken);
        } catch (err: any) {
          res.writeHead(500);
          res.end('Internal Server Error');
          server.close();
          reject(err);
        }
      });

      server.listen(callbackPort, () => {
        console.log(`[AuthManager] Callback server listening on port ${callbackPort}`);
        console.log(`[AuthManager] Opening browser to: ${oauthUrl}`);

        // Open browser (using 'open' package)
        const open = require('open');
        open(oauthUrl).catch((err: any) => {
          console.error('[AuthManager] Failed to open browser:', err);
          console.log('[AuthManager] Please manually open:', oauthUrl);
        });
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('OAuth timeout - no callback received within 5 minutes'));
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Logout (clear stored token)
   */
  logout(): void {
    if (this.config) {
      this.config.token = undefined;
      this.saveConfig();
      console.log('[AuthManager] Logged out successfully');
    }
  }

  /**
   * Ensure user is authenticated (prompt login if needed)
   */
  async ensureAuthenticated(): Promise<AuthToken> {
    if (this.isAuthenticated() && this.config?.token) {
      return this.config.token;
    }

    console.log('[AuthManager] Not authenticated. Starting login flow...');
    return this.login();
  }

  /**
   * Get API base URL
   */
  getApiBase(): string {
    return this.config?.apiBase || 'http://localhost:3030';
  }

  /**
   * Set API base URL
   */
  setApiBase(apiBase: string): void {
    if (this.config) {
      this.config.apiBase = apiBase;
      this.saveConfig();
    }
  }
}
