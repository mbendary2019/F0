/**
 * CopyLink - Button to copy deep link to session
 *
 * Generates and copies a shareable URL to the session timeline view.
 * Useful for sharing specific sessions with team members.
 */

export interface CopyLinkProps {
  /**
   * Session ID to link to
   */
  sessionId: string;
}

export function CopyLink({ sessionId }: CopyLinkProps) {
  const href =
    typeof window !== "undefined"
      ? `${window.location.origin}/ops/timeline?sessionId=${sessionId}`
      : `?sessionId=${sessionId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      // Simple alert - could be replaced with toast notification
      alert("Link copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy link:", err);
      alert("Failed to copy link");
    }
  };

  return (
    <button
      className="px-3 py-1 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/60"
      onClick={handleCopy}
      aria-label={`Copy deep link to session ${sessionId}`}
      title="Copy shareable link"
    >
      🔗 Copy Link
    </button>
  );
}
