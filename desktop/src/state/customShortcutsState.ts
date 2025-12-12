// desktop/src/state/customShortcutsState.ts
// Phase 119.3: Custom Keyboard Shortcuts State Management
// Allows users to customize keyboard shortcuts via Settings

import { create } from 'zustand';
import { COMMANDS, type CommandItem } from '../commands/commandPalette';

// Storage key for localStorage
const STORAGE_KEY = 'f0_custom_shortcuts';

// Type for custom shortcuts mapping: commandId -> shortcut string
export type CustomShortcuts = Record<string, string>;

// Get default shortcuts from commands
function getDefaultShortcuts(): CustomShortcuts {
  const defaults: CustomShortcuts = {};
  for (const cmd of COMMANDS) {
    if (cmd.shortcut) {
      defaults[cmd.id] = cmd.shortcut;
    }
  }
  return defaults;
}

// Load from localStorage
function loadFromStorage(): CustomShortcuts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultShortcuts();
    const parsed = JSON.parse(raw) as CustomShortcuts;
    // Merge with defaults to ensure all commands have shortcuts
    return { ...getDefaultShortcuts(), ...parsed };
  } catch (e) {
    console.warn('[customShortcutsState] Failed to load:', e);
    return getDefaultShortcuts();
  }
}

// Save to localStorage
function saveToStorage(shortcuts: CustomShortcuts): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
  } catch (e) {
    console.warn('[customShortcutsState] Failed to save:', e);
  }
}

interface CustomShortcutsState {
  shortcuts: CustomShortcuts;

  // Get shortcut for a command
  getShortcut: (commandId: string) => string | undefined;

  // Set custom shortcut for a command
  setShortcut: (commandId: string, shortcut: string) => void;

  // Reset a single command to default
  resetShortcut: (commandId: string) => void;

  // Reset all shortcuts to defaults
  resetAll: () => void;

  // Find command by shortcut (for handler)
  findCommandByShortcut: (shortcut: string) => CommandItem | undefined;

  // Check if shortcut is already used by another command
  isShortcutUsed: (shortcut: string, excludeCommandId?: string) => string | undefined;
}

export const useCustomShortcuts = create<CustomShortcutsState>((set, get) => ({
  shortcuts: loadFromStorage(),

  getShortcut: (commandId: string) => {
    return get().shortcuts[commandId];
  },

  setShortcut: (commandId: string, shortcut: string) => {
    set((state) => {
      const newShortcuts = { ...state.shortcuts, [commandId]: shortcut };
      saveToStorage(newShortcuts);
      return { shortcuts: newShortcuts };
    });
  },

  resetShortcut: (commandId: string) => {
    const defaults = getDefaultShortcuts();
    const defaultShortcut = defaults[commandId];
    if (defaultShortcut) {
      set((state) => {
        const newShortcuts = { ...state.shortcuts, [commandId]: defaultShortcut };
        saveToStorage(newShortcuts);
        return { shortcuts: newShortcuts };
      });
    }
  },

  resetAll: () => {
    const defaults = getDefaultShortcuts();
    saveToStorage(defaults);
    set({ shortcuts: defaults });
  },

  findCommandByShortcut: (shortcut: string) => {
    const { shortcuts } = get();
    // Find command ID that has this shortcut
    const commandId = Object.entries(shortcuts).find(
      ([, s]) => s === shortcut
    )?.[0];
    if (!commandId) return undefined;
    return COMMANDS.find((cmd) => cmd.id === commandId);
  },

  isShortcutUsed: (shortcut: string, excludeCommandId?: string) => {
    const { shortcuts } = get();
    const entry = Object.entries(shortcuts).find(
      ([id, s]) => s === shortcut && id !== excludeCommandId
    );
    return entry?.[0];
  },
}));

// Helper: Get default shortcut for a command
export function getDefaultShortcut(commandId: string): string | undefined {
  const cmd = COMMANDS.find((c) => c.id === commandId);
  return cmd?.shortcut;
}

// Helper: Format shortcut for display (already in symbol format)
export function formatShortcut(shortcut: string): string {
  return shortcut;
}

// Helper: Parse user input to shortcut format
export function parseShortcutInput(input: string): string {
  // Convert common text formats to symbols
  return input
    .replace(/cmd/gi, '⌘')
    .replace(/command/gi, '⌘')
    .replace(/ctrl/gi, '⌘')
    .replace(/alt/gi, '⌥')
    .replace(/option/gi, '⌥')
    .replace(/shift/gi, '⇧')
    .replace(/\+/g, '')
    .replace(/\s/g, '')
    .toUpperCase()
    // Ensure symbols are in correct order: ⌘⇧⌥ then key
    .replace(/([⌘⇧⌥]*)([^⌘⇧⌥]+)/, (_, mods, key) => {
      const modOrder = ['⌘', '⇧', '⌥'];
      const sortedMods = modOrder.filter((m) => mods.includes(m)).join('');
      return sortedMods + key;
    });
}
