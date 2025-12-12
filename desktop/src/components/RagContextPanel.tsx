// desktop/src/components/RagContextPanel.tsx
// Phase 122.2: RAG Context Panel - Shows indexed context files for agent
// Displays files being used as context for LLM responses

import React from 'react';
import type { ContextFile } from '../lib/rag/projectContextFromIndex';

interface Props {
  contextFiles: ContextFile[];
  isLoading: boolean;
  locale?: 'ar' | 'en';
  isArabic?: boolean; // Deprecated: use locale
  onClose?: () => void;
}

/**
 * Panel that displays the context files used by the RAG system
 * Shows which files were indexed and used for the agent's response
 */
export const RagContextPanel: React.FC<Props> = ({
  contextFiles,
  isLoading,
  locale,
  isArabic: isArabicProp,
  onClose,
}) => {
  // Support both locale and isArabic props
  const isArabic = locale ? locale === 'ar' : (isArabicProp ?? true);
  const labels = {
    title: isArabic ? '📚 ملفات السياق' : '📚 Context Files',
    loading: isArabic ? 'جاري البحث في الفهرس...' : 'Searching index...',
    noFiles: isArabic ? 'لا توجد ملفات سياق' : 'No context files',
    score: isArabic ? 'النقاط' : 'Score',
    reason: isArabic ? 'السبب' : 'Reason',
    chars: isArabic ? 'حرف' : 'chars',
    close: isArabic ? 'إغلاق' : 'Close',
  };

  if (isLoading) {
    return (
      <div className="f0-rag-context-panel f0-rag-loading">
        <div className="f0-rag-header">
          <span className="f0-rag-title">{labels.title}</span>
        </div>
        <div className="f0-rag-loading-spinner">
          <span className="f0-rag-spinner" />
          <span>{labels.loading}</span>
        </div>
      </div>
    );
  }

  if (contextFiles.length === 0) {
    return null; // Don't show panel if no context
  }

  return (
    <div className="f0-rag-context-panel">
      <div className="f0-rag-header">
        <span className="f0-rag-title">{labels.title}</span>
        <span className="f0-rag-count">{contextFiles.length}</span>
        {onClose && (
          <button className="f0-rag-close" onClick={onClose} title={labels.close}>
            ✕
          </button>
        )}
      </div>
      <div className="f0-rag-files">
        {contextFiles.map((file, idx) => (
          <div key={idx} className="f0-rag-file">
            <div className="f0-rag-file-path">
              <span className="f0-rag-file-icon">📄</span>
              <span className="f0-rag-file-name">{file.path}</span>
            </div>
            <div className="f0-rag-file-meta">
              {file.score !== undefined && (
                <span className="f0-rag-file-score">
                  {labels.score}: {Math.round(file.score)}
                </span>
              )}
              {file.reason && (
                <span className="f0-rag-file-reason">
                  {file.reason}
                </span>
              )}
              <span className="f0-rag-file-size">
                {file.content.length} {labels.chars}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RagContextPanel;
