// desktop/src/components/KeyboardShortcutsSettings.tsx
// Phase 119.3: Keyboard Shortcuts Settings Component
// Allows users to view and customize keyboard shortcuts

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { COMMANDS, type CommandItem, type CommandCategory } from '../commands/commandPalette';
import {
  useCustomShortcuts,
  getDefaultShortcut,
} from '../state/customShortcutsState';
import { normalizeKeyEvent } from '../lib/keyboard/shortcuts';

type KeyboardShortcutsSettingsProps = {
  locale?: string;
};

// Category labels
const CATEGORY_LABELS: Record<CommandCategory, { en: string; ar: string }> = {
  navigation: { en: 'Navigation', ar: 'التنقل' },
  runner: { en: 'Runner', ar: 'المشغل' },
  agent: { en: 'Agent', ar: 'الوكيل' },
  view: { en: 'View', ar: 'العرض' },
  system: { en: 'System', ar: 'النظام' },
  preview: { en: 'Preview', ar: 'المعاينة' },
};

// Group commands by category
function groupByCategory(commands: CommandItem[]): Record<CommandCategory, CommandItem[]> {
  const groups: Record<CommandCategory, CommandItem[]> = {
    navigation: [],
    runner: [],
    agent: [],
    view: [],
    system: [],
    preview: [],
  };

  for (const cmd of commands) {
    // Only show commands that have shortcuts
    if (cmd.shortcut || getDefaultShortcut(cmd.id)) {
      groups[cmd.category].push(cmd);
    }
  }

  return groups;
}

// Shortcut editor row component
type ShortcutRowProps = {
  command: CommandItem;
  currentShortcut: string | undefined;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (shortcut: string) => void;
  onCancel: () => void;
  onReset: () => void;
  conflictWith?: string;
  locale: string;
};

const ShortcutRow: React.FC<ShortcutRowProps> = ({
  command,
  currentShortcut,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onReset,
  conflictWith,
  locale,
}) => {
  const isArabic = locale === 'ar';
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(currentShortcut || '');
  const [recordedShortcut, setRecordedShortcut] = useState<string | null>(null);

  const defaultShortcut = getDefaultShortcut(command.id);
  const isModified = currentShortcut !== defaultShortcut;

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      setInputValue(currentShortcut || '');
      setRecordedShortcut(null);
    }
  }, [isEditing, currentShortcut]);

  // Handle key recording
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape to cancel
      if (e.key === 'Escape') {
        onCancel();
        return;
      }

      // Enter to confirm
      if (e.key === 'Enter' && recordedShortcut) {
        onSave(recordedShortcut);
        return;
      }

      // Record the shortcut
      const shortcut = normalizeKeyEvent(e.nativeEvent);

      // Must have at least a modifier
      if (!shortcut.includes('⌘') && !shortcut.includes('⌥') && !shortcut.includes('⇧')) {
        return;
      }

      // Must have a non-modifier key
      const modifiers = ['⌘', '⇧', '⌥'];
      const hasNonModifier = shortcut.split('').some((char) => !modifiers.includes(char));
      if (!hasNonModifier) {
        return;
      }

      setRecordedShortcut(shortcut);
      setInputValue(shortcut);
    },
    [recordedShortcut, onSave, onCancel]
  );

  return (
    <div
      className={`flex items-center justify-between py-2 px-3 rounded-lg transition ${
        isEditing ? 'bg-purple-500/20 ring-1 ring-purple-500/50' : 'hover:bg-white/5'
      }`}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {/* Command info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white/90 truncate">
          {isArabic ? command.labelAr : command.label}
        </div>
        {command.description && (
          <div className="text-xs text-white/50 truncate">
            {isArabic ? command.descriptionAr : command.description}
          </div>
        )}
      </div>

      {/* Shortcut display/editor */}
      <div className="flex items-center gap-2 ml-4">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              readOnly
              placeholder={isArabic ? 'اضغط الاختصار...' : 'Press shortcut...'}
              onKeyDown={handleKeyDown}
              className="w-28 px-2 py-1 text-sm text-center bg-black/40 border border-purple-500/50 rounded text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            {conflictWith && (
              <span className="text-xs text-red-400">
                {isArabic ? 'مستخدم!' : 'Used!'}
              </span>
            )}
            <button
              onClick={() => recordedShortcut && onSave(recordedShortcut)}
              disabled={!recordedShortcut || !!conflictWith}
              className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
            >
              {isArabic ? 'حفظ' : 'Save'}
            </button>
            <button
              onClick={onCancel}
              className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded text-white/70"
            >
              {isArabic ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onStartEdit}
              className={`px-3 py-1 text-sm font-mono rounded transition ${
                currentShortcut
                  ? 'bg-white/10 text-white/90 hover:bg-white/20'
                  : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >
              {currentShortcut || (isArabic ? 'غير محدد' : 'Not set')}
            </button>
            {isModified && (
              <button
                onClick={onReset}
                className="p-1 text-white/40 hover:text-white/70 transition"
                title={isArabic ? 'إعادة للافتراضي' : 'Reset to default'}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const KeyboardShortcutsSettings: React.FC<KeyboardShortcutsSettingsProps> = ({
  locale = 'en',
}) => {
  const isArabic = locale === 'ar';
  const { shortcuts, setShortcut, resetShortcut, resetAll, isShortcutUsed } =
    useCustomShortcuts();

  const [editingCommand, setEditingCommand] = useState<string | null>(null);
  const [tempShortcut, setTempShortcut] = useState<string | null>(null);

  const groupedCommands = groupByCategory(COMMANDS);

  // Check for conflicts
  const conflictWith = tempShortcut
    ? isShortcutUsed(tempShortcut, editingCommand || undefined)
    : undefined;

  const handleStartEdit = useCallback((commandId: string) => {
    setEditingCommand(commandId);
    setTempShortcut(null);
  }, []);

  const handleSave = useCallback(
    (commandId: string, shortcut: string) => {
      setShortcut(commandId, shortcut);
      setEditingCommand(null);
      setTempShortcut(null);
    },
    [setShortcut]
  );

  const handleCancel = useCallback(() => {
    setEditingCommand(null);
    setTempShortcut(null);
  }, []);

  const handleReset = useCallback(
    (commandId: string) => {
      resetShortcut(commandId);
    },
    [resetShortcut]
  );

  const handleResetAll = useCallback(() => {
    if (
      window.confirm(
        isArabic
          ? 'هل تريد إعادة جميع الاختصارات للإعدادات الافتراضية؟'
          : 'Reset all shortcuts to defaults?'
      )
    ) {
      resetAll();
    }
  }, [resetAll, isArabic]);

  return (
    <div className="space-y-6" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          {isArabic ? 'اختصارات لوحة المفاتيح' : 'Keyboard Shortcuts'}
        </h3>
        <button
          onClick={handleResetAll}
          className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition"
        >
          {isArabic ? 'إعادة الكل للافتراضي' : 'Reset All'}
        </button>
      </div>

      {/* Instructions */}
      <div className="text-sm text-white/50 bg-white/5 rounded-lg p-3">
        {isArabic
          ? 'انقر على أي اختصار لتغييره. اضغط على المفاتيح الجديدة ثم اضغط Enter للحفظ أو Escape للإلغاء.'
          : 'Click any shortcut to change it. Press the new keys, then Enter to save or Escape to cancel.'}
      </div>

      {/* Categories */}
      {Object.entries(groupedCommands).map(([category, commands]) => {
        if (commands.length === 0) return null;

        const categoryKey = category as CommandCategory;
        const label = CATEGORY_LABELS[categoryKey];

        return (
          <div key={category} className="space-y-2">
            <h4 className="text-sm font-medium text-purple-400 uppercase tracking-wide">
              {isArabic ? label.ar : label.en}
            </h4>
            <div className="space-y-1 bg-white/5 rounded-lg p-2">
              {commands.map((cmd) => (
                <ShortcutRow
                  key={cmd.id}
                  command={cmd}
                  currentShortcut={shortcuts[cmd.id]}
                  isEditing={editingCommand === cmd.id}
                  onStartEdit={() => handleStartEdit(cmd.id)}
                  onSave={(shortcut) => handleSave(cmd.id, shortcut)}
                  onCancel={handleCancel}
                  onReset={() => handleReset(cmd.id)}
                  conflictWith={
                    editingCommand === cmd.id ? conflictWith : undefined
                  }
                  locale={locale}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KeyboardShortcutsSettings;
