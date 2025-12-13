/**
 * Phase 87.4: Inline Auto-Complete Suggestions API
 * POST /api/ide/inline-suggest
 * Provides intelligent code completion suggestions powered by F0 Agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { requireProjectOwner } from '@/lib/api/requireProjectOwner';
import {
  InlineSuggestionRequest,
  InlineSuggestionResponse,
} from '@/types/inlineSuggestions';
import { askAgent } from '@/lib/agents';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const user = await requireUser(req);

    // Parse request body
    const body = (await req.json()) as InlineSuggestionRequest;

    const {
      projectId,
      sessionId,
      filePath,
      languageId,
      prefix,
      suffix,
      cursorLine,
      cursorCharacter,
    } = body;

    // Validate required fields
    if (!projectId || !filePath || prefix === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, filePath, or prefix' },
        { status: 400 }
      );
    }

    // Verify project ownership
    await requireProjectOwner(user, projectId);

    // Build smart inline suggestion prompt
    const prompt = `You are F0 Agent providing inline code suggestions.

**Context:**
- Language: ${languageId || 'unknown'}
- File: ${filePath}
- Cursor Position: line ${cursorLine}, character ${cursorCharacter}

**Code Before Cursor (prefix):**
\`\`\`${languageId || ''}
${prefix}
\`\`\`

**Code After Cursor (suffix):**
\`\`\`${languageId || ''}
${suffix}
\`\`\`

**Your Task:**
Provide a SHORT inline code suggestion to complete the code at the cursor position.

**CRITICAL RULES:**
1. Return ONLY the completion text (NO explanations, NO backticks, NO markdown)
2. Keep it SHORT (1-3 tokens maximum) - users type fast
3. Be contextually relevant based on prefix/suffix
4. Match the coding style in the prefix
5. Do NOT repeat what's already typed
6. If no good suggestion, return empty string

**Examples:**
- Prefix: "const add = (a, b) => a + " → Suggestion: "b;"
- Prefix: "function getUserName(user: User) { return user." → Suggestion: "name"
- Prefix: "if (count > 0) {" → Suggestion: "\\n  // TODO\\n}"

Return ONLY the completion text:`;

    console.log(`[Inline Suggest] ${filePath}:${cursorLine}:${cursorCharacter}`);

    // Call agent with minimal context (fast mode)
    const agentResponse = await askAgent(prompt, {
      projectId,
      lang: 'en', // Always use English for code suggestions
      // Don't include heavy context - speed is critical for inline suggestions
    });

    // Extract suggestion from agent response
    let suggestion = agentResponse.visible.trim();

    // Clean up common agent mistakes
    suggestion = suggestion
      .replace(/^```[\w]*\n?/, '') // Remove opening backticks
      .replace(/\n?```$/, '') // Remove closing backticks
      .replace(/^["']/, '') // Remove leading quotes
      .replace(/["']$/, '') // Remove trailing quotes
      .trim();

    // Limit suggestion length (safety check)
    if (suggestion.length > 200) {
      console.warn('[Inline Suggest] Suggestion too long, truncating');
      suggestion = suggestion.slice(0, 200);
    }

    console.log(`[Inline Suggest] Suggestion: "${suggestion.slice(0, 50)}${suggestion.length > 50 ? '...' : ''}"`);

    const response: InlineSuggestionResponse = {
      suggestion,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[Inline Suggest] Error:', error);

    // Handle authentication errors
    if (error.message === 'NO_TOKEN' || error.message === 'INVALID_TOKEN') {
      return NextResponse.json(
        { error: 'Unauthorized', details: error.message },
        { status: 401 }
      );
    }

    if (error.message === 'NOT_OWNER') {
      return NextResponse.json(
        { error: 'Access denied - Not project owner' },
        { status: 403 }
      );
    }

    if (error.message === 'PROJECT_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
