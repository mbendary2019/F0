/**
 * Phase 97.1: useProjectPreviewUrl Hook
 * Fetches and updates preview URL for a project
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseProjectPreviewUrlResult {
  previewUrl: string | null;
  loading: boolean;
  error: string | null;
  updatePreviewUrl: (newUrl: string | null) => Promise<boolean>;
  saving: boolean;
}

export function useProjectPreviewUrl(projectId: string | undefined): UseProjectPreviewUrlResult {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch preview URL on mount
  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const fetchPreviewUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/projects/${projectId}/preview`);

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to fetch preview URL (${res.status})`);
        }

        const data = await res.json();
        setPreviewUrl(data.previewUrl ?? null);
      } catch (err: any) {
        console.error('[useProjectPreviewUrl] Fetch error:', err);
        setError(err?.message || 'Failed to fetch preview URL');
      } finally {
        setLoading(false);
      }
    };

    fetchPreviewUrl();
  }, [projectId]);

  // Update preview URL
  const updatePreviewUrl = useCallback(
    async (newUrl: string | null): Promise<boolean> => {
      if (!projectId) {
        setError('No project ID provided');
        return false;
      }

      setSaving(true);
      setError(null);

      try {
        const res = await fetch(`/api/projects/${projectId}/preview`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ previewUrl: newUrl }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to update preview URL (${res.status})`);
        }

        setPreviewUrl(newUrl);
        return true;
      } catch (err: any) {
        console.error('[useProjectPreviewUrl] Update error:', err);
        setError(err?.message || 'Failed to update preview URL');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [projectId]
  );

  return {
    previewUrl,
    loading,
    error,
    updatePreviewUrl,
    saving,
  };
}
