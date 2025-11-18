/**
 * CopyJson Component
 *
 * Quick button to copy any object as formatted JSON to clipboard.
 * Useful for debugging and sharing event data.
 */

"use client";

import { useState } from "react";

export interface CopyJsonProps {
  /**
   * Value to copy (will be JSON.stringify'd)
   */
  value: unknown;

  /**
   * Button label (default: "Copy JSON")
   */
  label?: string;
}

export function CopyJson({ value, label = "Copy JSON" }: CopyJsonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const text = JSON.stringify(value, null, 2);
      await navigator.clipboard.writeText(text);

      // Show feedback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy JSON:", err);
      alert("Failed to copy JSON");
    }
  };

  return (
    <button
      className="px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-colors text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/60"
      onClick={handleCopy}
      aria-label={label}
      title={label}
    >
      {copied ? "✓ Copied!" : "📋 " + label}
    </button>
  );
}
