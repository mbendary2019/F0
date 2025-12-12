// src/lib/ace/buildAceInlineRequest.ts
// =============================================================================
// Phase 153.2 – Build ACE Inline Request
// Transforms context from editor into API payload
// =============================================================================

import type {
  InlineAceRequestContext,
  AceInlineRequest,
} from '@/types/aceInline';

type BuildMeta = {
  filePath?: string | null;
};

/**
 * Build a normalized AceInlineRequest from editor context
 */
export function buildAceInlineRequest(
  ctx: InlineAceRequestContext,
  meta?: BuildMeta
): AceInlineRequest {
  const sel = ctx.selectedRange;

  const payload: AceInlineRequest = {
    filePath: meta?.filePath ?? ctx.filePath ?? null,
    language: ctx.language,
    fullContent: ctx.fullContent,
    selectedText: sel?.selectedText ?? null,
    cursorLine: sel?.cursorLine ?? null,
    cursorColumn: sel?.cursorColumn ?? null,
    selectionStartLine: sel?.selectionStartLine ?? null,
    selectionEndLine: sel?.selectionEndLine ?? null,
  };

  console.log('[153.2][WEB][ACE] Building inline request', {
    filePath: payload.filePath,
    language: payload.language,
    cursorLine: payload.cursorLine,
    selectedLength: payload.selectedText?.length ?? 0,
  });

  return payload;
}

export default buildAceInlineRequest;
