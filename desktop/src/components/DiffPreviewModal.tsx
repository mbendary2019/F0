// desktop/src/components/DiffPreviewModal.tsx
import React from 'react';

/**
 * Phase 109.4.4: Diff Preview Modal
 * Shows old vs new file content before applying AI changes
 */

export type DiffPreviewModalProps = {
  isOpen: boolean;
  filePath: string;
  oldContent: string;
  newContent: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export const DiffPreviewModal: React.FC<DiffPreviewModalProps> = ({
  isOpen,
  filePath,
  oldContent,
  newContent,
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="f0-diff-modal-backdrop">
      <div className="f0-diff-modal">
        {/* Header */}
        <div className="f0-diff-modal-header">
          <span className="f0-diff-modal-title">
            Review changes for <span className="f0-diff-modal-filepath">{filePath}</span>
          </span>
        </div>

        {/* Diff Grid */}
        <div className="f0-diff-modal-grid">
          {/* Old File */}
          <div className="f0-diff-modal-pane">
            <div className="f0-diff-modal-pane-header">
              Current file
            </div>
            <pre className="f0-diff-modal-content">
              {oldContent}
            </pre>
          </div>

          {/* New File */}
          <div className="f0-diff-modal-pane">
            <div className="f0-diff-modal-pane-header">
              New version (from F0 Agent)
            </div>
            <pre className="f0-diff-modal-content">
              {newContent}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="f0-diff-modal-footer">
          <button
            onClick={onCancel}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn btn-primary"
          >
            Apply changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiffPreviewModal;
