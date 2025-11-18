/**
 * ErrorState - Displays error messages with retry option
 *
 * Shows when timeline data fails to load, with helpful error message
 * and optional retry button.
 */

export interface ErrorStateProps {
  /**
   * Error message to display (optional)
   */
  message?: string;

  /**
   * Callback when user clicks retry (optional)
   */
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="text-center py-10">
      <div className="text-6xl mb-4">⚠️</div>
      <div className="text-rose-400 font-medium mb-2">
        {message || "Something went wrong"}
      </div>
      <div className="text-sm text-white/60 mb-4">
        Unable to load timeline events
      </div>
      {onRetry && (
        <button
          className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/60"
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
}
