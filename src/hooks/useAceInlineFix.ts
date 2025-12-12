// src/hooks/useAceInlineFix.ts
// =============================================================================
// Phase 153.2 – Inline ACE Fix Hook (WEB)
// Manages state and API calls for inline ACE suggestions
// =============================================================================

import * as React from 'react';
import type {
  AceInlineResponse,
  InlineAceRequestContext,
} from '@/types/aceInline';
import { buildAceInlineRequest } from '@/lib/ace/buildAceInlineRequest';

export function useAceInlineFix() {
  const [isLoadingAceInline, setIsLoadingAceInline] = React.useState(false);
  const [lastInlineResponse, setLastInlineResponse] =
    React.useState<AceInlineResponse | null>(null);
  const [errorAceInline, setErrorAceInline] = React.useState<string | null>(
    null
  );

  const runAceInlineFix = React.useCallback(
    async (ctx: InlineAceRequestContext): Promise<AceInlineResponse | null> => {
      console.log('[153.2][WEB][ACE] runAceInlineFix called');

      const payload = buildAceInlineRequest(ctx);

      setIsLoadingAceInline(true);
      setErrorAceInline(null);

      try {
        console.log('[153.2][WEB][ACE] Calling /api/ace/inline');

        const res = await fetch('/api/ace/inline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as AceInlineResponse;

        console.log('[153.2][WEB][ACE] Inline response received', data);

        setLastInlineResponse(data);
        return data;
      } catch (err) {
        console.error('[153.2][WEB][ACE] Inline error', err);
        const msg =
          err instanceof Error ? err.message : 'Unknown ACE inline error';
        setErrorAceInline(msg);
        return null;
      } finally {
        setIsLoadingAceInline(false);
      }
    },
    []
  );

  // Clear state (Phase 153.3)
  const clearAceInlineResponse = React.useCallback(() => {
    setLastInlineResponse(null);
    setErrorAceInline(null);
  }, []);

  return {
    isLoadingAceInline,
    lastInlineResponse,
    errorAceInline,
    runAceInlineFix,
    clearAceInlineResponse,
  };
}

export default useAceInlineFix;
