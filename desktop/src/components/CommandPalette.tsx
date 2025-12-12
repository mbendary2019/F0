// desktop/src/components/CommandPalette.tsx
// Phase 114.4: Command Palette Component

import React, { useEffect, useMemo, useState, useRef } from 'react';
import type { CommandItem } from '../commands/commandPalette';
import mascotImg from '../../public/mascots/f0-mascot-login.png';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCommand: (id: string) => void;
  locale: 'en' | 'ar';
  commands: CommandItem[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onExecuteCommand,
  locale,
  commands,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setActiveIndex(0);
    } else {
      // Focus input when opening
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter commands based on query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((cmd) => {
      const textEn = cmd.label.toLowerCase();
      const textAr = cmd.labelAr.toLowerCase();
      const descEn = (cmd.description || '').toLowerCase();
      const descAr = (cmd.descriptionAr || '').toLowerCase();
      return (
        textEn.includes(q) ||
        textAr.includes(q) ||
        descEn.includes(q) ||
        descAr.includes(q)
      );
    });
  }, [commands, query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[activeIndex];
        if (cmd) {
          onExecuteCommand(cmd.id);
          onClose();
        }
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, filtered, activeIndex, onExecuteCommand, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector('.f0-command-item-active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.f0-command-palette')) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isArabic = locale === 'ar';

  // Category icons for visual grouping
  const categoryIcons: Record<string, React.ReactNode> = {
    navigation: '📂',
    runner: '▶️',
    agent: <img src={mascotImg} alt="AI" className="h-4 w-4 rounded-full inline-block" />,
    view: '👁️',
    system: '⚙️',
    preview: '🌐',
    analysis: '🧬',
  };

  return (
    <div className="f0-overlay">
      <div className={`f0-command-palette ${isArabic ? 'rtl' : ''}`}>
        <div className="f0-command-header">
          <div className="f0-command-title">
            {isArabic ? 'لوحة الأوامر السريعة' : 'Command Palette'}
          </div>
          <div className="f0-command-shortcut">⇧⌘P</div>
        </div>

        <input
          ref={inputRef}
          className="f0-command-input"
          placeholder={
            isArabic
              ? 'اكتب أمرًا، مثل: تشغيل آخر أمر، فتح الإعدادات...'
              : 'Type a command, e.g. "run last command", "open settings"...'
          }
          value={query}
          autoFocus
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
        />

        <div className="f0-command-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="f0-command-empty">
              {isArabic ? 'لا توجد أوامر مطابقة' : 'No matching commands'}
            </div>
          ) : (
            filtered.map((cmd, index) => {
              const active = index === activeIndex;
              const icon = categoryIcons[cmd.category] || '📌';
              return (
                <button
                  key={cmd.id}
                  type="button"
                  className={`f0-command-item ${
                    active ? 'f0-command-item-active' : ''
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    onExecuteCommand(cmd.id);
                    onClose();
                  }}
                >
                  <div className="f0-command-main">
                    <span className="f0-command-icon">{icon}</span>
                    <span className="f0-command-label">
                      {isArabic ? cmd.labelAr : cmd.label}
                    </span>
                    {cmd.shortcut && (
                      <span className="f0-command-shortcut-badge">
                        {cmd.shortcut}
                      </span>
                    )}
                  </div>
                  {(cmd.description || cmd.descriptionAr) && (
                    <div className="f0-command-desc">
                      {isArabic
                        ? cmd.descriptionAr || cmd.description
                        : cmd.description || cmd.descriptionAr}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="f0-command-footer">
          <span>↑↓ {isArabic ? 'للتنقل' : 'Navigate'}</span>
          <span>↵ {isArabic ? 'للتنفيذ' : 'Execute'}</span>
          <span>Esc {isArabic ? 'للإغلاق' : 'Close'}</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
