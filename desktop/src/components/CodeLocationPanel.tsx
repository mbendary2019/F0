// desktop/src/components/CodeLocationPanel.tsx
// Phase 167.1: Code Location Intent - Display found files with Open button

import React from 'react';
import type { CodeLocationResult } from '../lib/agent/handleAgentMessage';

type Props = {
  results: CodeLocationResult[];
  locale: string;
  onClose: () => void;
  onOpenFile: (filePath: string) => void;
};

/**
 * Phase 167.1: Code Location Panel
 * Shows list of files found when user asks "where is the code that handles X?"
 * Each file has an "Open file" button to navigate directly in the IDE
 */
export function CodeLocationPanel({ results, locale, onClose, onOpenFile }: Props) {
  const isArabic = locale === 'ar';

  const labels = {
    title: isArabic ? '📍 مواقع الكود' : '📍 Code Locations',
    subtitle: isArabic
      ? `تم العثور على ${results.length} ملفات ذات صلة`
      : `Found ${results.length} relevant files`,
    openFile: isArabic ? 'افتح الملف' : 'Open file',
    mainEntry: isArabic ? '⭐ نقطة الدخول الرئيسية' : '⭐ Main entrypoint',
  };

  return (
    <div className="f0-code-location-panel">
      <div className="f0-code-location-header">
        <div className="f0-code-location-title">
          <span>{labels.title}</span>
          <span className="f0-code-location-count">{labels.subtitle}</span>
        </div>
        <button
          className="f0-code-location-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="f0-code-location-list">
        {results.map((result, index) => (
          <div
            key={result.path}
            className={`f0-code-location-item ${result.isMainEntry ? 'f0-code-location-main' : ''}`}
          >
            <div className="f0-code-location-file-info">
              <div className="f0-code-location-file-path">
                <span className="f0-code-location-index">{index + 1}.</span>
                <span className="f0-code-location-path" title={result.path}>
                  {result.path}
                </span>
                {result.isMainEntry && (
                  <span className="f0-code-location-main-badge">{labels.mainEntry}</span>
                )}
              </div>
              {result.snippet && (
                <pre className="f0-code-location-snippet">
                  <code>{result.snippet.slice(0, 200)}{result.snippet.length > 200 ? '...' : ''}</code>
                </pre>
              )}
            </div>
            <button
              className="f0-code-location-open-btn"
              onClick={() => onOpenFile(result.path)}
            >
              {labels.openFile}
            </button>
          </div>
        ))}
      </div>

      <style>{`
        .f0-code-location-panel {
          position: fixed;
          bottom: 60px;
          right: 16px;
          width: 400px;
          max-height: 400px;
          background: var(--f0-bg-elevated, #1e1e1e);
          border: 1px solid var(--f0-border, #333);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .f0-code-location-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--f0-border, #333);
          background: var(--f0-bg-header, #252525);
        }

        .f0-code-location-title {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .f0-code-location-title > span:first-child {
          font-weight: 600;
          font-size: 14px;
          color: var(--f0-text-primary, #fff);
        }

        .f0-code-location-count {
          font-size: 12px;
          color: var(--f0-text-secondary, #888);
        }

        .f0-code-location-close {
          background: none;
          border: none;
          color: var(--f0-text-secondary, #888);
          cursor: pointer;
          padding: 4px 8px;
          font-size: 16px;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .f0-code-location-close:hover {
          background: var(--f0-bg-hover, #333);
          color: var(--f0-text-primary, #fff);
        }

        .f0-code-location-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .f0-code-location-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 10px 12px;
          margin-bottom: 6px;
          background: var(--f0-bg-item, #2a2a2a);
          border-radius: 6px;
          border: 1px solid transparent;
          transition: border-color 0.2s;
        }

        .f0-code-location-item:hover {
          border-color: var(--f0-accent, #007acc);
        }

        .f0-code-location-item.f0-code-location-main {
          border-color: var(--f0-accent-gold, #c9a227);
          background: rgba(201, 162, 39, 0.1);
        }

        .f0-code-location-file-info {
          flex: 1;
          min-width: 0;
          margin-right: 12px;
        }

        .f0-code-location-file-path {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .f0-code-location-index {
          color: var(--f0-text-secondary, #888);
          font-size: 12px;
          min-width: 20px;
        }

        .f0-code-location-path {
          font-family: monospace;
          font-size: 12px;
          color: var(--f0-text-primary, #fff);
          word-break: break-all;
        }

        .f0-code-location-main-badge {
          font-size: 10px;
          padding: 2px 6px;
          background: var(--f0-accent-gold, #c9a227);
          color: #000;
          border-radius: 4px;
          white-space: nowrap;
        }

        .f0-code-location-snippet {
          margin: 8px 0 0 0;
          padding: 8px;
          background: var(--f0-bg-code, #1a1a1a);
          border-radius: 4px;
          overflow-x: auto;
          font-size: 11px;
          line-height: 1.4;
          max-height: 80px;
          overflow-y: auto;
        }

        .f0-code-location-snippet code {
          color: var(--f0-text-code, #d4d4d4);
          white-space: pre-wrap;
          word-break: break-word;
        }

        .f0-code-location-open-btn {
          flex-shrink: 0;
          padding: 6px 12px;
          background: var(--f0-accent, #007acc);
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: background 0.2s;
        }

        .f0-code-location-open-btn:hover {
          background: var(--f0-accent-hover, #0098ff);
        }
      `}</style>
    </div>
  );
}

export default CodeLocationPanel;
