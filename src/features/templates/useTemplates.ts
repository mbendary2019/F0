/**
 * Phase 78: Developer Mode Assembly - useTemplates Hook
 * Client-side hook to fetch available project templates
 */

'use client';

import { useEffect, useState } from 'react';
import type { F0Template } from '@/types/templates';

export function useTemplates() {
  const [templates, setTemplates] = useState<F0Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/templates');

        if (!res.ok) {
          throw new Error('Failed to load templates');
        }

        const json = await res.json();
        setTemplates(json.templates || []);
      } catch (e: any) {
        console.error('[useTemplates] Error:', e);
        setError(e.message || 'Failed to load templates');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { templates, loading, error };
}
