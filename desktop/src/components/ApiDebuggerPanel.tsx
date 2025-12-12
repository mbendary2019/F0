// desktop/src/components/ApiDebuggerPanel.tsx
// Phase 124.5.1: API Debugger Panel
// UI for debugging API endpoints with code analysis and runtime logs

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { DebugApiEndpointOutput } from '../lib/agent/tools/apiLogsDebugger';
import type { QuickEndpoint } from '../hooks/useApiDebugger';

interface Props {
  // State from hook
  urlPath: string;
  query: string;
  loading: boolean;
  result: DebugApiEndpointOutput | null;
  error: string | null;
  quickEndpoints: QuickEndpoint[];
  labels: Record<string, string>;

  // Actions
  onUrlPathChange: (urlPath: string) => void;
  onQueryChange: (query: string) => void;
  onDebug: (urlPath?: string, query?: string) => void;
  onClear: () => void;
  onOpenFile?: (filePath: string) => void;

  // Options
  locale?: 'ar' | 'en';
  onClose?: () => void;
}

/**
 * API Debugger Panel - Debug failing API endpoints
 */
export const ApiDebuggerPanel: React.FC<Props> = ({
  urlPath,
  query,
  loading,
  result,
  error,
  quickEndpoints,
  labels,
  onUrlPathChange,
  onQueryChange,
  onDebug,
  onClear,
  onOpenFile,
  locale = 'ar',
  onClose,
}) => {
  const isArabic = locale === 'ar';
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(urlPath || query);

  // Update input when urlPath changes externally
  useEffect(() => {
    if (urlPath && urlPath !== inputValue) {
      setInputValue(urlPath);
    }
  }, [urlPath]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // If starts with /api, it's a URL path
    if (val.startsWith('/api')) {
      onUrlPathChange(val);
      onQueryChange('');
    } else {
      onQueryChange(val);
      onUrlPathChange('');
    }
  }, [onUrlPathChange, onQueryChange]);

  // Handle debug button click
  const handleDebug = useCallback(() => {
    if (inputValue.startsWith('/api')) {
      onDebug(inputValue, '');
    } else {
      onDebug('', inputValue);
    }
  }, [inputValue, onDebug]);

  // Handle Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleDebug();
    }
  }, [handleDebug, loading]);

  // Handle quick endpoint click
  const handleQuickEndpoint = useCallback((endpoint: QuickEndpoint) => {
    setInputValue(endpoint.urlPath);
    onUrlPathChange(endpoint.urlPath);
    onQueryChange('');
    onDebug(endpoint.urlPath, '');
  }, [onUrlPathChange, onQueryChange, onDebug]);

  // Handle file click
  const handleFileClick = useCallback((filePath: string) => {
    if (onOpenFile) {
      onOpenFile(filePath);
    }
  }, [onOpenFile]);

  return (
    <div className="f0-api-debugger-panel">
      {/* Header */}
      <div className="f0-debugger-header">
        <span className="f0-debugger-title">{labels.title}</span>
        {onClose && (
          <button className="f0-debugger-close" onClick={onClose} title={isArabic ? 'إغلاق' : 'Close'}>
            ✕
          </button>
        )}
      </div>

      {/* Query Input */}
      <div className="f0-debugger-input-section">
        <div className="f0-debugger-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="f0-debugger-input"
            placeholder={labels.placeholder}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={loading}
            dir={isArabic ? 'rtl' : 'ltr'}
          />
          <button
            className="f0-debugger-btn f0-debugger-btn-primary"
            onClick={handleDebug}
            disabled={loading || !inputValue}
          >
            {loading ? labels.loading : labels.debug}
          </button>
          {result && (
            <button
              className="f0-debugger-btn f0-debugger-btn-secondary"
              onClick={onClear}
            >
              {labels.clear}
            </button>
          )}
        </div>

        {/* Quick Endpoints */}
        {quickEndpoints.length > 0 && !result && (
          <div className="f0-debugger-quick-endpoints">
            <span className="f0-debugger-quick-label">{labels.quickEndpoints}:</span>
            <div className="f0-debugger-quick-chips">
              {quickEndpoints.map((ep, idx) => (
                <button
                  key={idx}
                  className="f0-debugger-quick-chip"
                  onClick={() => handleQuickEndpoint(ep)}
                  title={ep.urlPath}
                >
                  <span className="f0-debugger-quick-icon">{ep.icon}</span>
                  <span className="f0-debugger-quick-text">{ep.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="f0-debugger-error">
          <span className="f0-debugger-error-icon">⚠️</span>
          <span className="f0-debugger-error-text">{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="f0-debugger-loading">
          <span className="f0-debugger-spinner" />
          <span>{labels.loading}</span>
        </div>
      )}

      {/* Results */}
      {result?.success && (
        <div className="f0-debugger-results">
          {/* Endpoint Overview */}
          {result.inspector?.metadata && (
            <div className="f0-debugger-section">
              <div className="f0-debugger-section-header">
                <span className="f0-debugger-section-icon">📡</span>
                <span className="f0-debugger-section-title">{result.urlPath}</span>
              </div>
              <div className="f0-debugger-section-content">
                <div
                  className="f0-debugger-file-path"
                  onClick={() => handleFileClick(result.inspector!.metadata!.fsPath)}
                  title={isArabic ? 'انقر لفتح الملف' : 'Click to open file'}
                >
                  <span className="f0-debugger-file-icon">📁</span>
                  <span className="f0-debugger-file-text">{result.inspector!.metadata!.fsPath}</span>
                </div>
                <div className="f0-debugger-meta-grid">
                  <div className="f0-debugger-meta-item">
                    <span className="f0-debugger-meta-label">🔧 {labels.methods}:</span>
                    <span className="f0-debugger-meta-value">
                      {result.inspector!.metadata!.methods.join(', ')}
                    </span>
                  </div>
                  <div className="f0-debugger-meta-item">
                    <span className="f0-debugger-meta-label">🔐 {labels.auth}:</span>
                    <span className="f0-debugger-meta-value">
                      {result.inspector!.metadata!.authHint === 'none'
                        ? labels.none
                        : result.inspector!.metadata!.authDetails || result.inspector!.metadata!.authHint}
                    </span>
                  </div>
                  <div className="f0-debugger-meta-item">
                    <span className="f0-debugger-meta-label">✅ {labels.validation}:</span>
                    <span className="f0-debugger-meta-value">
                      {result.inspector!.metadata!.validationHints.length > 0
                        ? result.inspector!.metadata!.validationHints.join(', ')
                        : labels.none}
                    </span>
                  </div>
                  {result.inspector!.metadata!.errorCodes.length > 0 && (
                    <div className="f0-debugger-meta-item">
                      <span className="f0-debugger-meta-label">❌ Error Codes:</span>
                      <span className="f0-debugger-meta-value">
                        {result.inspector!.metadata!.errorCodes.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Logs Summary */}
          {result.logs && (
            <div className="f0-debugger-section">
              <div className="f0-debugger-section-header">
                <span className="f0-debugger-section-icon">📊</span>
                <span className="f0-debugger-section-title">{labels.logsSummary}</span>
              </div>
              <div className="f0-debugger-section-content">
                <div className="f0-debugger-logs-stats">
                  <div className={`f0-debugger-stat ${result.logs.errorCount > 0 ? 'f0-stat-error' : ''}`}>
                    <span className="f0-debugger-stat-icon">❌</span>
                    <span className="f0-debugger-stat-value">{result.logs.errorCount}</span>
                    <span className="f0-debugger-stat-label">{labels.errors}</span>
                  </div>
                  <div className={`f0-debugger-stat ${result.logs.warnCount > 0 ? 'f0-stat-warn' : ''}`}>
                    <span className="f0-debugger-stat-icon">⚠️</span>
                    <span className="f0-debugger-stat-value">{result.logs.warnCount}</span>
                    <span className="f0-debugger-stat-label">{labels.warnings}</span>
                  </div>
                  {result.logs.mostCommonStatus && (
                    <div className="f0-debugger-stat">
                      <span className="f0-debugger-stat-icon">📈</span>
                      <span className="f0-debugger-stat-value">{result.logs.mostCommonStatus}</span>
                      <span className="f0-debugger-stat-label">Status</span>
                    </div>
                  )}
                </div>

                {/* Common Errors */}
                {result.logs.commonErrors.length > 0 && (
                  <div className="f0-debugger-common-errors">
                    <div className="f0-debugger-common-errors-title">{labels.commonErrors}</div>
                    <div className="f0-debugger-error-list">
                      {result.logs.commonErrors.slice(0, 3).map((err, idx) => (
                        <div key={idx} className="f0-debugger-error-item">
                          <span className="f0-debugger-error-count">{err.count}x</span>
                          <span className="f0-debugger-error-msg">{err.message.slice(0, 80)}...</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No logs message */}
                {result.logs.entries.length === 0 && (
                  <div className="f0-debugger-no-logs">
                    📭 {isArabic ? 'لا توجد logs مسجلة' : 'No logs recorded'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Root Cause */}
          {result.rootCause && (
            <div className="f0-debugger-section f0-debugger-root-cause">
              <div className="f0-debugger-section-header">
                <span className="f0-debugger-section-icon">🎯</span>
                <span className="f0-debugger-section-title">{labels.rootCause}</span>
              </div>
              <div className="f0-debugger-section-content">
                <div className="f0-debugger-cause-text">{result.rootCause}</div>
              </div>
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions && result.suggestions.length > 0 && (
            <div className="f0-debugger-section f0-debugger-suggestions">
              <div className="f0-debugger-section-header">
                <span className="f0-debugger-section-icon">💡</span>
                <span className="f0-debugger-section-title">{labels.suggestions}</span>
              </div>
              <div className="f0-debugger-section-content">
                <ul className="f0-debugger-suggestion-list">
                  {result.suggestions.map((sug, idx) => (
                    <li key={idx} className="f0-debugger-suggestion-item">
                      {sug}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ApiDebuggerPanel;
