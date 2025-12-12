// desktop/src/lib/keyboard/shortcuts.ts
// Phase 119.2: Global Keyboard Shortcuts for Preview Operations
// Enables muscle-memory shortcuts like Cmd+R for reload, Cmd+Opt+M for viewport cycle, etc.

import { COMMANDS, type CommandItem } from '../../commands/commandPalette';

/**
 * Normalize keyboard event to a shortcut string format
 * Returns format like: "⌘R", "⌘⇧R", "⌘⌥M", etc.
 */
export function normalizeKeyEvent(e: KeyboardEvent): string {
  const isMac = navigator.platform.toLowerCase().includes('mac');
  const parts: string[] = [];

  // Meta/Ctrl key (⌘ on Mac)
  if (isMac ? e.metaKey : e.ctrlKey) {
    parts.push('⌘');
  }

  // Shift key (⇧)
  if (e.shiftKey) {
    parts.push('⇧');
  }

  // Alt/Option key (⌥)
  if (e.altKey) {
    parts.push('⌥');
  }

  // The actual key - normalize to uppercase for letters
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;

  // Handle special keys
  const keyMap: Record<string, string> = {
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'Enter': '↵',
    'Escape': 'Esc',
    'Backspace': '⌫',
    'Delete': '⌦',
    'Tab': '⇥',
    ' ': 'Space',
  };

  parts.push(keyMap[e.key] || key);

  return parts.join('');
}

/**
 * Find a command by its shortcut string
 * @param shortcut The normalized shortcut string (e.g., "⌘R")
 * @param commands List of commands to search
 * @returns The matching command or undefined
 */
export function findCommandByShortcut(
  shortcut: string,
  commands: CommandItem[] = COMMANDS
): CommandItem | undefined {
  return commands.find((cmd) => cmd.shortcut === shortcut);
}

/**
 * Preview-specific shortcuts that need special handling
 * These are checked before the general command lookup
 */
export type PreviewShortcut = {
  shortcut: string;
  action: 'reload' | 'hard-reload' | 'cycle-viewport' | 'toggle-preview' | 'toggle-logs';
};

export const PREVIEW_SHORTCUTS: PreviewShortcut[] = [
  { shortcut: '⌘R', action: 'reload' },
  { shortcut: '⌘⇧R', action: 'hard-reload' },
  { shortcut: '⌘⌥M', action: 'cycle-viewport' },
  { shortcut: '⌘⌥P', action: 'toggle-preview' },
  { shortcut: '⌘⌥L', action: 'toggle-logs' },
];

/**
 * Check if the keyboard event matches a preview-specific shortcut
 * @returns The action to perform or null
 */
export function matchPreviewShortcut(e: KeyboardEvent): PreviewShortcut['action'] | null {
  const normalized = normalizeKeyEvent(e);
  const match = PREVIEW_SHORTCUTS.find((s) => s.shortcut === normalized);
  return match?.action ?? null;
}

/**
 * Check if focus is inside an input/textarea/contenteditable
 * We should not intercept shortcuts when user is typing
 */
export function isInputFocused(): boolean {
  const active = document.activeElement;
  if (!active) return false;

  const tagName = active.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea') {
    return true;
  }

  // Check for contenteditable
  if (active.getAttribute('contenteditable') === 'true') {
    return true;
  }

  // Check for Monaco editor (has role="textbox")
  if (active.getAttribute('role') === 'textbox') {
    return true;
  }

  return false;
}

/**
 * Check if a shortcut should be handled globally even in input fields
 * Some shortcuts like Cmd+R should always work
 */
export function isGlobalShortcut(shortcut: string): boolean {
  const globalShortcuts = ['⌘R', '⌘⇧R', '⌘⌥P', '⌘⌥B'];
  return globalShortcuts.includes(shortcut);
}
