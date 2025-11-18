/**
 * KeyboardShortcuts Component
 *
 * Manages keyboard shortcuts for Timeline UI.
 * Invisible component that binds hotkeys on mount.
 */

"use client";

import { useEffect } from "react";
import { bindHotkeys } from "@/lib/hotkeys";

export interface KeyboardShortcutsProps {
  /**
   * Handler for opening first session (Cmd/Ctrl + K)
   */
  onOpenFirst: () => void;

  /**
   * Handler for closing modal (Escape)
   */
  onClose: () => void;

  /**
   * Handler for exporting current session (Cmd/Ctrl + E)
   */
  onExport: () => void;

  /**
   * Handler for refreshing timeline (Cmd/Ctrl + R)
   */
  onRefresh?: () => void;
}

export function KeyboardShortcuts({
  onOpenFirst,
  onClose,
  onExport,
  onRefresh,
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const shortcuts: Record<string, (e: KeyboardEvent) => void> = {
      // Cmd/Ctrl + K: Open first session
      "mod+k": onOpenFirst,

      // Escape: Close modal
      escape: onClose,

      // Cmd/Ctrl + E: Export session
      "mod+e": onExport,
    };

    // Add refresh shortcut if provided
    if (onRefresh) {
      shortcuts["mod+r"] = (e) => {
        // Prevent browser refresh
        e.preventDefault();
        onRefresh();
      };
    }

    // Bind all shortcuts
    const unbind = bindHotkeys(shortcuts);

    // Cleanup on unmount
    return unbind;
  }, [onOpenFirst, onClose, onExport, onRefresh]);

  // This component doesn't render anything
  return null;
}

/**
 * KeyboardShortcutsHelp Component
 *
 * Displays available keyboard shortcuts to the user.
 * Can be shown in a help modal or tooltip.
 */
export function KeyboardShortcutsHelp() {
  const shortcuts = [
    { keys: "⌘K / Ctrl+K", description: "Open first session" },
    { keys: "Esc", description: "Close modal" },
    { keys: "⌘E / Ctrl+E", description: "Export session" },
    { keys: "⌘R / Ctrl+R", description: "Refresh timeline" },
  ];

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="text-sm font-medium mb-3">Keyboard Shortcuts</div>
      <div className="space-y-2">
        {shortcuts.map((shortcut, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="opacity-70">{shortcut.description}</span>
            <kbd className="px-2 py-1 rounded-md bg-white/10 border border-white/20 font-mono">
              {shortcut.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
