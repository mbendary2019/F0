/**
 * Hotkeys Utility
 *
 * Simple keyboard shortcuts manager for Timeline UI.
 * Supports modifier keys (Ctrl/Cmd, Shift) and standard keys.
 */

export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

/**
 * Binds keyboard shortcuts to handlers
 *
 * @param map - Object mapping key combinations to handler functions
 * @returns Cleanup function to unbind all handlers
 *
 * @example
 * const unbind = bindHotkeys({
 *   "mod+k": () => openFirstSession(),
 *   "escape": () => closeModal(),
 *   "mod+e": () => exportSession()
 * });
 *
 * // Later, cleanup:
 * unbind();
 *
 * Key format:
 * - "mod" = Ctrl on Windows/Linux, Cmd on Mac
 * - "shift" = Shift key
 * - Combine with "+": "mod+shift+k"
 * - Keys are lowercase: "escape", "k", "enter"
 */
export function bindHotkeys(map: HotkeyMap): () => void {
  const handler = (e: KeyboardEvent) => {
    // Build key combination string
    const parts: string[] = [];

    // Add modifiers
    if (e.ctrlKey || e.metaKey) parts.push("mod");
    if (e.shiftKey) parts.push("shift");
    if (e.altKey) parts.push("alt");

    // Add the actual key (lowercase)
    parts.push(e.key.toLowerCase());

    // Join into key combination (e.g., "mod+shift+k")
    const key = parts.join("+");

    // Check if we have a handler for this combination
    if (map[key]) {
      e.preventDefault();
      map[key](e);
    }
  };

  // Bind to window
  window.addEventListener("keydown", handler);

  // Return cleanup function
  return () => window.removeEventListener("keydown", handler);
}

/**
 * Formats a hotkey for display
 *
 * @param key - Key combination string (e.g., "mod+k")
 * @returns Formatted string for display (e.g., "⌘K" or "Ctrl+K")
 *
 * @example
 * formatHotkey("mod+k")  // "⌘K" on Mac, "Ctrl+K" on Windows
 * formatHotkey("escape") // "Esc"
 */
export function formatHotkey(key: string): string {
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

  return key
    .split("+")
    .map((part) => {
      switch (part) {
        case "mod":
          return isMac ? "⌘" : "Ctrl";
        case "shift":
          return isMac ? "⇧" : "Shift";
        case "alt":
          return isMac ? "⌥" : "Alt";
        case "escape":
          return "Esc";
        case "enter":
          return "Enter";
        default:
          return part.toUpperCase();
      }
    })
    .join(isMac ? "" : "+");
}
