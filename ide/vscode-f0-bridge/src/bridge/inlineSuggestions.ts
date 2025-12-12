// src/bridge/inlineSuggestions.ts
import * as vscode from 'vscode';
import { requestInlineSuggestion } from '../services/inlineClient';
import { InlineSuggestionRequest } from '../types/inlineSuggestions';

export interface InlineBridgeContext {
  projectId: string;
  sessionId?: string;
}

let inlineRegistration: vscode.Disposable | undefined;
let lastRequestTime = 0;
const THROTTLE_MS = 400; // Don't request more than once every 400ms

/**
 * Register inline completion provider for F0 Agent suggestions
 */
export function registerInlineSuggestions(
  context: vscode.ExtensionContext,
  bridge: InlineBridgeContext
) {
  // Dispose existing registration if any
  if (inlineRegistration) {
    inlineRegistration.dispose();
    inlineRegistration = undefined;
  }

  const provider: vscode.InlineCompletionItemProvider = {
    async provideInlineCompletionItems(
      document,
      position,
      _context,
      _token
    ) {
      // Throttle requests
      const now = Date.now();
      if (now - lastRequestTime < THROTTLE_MS) {
        return { items: [] };
      }
      lastRequestTime = now;

      // Check if inline suggestions are enabled
      const config = vscode.workspace.getConfiguration('f0');
      const enabled = config.get<boolean>('inlineSuggestions.enabled');
      if (!enabled) {
        return { items: [] };
      }

      // Only provide suggestions for file:// schemes
      if (document.uri.scheme !== 'file') {
        return { items: [] };
      }

      const filePath = vscode.workspace.asRelativePath(document.uri);
      const languageId = document.languageId;

      // Get context before and after cursor
      const fullText = document.getText();
      const offset = document.offsetAt(position);

      const prefix = fullText.slice(0, offset);
      const suffix = fullText.slice(offset);

      // Don't suggest if prefix is empty or only whitespace
      if (!prefix.trim()) {
        return { items: [] };
      }

      const req: InlineSuggestionRequest = {
        projectId: bridge.projectId,
        sessionId: bridge.sessionId,
        filePath,
        languageId,
        prefix,
        suffix,
        cursorLine: position.line,
        cursorCharacter: position.character,
      };

      console.log('[F0 Inline] Requesting suggestion...');
      const res = await requestInlineSuggestion(req);

      if (!res || !res.suggestion || !res.suggestion.trim()) {
        console.log('[F0 Inline] No suggestion received');
        return { items: [] };
      }

      console.log('[F0 Inline] Suggestion received:', res.suggestion.substring(0, 50));

      const item = new vscode.InlineCompletionItem(
        res.suggestion,
        new vscode.Range(position, position)
      );

      return {
        items: [item],
      };
    },
  };

  inlineRegistration = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: '**' }, // All files
    provider
  );

  context.subscriptions.push(inlineRegistration);
  console.log('[F0 Inline] Provider registered for project:', bridge.projectId);
}

/**
 * Unregister inline completion provider
 */
export function unregisterInlineSuggestions() {
  if (inlineRegistration) {
    inlineRegistration.dispose();
    inlineRegistration = undefined;
    console.log('[F0 Inline] Provider unregistered');
  }
}
