/**
 * Message Router for Xcode Extension
 * Phase 84.8.2: Routes commands from Xcode to appropriate handlers
 */

import { authManager } from './authManager';
import { f0Client } from './f0Client';
import { collectWorkspaceContext } from './contextCollector';
import { projectBinding } from './projectBinding';

export interface XcodeRequest {
  command: string;
  filePath: string;
  content: string;
  selection?: string;
  languageId?: string;
}

export interface XcodeResponse {
  success: boolean;
  message?: string;
  error?: string;
  patchSuggestion?: {
    hasPatch: boolean;
    patchText?: string;
  };
}

export async function handleXcodeMessage(req: XcodeRequest): Promise<XcodeResponse> {
  const { command, filePath, content, selection } = req;

  // Build file context
  const fileContext = {
    filePath,
    content,
    languageId: detectLanguage(filePath),
    selection: selection ? {
      startLine: 0,
      startCol: 0,
      endLine: 0,
      endCol: 0,
    } : undefined,
  };

  // Check authentication
  if (!authManager.isLoggedIn()) {
    return {
      success: false,
      error: 'Not authenticated. Please run: f0-xcode-helper login',
    };
  }

  try {
    // Ensure project is bound
    await projectBinding.ensureProjectBound();

    // Collect workspace context
    const workspaceContext = await collectWorkspaceContext();

    // Route command
    let userMessage: string;

    switch (command) {
      case 'f0.ask':
      case 'com.f0.xcode.ask':
        userMessage = selection
          ? `Explain this code:\n\n\`\`\`\n${selection}\n\`\`\``
          : `Explain this file: ${filePath}`;
        break;

      case 'f0.fix':
      case 'com.f0.xcode.fix':
        userMessage = selection
          ? `Fix any issues in this code:\n\n\`\`\`\n${selection}\n\`\`\``
          : `Review and fix any issues in this file: ${filePath}`;
        break;

      case 'f0.refactor':
      case 'com.f0.xcode.refactor':
        userMessage = selection
          ? `Suggest refactoring improvements for this code:\n\n\`\`\`\n${selection}\n\`\`\``
          : `Suggest refactoring improvements for this file: ${filePath}`;
        break;

      case 'f0.explain.file':
      case 'com.f0.xcode.explainFile':
        userMessage = `Explain what this file does: ${filePath}`;
        break;

      default:
        return {
          success: false,
          error: `Unknown command: ${command}`,
        };
    }

    // Call F0 AI
    const response = await f0Client.chat(userMessage, fileContext, workspaceContext);

    return {
      success: true,
      message: response.replyText,
      patchSuggestion: response.patchSuggestion,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || String(err),
    };
  }
}

function detectLanguage(path: string): string {
  if (path.endsWith('.swift')) return 'swift';
  if (path.endsWith('.m')) return 'objective-c';
  if (path.endsWith('.mm')) return 'objective-c++';
  if (path.endsWith('.h')) return 'header';
  if (path.endsWith('.c')) return 'c';
  if (path.endsWith('.cpp') || path.endsWith('.cc')) return 'cpp';
  if (path.endsWith('.ts')) return 'typescript';
  if (path.endsWith('.js')) return 'javascript';
  if (path.endsWith('.py')) return 'python';
  return 'plaintext';
}
