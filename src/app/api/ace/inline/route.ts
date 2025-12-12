// src/app/api/ace/inline/route.ts
// =============================================================================
// Phase 153.2 – Mock ACE Inline API (Next.js App Router)
// Returns mock patch for testing; replace with real orchestrator later
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import type { AceInlineRequest, AceInlineResponse } from '@/types/aceInline';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as AceInlineRequest;

  console.log('[153.2][API][ACE] Inline request received', {
    filePath: body.filePath,
    language: body.language,
    cursorLine: body.cursorLine,
    selectedLength: body.selectedText?.length ?? 0,
  });

  // Mock response - replace with real ACE orchestrator call later
  const response: AceInlineResponse = {
    message: 'Mock ACE inline response',
    patch: body.selectedText
      ? {
          id: `mock-patch-${Date.now()}`,
          title: 'Comment out selected code (mock)',
          explanation:
            'This is a mock patch from /api/ace/inline. Replace with real ACE backend later.',
          beforeRange: {
            startLine: body.selectionStartLine ?? body.cursorLine ?? 1,
            endLine: body.selectionEndLine ?? body.cursorLine ?? 1,
          },
          afterText: `// ACE FIX (mock)\n${body.selectedText}`,
        }
      : null,
  };

  return NextResponse.json(response);
}
