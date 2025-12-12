// desktop/src/components/QuickSwitcher.tsx
// Phase 114.3: Enhanced Quick Switcher (Cmd+P)
import React, { useEffect, useMemo, useState, useRef } from 'react';
import type { QuickFileItem } from '../App';

type QuickSwitcherProps = {
  isOpen: boolean;
  onClose: () => void;
  files: QuickFileItem[];
  onOpenFile: (path: string) => void;
  locale: string;
  recentlyOpened: string[];
};

export const QuickSwitcher: React.FC<QuickSwitcherProps> = ({
  isOpen,
  onClose,
  files,
  onOpenFile,
  locale,
  recentlyOpened,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isArabic = locale?.startsWith('ar');

  // Filter and rank files based on query
  const filtered = useMemo(() => {
    if (!isOpen) return [];

    const q = query.trim().toLowerCase();
    const recentSet = new Set(recentlyOpened);

    return files
      .map((file) => {
        const name = file.name.toLowerCase();
        const path = file.path.toLowerCase();
        const dir = file.dir?.toLowerCase() ?? '';
        const ext = file.ext?.toLowerCase() ?? '';

        let score = 0;

        // No query → sort by recency
        if (!q) {
          score += recentSet.has(file.path) ? 50 : 0;
        } else {
          // Extension filter (e.g., ".tsx")
          if (q.startsWith('.') && ext === q.slice(1)) {
            score += 80;
          }

          // Match in name
          if (name.includes(q)) score += 60;

          // Match in folder path
          if (dir.includes(q)) score += 30;

          // Match in full path
          if (path.includes(q)) score += 20;
        }

        // Recent boost
        if (recentSet.has(file.path)) score += 15;

        return { file, score };
      })
      .filter((item) => item.score > 0 || !query.trim())
      .sort((a, b) => b.score - a.score)
      .map((item) => item.file)
      .slice(0, 40);
  }, [files, query, isOpen, recentlyOpened]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      // Focus input after a short delay
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const item = filtered[activeIndex];
        if (item) {
          onOpenFile(item.path);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, activeIndex, filtered, onClose, onOpenFile]);

  if (!isOpen) return null;

  const title = isArabic ? 'الانتقال السريع بين الملفات' : 'Quick File Switcher';
  const placeholder = isArabic
    ? 'اكتب اسم ملف، مجلد، أو امتداد مثل .tsx أو .xml'
    : 'Type file name, folder, or extension like .tsx or .xml';
  const recentLabel = isArabic ? 'المستخدمة مؤخراً' : 'Recently opened';
  const emptyLabel = isArabic ? 'لا توجد نتائج مطابقة' : 'No matching files';

  return (
    <div className="f0-qs-overlay" onClick={onClose}>
      <div
        className={`f0-qs-dialog ${isArabic ? 'f0-qs-rtl' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="f0-qs-header">
          <div className="f0-qs-title">{title}</div>
          <div className="f0-qs-hint">
            {isArabic ? 'اختصار: ⌘+P (أو Ctrl+P)' : 'Shortcut: ⌘+P (or Ctrl+P)'}
          </div>
        </div>

        <input
          ref={inputRef}
          autoFocus
          className="f0-qs-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
        />

        <div className="f0-qs-list">
          {filtered.length === 0 ? (
            <div className="f0-qs-empty">{emptyLabel}</div>
          ) : (
            <>
              {!query.trim() && (
                <div className="f0-qs-section-label">{recentLabel}</div>
              )}
              {filtered.map((file, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={file.path}
                    type="button"
                    className={`f0-qs-item ${isActive ? 'f0-qs-item-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      onOpenFile(file.path);
                      onClose();
                    }}
                  >
                    <div className="f0-qs-item-main">
                      <span className="f0-qs-item-name">{file.name}</span>
                      {file.ext && (
                        <span className="f0-qs-ext-badge">{file.ext}</span>
                      )}
                    </div>
                    <div className="f0-qs-item-meta">
                      <span className="f0-qs-item-dir">{file.dir}</span>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickSwitcher;
