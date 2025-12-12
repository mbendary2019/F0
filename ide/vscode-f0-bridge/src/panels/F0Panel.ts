/**
 * F0Panel - Webview Panel for F0 Assistant
 * Phase 84.4: Onboarding UI + AuthManager Integration
 */

import * as vscode from 'vscode';
import { F0Client } from '../api/f0Client';
import { IdeSession } from '../api/types';
import { applyUnifiedDiffToWorkspace } from '../patch/applyUnifiedDiffToWorkspace';
import { AuthManager } from '../auth/authManager';
import { getProjectBinding } from '../config/projectBinding';

enum PanelState {
  LOADING = 'loading',
  NO_PROJECT = 'no_project',
  NO_AUTH = 'no_auth',
  READY = 'ready',
  ERROR = 'error',
}

export class F0Panel {
  public static currentPanel: F0Panel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _authManager: AuthManager;
  private readonly _client: F0Client;
  private _disposables: vscode.Disposable[] = [];
  private _session: IdeSession | null = null;
  private _state: PanelState = PanelState.LOADING;

  public static createOrShow(extensionContext: vscode.ExtensionContext, authManager: AuthManager) {
    const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

    // If panel already exists, reveal it
    if (F0Panel.currentPanel) {
      F0Panel.currentPanel._panel.reveal(column);
      return;
    }

    // Create new webview panel
    const panel = vscode.window.createWebviewPanel(
      'f0Assistant',
      'F0 Assistant',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    F0Panel.currentPanel = new F0Panel(panel, extensionContext.extensionUri, authManager);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, authManager: AuthManager) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._authManager = authManager;
    this._client = new F0Client(authManager);

    // Set HTML content
    this._panel.webview.html = this._getHtmlForWebview();

    // Initialize panel (check binding and auth)
    this._initializePanel();

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'ping':
            // Test connection
            this._panel.webview.postMessage({
              type: 'pong',
              payload: 'F0 extension is alive ✅'
            });
            return;

          case 'linkProject':
            // User clicked "Link Project" in onboarding UI
            await vscode.commands.executeCommand('f0.linkProject');
            // Re-check state after linking
            await this._initializePanel();
            return;

          case 'signIn':
            // User clicked "Sign In" in onboarding UI
            // Phase 84.5: Start OAuth flow directly
            try {
              const binding = getProjectBinding();
              if (!binding) {
                this._panel.webview.postMessage({
                  type: 'error',
                  payload: 'No project linked. Please link a project first.',
                });
                return;
              }

              // Start OAuth flow
              await this._authManager.startOAuthLogin(binding.apiBase);

              this._panel.webview.postMessage({
                type: 'system',
                payload: '🔐 Opening F0 login in your browser...',
              });
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              this._panel.webview.postMessage({
                type: 'error',
                payload: `Authentication failed: ${errorMsg}`,
              });
            }
            return;

          case 'chat':
            await this._handleChatMessage(message.payload.text);
            return;

          case 'applyPatch':
            await this._handleApplyPatch(message.payload.patchText);
            return;

          default:
            console.warn('Unknown message from webview', message);
        }
      },
      null,
      this._disposables
    );

    // Handle panel disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  /**
   * Initialize panel - check binding, auth, then create session
   * Phase 84.4: State-based initialization with onboarding flow
   */
  private async _initializePanel() {
    // Check 1: Project binding
    const binding = getProjectBinding();
    if (!binding) {
      this._state = PanelState.NO_PROJECT;
      this._panel.webview.postMessage({
        type: 'setState',
        state: this._state
      });
      return;
    }

    // Check 2: Auth token
    const token = await this._authManager.getToken();
    if (!token) {
      this._state = PanelState.NO_AUTH;
      this._panel.webview.postMessage({
        type: 'setState',
        state: this._state
      });
      return;
    }

    // All checks passed - create session
    await this._initializeSession();
  }

  /**
   * Initialize IDE session with F0 backend
   */
  private async _initializeSession() {
    try {
      const binding = getProjectBinding();
      if (!binding) {
        throw new Error('No project binding');
      }

      this._session = await this._client.createIdeSession();

      this._state = PanelState.READY;
      this._panel.webview.postMessage({
        type: 'setState',
        state: this._state,
      });

      this._panel.webview.postMessage({
        type: 'system',
        payload: `✅ Connected to F0 project: ${binding.projectId}`
      });

      console.log('F0 IDE Session created:', this._session.id);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this._state = PanelState.ERROR;
      this._panel.webview.postMessage({
        type: 'setState',
        state: this._state,
      });
      this._panel.webview.postMessage({
        type: 'system',
        payload: `❌ Failed to connect: ${errorMsg}`
      });
      console.error('Failed to create IDE session:', error);
    }
  }

  /**
   * Handle chat message from user
   */
  private async _handleChatMessage(text: string) {
    if (!this._session) {
      this._panel.webview.postMessage({
        type: 'chat-reply',
        payload: {
          replyText: 'Session not initialized. Please check your configuration.',
          hasPatch: false,
        }
      });
      return;
    }

    try {
      // Get file context if there's an active editor
      const editor = vscode.window.activeTextEditor;
      let fileContext = undefined;

      if (editor) {
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);

        if (selectedText) {
          fileContext = {
            filePath: vscode.workspace.asRelativePath(editor.document.uri),
            content: selectedText,
            languageId: editor.document.languageId,
            selection: {
              startLine: selection.start.line,
              startCol: selection.start.character,
              endLine: selection.end.line,
              endCol: selection.end.character,
            }
          };
        }
      }

      // Send to F0 API using F0Client
      const response = await this._client.sendIdeChat({
        sessionId: this._session.id,
        message: text,
        fileContext,
      });

      // Send response to webview
      this._panel.webview.postMessage({
        type: 'chat-reply',
        payload: {
          replyText: response.replyText,
          hasPatch: response.patchSuggestion?.hasPatch || false,
          patchText: response.patchSuggestion?.patchText,
          taskKind: response.taskKind,
        }
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this._panel.webview.postMessage({
        type: 'chat-reply',
        payload: {
          replyText: `Error: ${errorMsg}`,
          hasPatch: false,
        }
      });
      console.error('Chat error:', error);
    }
  }

  /**
   * Apply patch to workspace files
   */
  private async _handleApplyPatch(patchText: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    try {
      await applyUnifiedDiffToWorkspace(patchText, workspaceFolder);

      this._panel.webview.postMessage({
        type: 'system',
        payload: '✅ Patch applied successfully!'
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this._panel.webview.postMessage({
        type: 'system',
        payload: `❌ Failed to apply patch: ${errorMsg}`
      });
      console.error('Patch application error:', error);
    }
  }

  public dispose() {
    F0Panel.currentPanel = undefined;

    // Clean up resources
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      d?.dispose();
    }
  }

  private _getHtmlForWebview(): string {
    const nonce = getNonce();

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>F0 Assistant</title>
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: 0;
            margin: 0;
            background: #0b0b10;
            color: #f5f5f5;
            height: 100vh;
            overflow: hidden;
          }
          .root {
            display: flex;
            flex-direction: column;
            height: 100vh;
            gap: 0;
          }
          .header {
            font-size: 13px;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: linear-gradient(135deg, #1e1b4b, #312e81);
            border-bottom: 1px solid #4f46e5;
          }
          .badge {
            font-size: 10px;
            padding: 3px 8px;
            border-radius: 999px;
            background: rgba(99, 102, 241, 0.2);
            border: 1px solid #6366f1;
            color: #c7d2fe;
          }
          .messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            background: #0b0b10;
          }
          .msg {
            padding: 10px 12px;
            border-radius: 8px;
            margin-bottom: 12px;
            font-size: 13px;
            line-height: 1.5;
            max-width: 85%;
            word-wrap: break-word;
          }
          .msg.user {
            background: linear-gradient(135deg, #1d4ed8, #2563eb);
            margin-left: auto;
            text-align: left;
          }
          .msg.agent {
            background: #1f2937;
            border: 1px solid #374151;
            margin-right: auto;
          }
          .msg.system {
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.3);
            font-size: 11px;
            text-align: center;
            max-width: 100%;
            color: #93c5fd;
          }
          .inputContainer {
            padding: 12px 16px;
            background: #111827;
            border-top: 1px solid #1f2937;
          }
          .inputRow {
            display: flex;
            gap: 8px;
          }
          textarea {
            flex: 1;
            resize: none;
            font-size: 13px;
            border-radius: 8px;
            border: 1px solid #374151;
            padding: 10px 12px;
            background: #020617;
            color: #f9fafb;
            font-family: inherit;
          }
          textarea:focus {
            outline: none;
            border-color: #4f46e5;
          }
          button {
            border-radius: 8px;
            border: none;
            background: linear-gradient(135deg, #4f46e5, #7c3aed);
            color: white;
            font-size: 13px;
            padding: 10px 16px;
            cursor: pointer;
            font-weight: 500;
            transition: opacity 0.2s;
          }
          button:hover {
            opacity: 0.9;
          }
          button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          button:active {
            transform: translateY(1px);
          }
          .typing {
            display: none;
            padding: 8px 12px;
            font-size: 12px;
            color: #9ca3af;
            font-style: italic;
          }
          .typing.active {
            display: block;
          }
          .onboarding {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            padding: 32px;
            text-align: center;
          }
          .onboarding h2 {
            font-size: 20px;
            font-weight: 600;
            margin: 0;
            color: #f9fafb;
          }
          .onboarding p {
            font-size: 14px;
            color: #9ca3af;
            margin: 0;
            max-width: 400px;
          }
        </style>
      </head>
      <body>
        <div class="root">
          <div class="header">
            <span>F0 Assistant — IDE Bridge</span>
            <span class="badge">Live (Prototype)</span>
          </div>

          <!-- Onboarding: No Project -->
          <div id="onboarding-no-project" class="onboarding" style="display:none;">
            <h2>Welcome to F0!</h2>
            <p>Link this workspace to an F0 project to get started.</p>
            <button onclick="linkProject()">Link Project</button>
          </div>

          <!-- Onboarding: No Auth -->
          <div id="onboarding-no-auth" class="onboarding" style="display:none;">
            <h2>Sign in to F0</h2>
            <p>Authentication required to connect to F0 backend.</p>
            <button onclick="signIn()">Sign In</button>
          </div>

          <!-- Chat Interface (only shown when ready) -->
          <div id="chat-interface" style="display:none; flex: 1; display: flex; flex-direction: column;">
            <div id="messages" class="messages"></div>
            <div class="typing" id="typing">F0 is thinking...</div>
            <div class="inputContainer">
              <div class="inputRow">
                <textarea
                  id="input"
                  rows="2"
                  placeholder="Ask F0 about your code..."
                  onkeydown="handleKeyPress(event)"
                ></textarea>
                <button id="sendBtn">Send</button>
              </div>
            </div>
          </div>
        </div>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();

          const messagesEl = document.getElementById('messages');
          const inputEl = document.getElementById('input');
          const sendBtn = document.getElementById('sendBtn');
          const typingEl = document.getElementById('typing');

          // State management
          function setState(state) {
            // Hide all screens
            document.getElementById('onboarding-no-project').style.display = 'none';
            document.getElementById('onboarding-no-auth').style.display = 'none';
            document.getElementById('chat-interface').style.display = 'none';

            // Show appropriate screen
            switch (state) {
              case 'no_project':
                document.getElementById('onboarding-no-project').style.display = 'flex';
                break;
              case 'no_auth':
                document.getElementById('onboarding-no-auth').style.display = 'flex';
                break;
              case 'ready':
                document.getElementById('chat-interface').style.display = 'flex';
                break;
            }
          }

          // Onboarding actions
          function linkProject() {
            vscode.postMessage({ type: 'linkProject' });
          }

          function signIn() {
            vscode.postMessage({ type: 'signIn' });
          }

          // Make functions globally accessible
          window.linkProject = linkProject;
          window.signIn = signIn;

          function addMessage(text, role) {
            const el = document.createElement('div');
            el.className = 'msg ' + role;
            el.textContent = text;
            messagesEl.appendChild(el);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }

          function setTyping(isTyping) {
            if (isTyping) {
              typingEl.classList.add('active');
            } else {
              typingEl.classList.remove('active');
            }
          }

          function sendMessage() {
            const text = inputEl.value.trim();
            if (!text) return;

            addMessage(text, 'user');
            inputEl.value = '';
            setTyping(true);

            vscode.postMessage({
              type: 'chat',
              payload: { text }
            });
          }

          function handleKeyPress(event) {
            // Cmd/Ctrl + Enter to send
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              sendMessage();
            }
          }

          sendBtn.addEventListener('click', sendMessage);

          // Store current patch
          let currentPatch = null;

          function applyCurrentPatch() {
            if (currentPatch) {
              vscode.postMessage({
                type: 'applyPatch',
                payload: { patchText: currentPatch }
              });
              currentPatch = null;
            }
          }

          // Handle messages from extension
          window.addEventListener('message', event => {
            const message = event.data;
            setTyping(false);

            switch (message.type) {
              case 'setState':
                setState(message.state);
                break;
              case 'chat-reply':
                addMessage(message.payload.replyText, 'agent');
                if (message.payload.hasPatch && message.payload.patchText) {
                  currentPatch = message.payload.patchText;

                  // Add patch preview with apply button
                  const patchEl = document.createElement('div');
                  patchEl.className = 'msg system';
                  patchEl.innerHTML = \`
                    ✅ Patch available
                    <button onclick="applyCurrentPatch()" style="margin-left: 8px; padding: 4px 8px; font-size: 11px;">
                      Apply Patch
                    </button>
                  \`;
                  messagesEl.appendChild(patchEl);
                  messagesEl.scrollTop = messagesEl.scrollHeight;
                }
                break;
              case 'error':
                addMessage(message.payload, 'system');
                break;
              case 'pong':
                addMessage(message.payload, 'system');
                break;
              case 'system':
                addMessage(message.payload, 'system');
                break;
            }
          });

          // Make applyCurrentPatch globally accessible
          window.applyCurrentPatch = applyCurrentPatch;

          // Ping on load
          vscode.postMessage({ type: 'ping' });
        </script>
      </body>
      </html>
    `;
  }
}

function getNonce() {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 16; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
