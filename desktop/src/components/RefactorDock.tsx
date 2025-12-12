/**
 * Phase 110.2: Refactor Dock Component
 *
 * A floating dock that appears when the Cloud Agent returns code edits.
 * Shows all pending edits with Apply/Discard actions for each.
 */

import React, { useState } from 'react';
import type { IdeRefactorEdit } from '../services/cloudAgent';
import { DiffPreviewModal } from './DiffPreviewModal';

export interface RefactorDockProps {
  edits: IdeRefactorEdit[];
  rootPath: string | null;
  onApplyEdit: (edit: IdeRefactorEdit, index: number) => Promise<void>;
  onDiscardEdit: (index: number) => void;
  onApplyAll: () => Promise<void>;
  onDiscardAll: () => void;
  onClose: () => void;
  isApplying?: boolean;
  locale?: 'ar' | 'en';
}

/**
 * Helper to get file name from path
 */
function getFileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

/**
 * Helper to get file extension for syntax highlighting hint
 */
function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    json: 'json',
    css: 'css',
    html: 'html',
    md: 'markdown',
  };
  return map[ext] || 'plaintext';
}

export const RefactorDock: React.FC<RefactorDockProps> = ({
  edits,
  rootPath,
  onApplyEdit,
  onDiscardEdit,
  onApplyAll,
  onDiscardAll,
  onClose,
  isApplying = false,
  locale = 'ar',
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [previewEdit, setPreviewEdit] = useState<{ edit: IdeRefactorEdit; index: number } | null>(null);
  const [currentFileContent, setCurrentFileContent] = useState<string>('');

  const isArabic = locale === 'ar';

  // Labels
  const labels = {
    title: isArabic ? '✨ تعديلات الكود' : '✨ Code Edits',
    applyAll: isArabic ? 'تطبيق الكل' : 'Apply All',
    discardAll: isArabic ? 'تجاهل الكل' : 'Discard All',
    apply: isArabic ? 'تطبيق' : 'Apply',
    discard: isArabic ? 'تجاهل' : 'Discard',
    preview: isArabic ? 'معاينة' : 'Preview',
    close: isArabic ? 'إغلاق' : 'Close',
    noEdits: isArabic ? 'لا توجد تعديلات معلقة' : 'No pending edits',
    applying: isArabic ? 'جاري التطبيق...' : 'Applying...',
    editType: {
      'replace-range': isArabic ? 'استبدال جزئي' : 'Partial Replace',
      'insert': isArabic ? 'إضافة' : 'Insert',
      'delete': isArabic ? 'حذف' : 'Delete',
      'full-replace': isArabic ? 'استبدال كامل' : 'Full Replace',
    },
  };

  if (edits.length === 0) {
    return null;
  }

  const handlePreviewClick = async (edit: IdeRefactorEdit, index: number) => {
    // Read current file content
    const api = window.f0Desktop;
    if (!api || !rootPath) return;

    try {
      const fullPath = edit.filePath.startsWith(rootPath)
        ? edit.filePath
        : `${rootPath.replace(/\/+$/, '')}/${edit.filePath.replace(/^\/+/, '')}`;

      const content = await api.readFile(fullPath);
      setCurrentFileContent(content);
    } catch {
      setCurrentFileContent(''); // New file
    }

    setPreviewEdit({ edit, index });
  };

  const handleConfirmPreview = async () => {
    if (previewEdit) {
      await onApplyEdit(previewEdit.edit, previewEdit.index);
      setPreviewEdit(null);
      setCurrentFileContent('');
    }
  };

  return (
    <>
      <div className="f0-refactor-dock">
        {/* Header */}
        <div className="f0-refactor-dock-header">
          <span className="f0-refactor-dock-title">{labels.title}</span>
          <span className="f0-refactor-dock-count">{edits.length}</span>
          <button
            className="f0-refactor-dock-close"
            onClick={onClose}
            title={labels.close}
          >
            ✕
          </button>
        </div>

        {/* Edit List */}
        <div className="f0-refactor-dock-list">
          {edits.map((edit, index) => (
            <div key={index} className="f0-refactor-dock-item">
              <div className="f0-refactor-dock-item-header">
                <div className="f0-refactor-dock-item-info">
                  <span className="f0-refactor-dock-item-icon">📝</span>
                  <span className="f0-refactor-dock-item-filename">
                    {getFileName(edit.filePath)}
                  </span>
                  <span className="f0-refactor-dock-item-type">
                    {labels.editType[edit.type] || edit.type}
                  </span>
                </div>
                <div className="f0-refactor-dock-item-actions">
                  <button
                    className="f0-btn f0-btn-sm f0-btn-ghost"
                    onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                    title={expandedIndex === index ? 'Collapse' : 'Expand'}
                  >
                    {expandedIndex === index ? '▲' : '▼'}
                  </button>
                  <button
                    className="f0-btn f0-btn-sm f0-btn-secondary"
                    onClick={() => handlePreviewClick(edit, index)}
                    disabled={isApplying}
                  >
                    {labels.preview}
                  </button>
                  <button
                    className="f0-btn f0-btn-sm f0-btn-primary"
                    onClick={() => onApplyEdit(edit, index)}
                    disabled={isApplying}
                  >
                    {isApplying ? '...' : labels.apply}
                  </button>
                  <button
                    className="f0-btn f0-btn-sm f0-btn-danger"
                    onClick={() => onDiscardEdit(index)}
                    disabled={isApplying}
                  >
                    {labels.discard}
                  </button>
                </div>
              </div>

              {/* Expanded preview */}
              {expandedIndex === index && (
                <div className="f0-refactor-dock-item-preview">
                  {edit.description && (
                    <div className="f0-refactor-dock-item-description">
                      {edit.description}
                    </div>
                  )}
                  <pre className="f0-refactor-dock-item-code">
                    <code className={`language-${getLanguageFromPath(edit.filePath)}`}>
                      {edit.newText.slice(0, 500)}
                      {edit.newText.length > 500 ? '\n\n... (truncated)' : ''}
                    </code>
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="f0-refactor-dock-footer">
          <button
            className="f0-btn f0-btn-secondary"
            onClick={onDiscardAll}
            disabled={isApplying}
          >
            🗑️ {labels.discardAll}
          </button>
          <button
            className="f0-btn f0-btn-primary"
            onClick={onApplyAll}
            disabled={isApplying}
          >
            {isApplying ? labels.applying : `✅ ${labels.applyAll}`}
          </button>
        </div>
      </div>

      {/* Diff Preview Modal */}
      {previewEdit && (
        <DiffPreviewModal
          isOpen={true}
          filePath={previewEdit.edit.filePath}
          oldContent={currentFileContent}
          newContent={previewEdit.edit.newText}
          onCancel={() => {
            setPreviewEdit(null);
            setCurrentFileContent('');
          }}
          onConfirm={handleConfirmPreview}
        />
      )}
    </>
  );
};

export default RefactorDock;
