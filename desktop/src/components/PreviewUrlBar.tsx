// desktop/src/components/PreviewUrlBar.tsx
// Phase 119.7: Separate URL bar below tabs - each tab has its own URL
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import clsx from 'clsx';
import { usePreviewState } from '../state/previewState';

export const PreviewUrlBar: React.FC = () => {
  const { tabs, setUrl, reload } = usePreviewState();

  // Get active tab's URL
  const activeTab = tabs.find((t) => t.isActive);
  const activeUrl = activeTab?.url ?? 'http://localhost:3030/en';

  // Local state for URL input
  const [inputUrl, setInputUrl] = useState(activeUrl);
  const [isEditing, setIsEditing] = useState(false);

  // Sync input with active tab's URL changes
  useEffect(() => {
    if (!isEditing) {
      setInputUrl(activeUrl);
    }
  }, [activeUrl, isEditing]);

  // Handle URL submission - updates the active tab's URL
  const handleSubmit = useCallback(() => {
    setIsEditing(false);
    if (inputUrl.trim() && inputUrl !== activeUrl) {
      // Add protocol if missing
      let finalUrl = inputUrl.trim();
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'http://' + finalUrl;
      }
      setUrl(finalUrl);
      reload();
    } else {
      setInputUrl(activeUrl);
    }
  }, [inputUrl, activeUrl, setUrl, reload]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSubmit();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        setInputUrl(activeUrl);
      }
    },
    [handleSubmit, activeUrl]
  );

  return (
    <div className="flex h-8 items-center gap-2 border-b border-[#1b0d3a] bg-gradient-to-r from-[#050017] via-[#080022] to-[#050017] px-3">
      {/* URL Icon */}
      <span className="text-[10px] text-[#7b5cff]">🔗</span>

      {/* URL Input */}
      <input
        type="text"
        value={inputUrl}
        onChange={(e) => setInputUrl(e.target.value)}
        onFocus={() => setIsEditing(true)}
        onBlur={handleSubmit}
        onKeyDown={handleKeyDown}
        className={clsx(
          'flex-1 rounded-lg bg-black/50 px-3 py-1.5 text-[11px] font-mono border outline-none transition-all duration-200',
          isEditing
            ? 'text-[#f5f3ff] border-[#7b5cff]/60 shadow-[0_0_10px_rgba(123,92,255,0.4)]'
            : 'text-[#f5f3ff]/85 border-white/[0.08] hover:border-[#7b5cff]/40'
        )}
        placeholder="Enter URL..."
      />

      {/* Go button */}
      <button
        onClick={handleSubmit}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-[#7b5cff]/50 bg-[#7b5cff]/20 text-[10px] text-[#c4b5fd] hover:bg-[#7b5cff]/30 hover:text-white shadow-[0_0_8px_rgba(123,92,255,0.3)] transition-all"
        title="Go"
      >
        →
      </button>
    </div>
  );
};

export default PreviewUrlBar;
