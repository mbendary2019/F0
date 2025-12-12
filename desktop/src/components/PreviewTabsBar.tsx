// desktop/src/components/PreviewTabsBar.tsx
// Phase 116.2: Preview Tabs Bar - horizontal tabs above the toolbar
'use client';

import React from 'react';
import clsx from 'clsx';
import { usePreviewState } from '../state/previewState';

export const PreviewTabsBar: React.FC = () => {
  const { tabs, activateTab, closeTab, openTab } = usePreviewState();

  // Middle-click to close tab
  const handleMouseUp: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (e.button === 1) {
      e.preventDefault();
      const id = e.currentTarget.dataset.id;
      if (id && tabs.length > 1) {
        closeTab(id);
      }
    }
  };

  return (
    <div className="flex h-7 items-center gap-1 border-b border-[#1b0d3a] bg-gradient-to-r from-[#050017] via-[#080022] to-[#050017] px-2 text-[11px] text-[#e0dbff]">
      <div className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-[#342065] scrollbar-track-transparent">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-id={tab.id}
            onClick={() => activateTab(tab.id)}
            onMouseUp={handleMouseUp}
            className={clsx(
              'group flex max-w-xs items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition-colors duration-150 ease-out',
              tab.isActive
                ? 'bg-[#7b5cff]/25 text-[#f5f3ff] shadow-[0_0_10px_rgba(123,92,255,0.7)] border border-[#7b5cff]/70'
                : 'bg-white/[0.03] text-[#d1ccff]/80 border border-transparent hover:bg-white/10'
            )}
          >
            {/* Viewport indicator dot */}
            <span
              className={clsx(
                'h-1.5 w-1.5 rounded-full flex-shrink-0',
                tab.viewportMode === 'mobile'
                  ? 'bg-pink-400'
                  : tab.viewportMode === 'tablet'
                  ? 'bg-amber-400'
                  : tab.viewportMode === 'desktop'
                  ? 'bg-blue-400'
                  : 'bg-emerald-400'
              )}
              title={tab.viewportMode}
            />

            {/* Tab title - truncate URL */}
            <span className="truncate">
              {tab.title !== 'New Tab' && tab.title !== 'Home'
                ? tab.title
                : tab.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </span>

            {/* Close button */}
            {tabs.length > 1 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 text-[10px] text-[#d1ccff]/80 hover:bg-white/10 hover:text-white transition-all"
              >
                ×
              </span>
            )}
          </button>
        ))}

        {/* New tab button */}
        <button
          onClick={() => openTab()}
          className="ml-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-[#7b5cff]/60 bg-transparent text-[12px] text-[#b7a6ff] hover:bg-[#7b5cff]/20 hover:shadow-[0_0_10px_rgba(123,92,255,0.7)] transition"
          title="New preview tab (⌘⌥T)"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default PreviewTabsBar;
