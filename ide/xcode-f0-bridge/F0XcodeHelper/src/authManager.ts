/**
 * Authentication Manager for Xcode Helper
 * Phase 84.8.2: Handles OAuth and token storage
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createServer } from 'http';
import open from 'open';

const CONFIG_PATH = path.join(
  os.homedir(),
  'Library/Application Support/F0/f0-config.json'
);

export interface AuthToken {
  accessToken: string;
  expiresAt?: number;
}

export const authManager = {
  isLoggedIn(): boolean {
    if (!fs.existsSync(CONFIG_PATH)) {
      return false;
    }

    try {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      const config = JSON.parse(data);

      if (!config.token || !config.token.accessToken) {
        return false;
      }

      // Check token expiry
      if (config.token.expiresAt && Date.now() >= config.token.expiresAt) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  },

  getToken(): string {
    const data = fs.readFileSync(CONFIG_PATH, 'utf8');
    const config = JSON.parse(data);
    return config.token.accessToken;
  },

  async login(): Promise<void> {
    const port = 14142;
    const callbackUrl = `http://localhost:${port}/callback`;
    const apiBase = process.env.F0_BACKEND_URL || 'http://localhost:3030';

    const oauthUrl = `${apiBase}/auth/callback?redirect=${encodeURIComponent(callbackUrl)}&client=xcode`;

    console.log(`Opening browser for authentication...`);
    console.log(`URL: ${oauthUrl}`);

    await open(oauthUrl);

    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        if (!req.url?.startsWith('/callback')) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }

        try {
          const url = new URL(req.url, `http://localhost:${port}`);
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
            reject(new Error('No token received'));
            return;
          }

          // Success!
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body>
                <h1>Authentication Successful!</h1>
                <p>You can close this window and return to Xcode.</p>
                <script>setTimeout(() => window.close(), 2000);</script>
              </body>
            </html>
          `);

          // Store token
          const authToken: AuthToken = {
            accessToken: token,
            expiresAt: Date.now() + 3600 * 1000, // 1 hour
          };

          const configDir = path.dirname(CONFIG_PATH);
          if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
          }

          fs.writeFileSync(CONFIG_PATH, JSON.stringify({ token: authToken }, null, 2));

          console.log('✓ Authentication successful!');
          console.log(`Token saved to: ${CONFIG_PATH}`);

          server.close();
          resolve();
        } catch (err: any) {
          res.writeHead(500);
          res.end('Internal Server Error');
          server.close();
          reject(err);
        }
      });

      server.listen(port, () => {
        console.log(`Waiting for OAuth callback on port ${port}...`);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('Authentication timeout - no callback received'));
      }, 5 * 60 * 1000);
    });
  },

  logout(): void {
    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
      console.log('✓ Logged out successfully');
    }
  },
};
