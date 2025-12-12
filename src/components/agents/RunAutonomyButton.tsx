// src/components/agents/RunAutonomyButton.tsx
// =============================================================================
// Phase 155.7 – RunAutonomyButton
// Button to trigger autonomous agent flow from Web IDE
// =============================================================================

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Play, Sparkles } from 'lucide-react';

interface RunAutonomyButtonProps {
  projectId: string;
  goal?: string;
  onStarted?: (planId: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

interface RunPlanResponse {
  success: boolean;
  messageId?: string;
  planId?: string; // Legacy support
  error?: string;
}

export function RunAutonomyButton({
  projectId,
  goal,
  onStarted,
  onError,
  disabled = false,
  variant = 'default',
  size = 'default',
  className = '',
}: RunAutonomyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [inputGoal, setInputGoal] = useState(goal || '');
  const [showInput, setShowInput] = useState(!goal);

  const handleRun = async () => {
    const targetGoal = goal || inputGoal.trim();

    if (!targetGoal) {
      onError?.('Please enter a goal');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/agents/run-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          goal: targetGoal,
        }),
      });

      const data: RunPlanResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start plan');
      }

      const id = data.messageId || data.planId || 'unknown';
      console.log('[155.7][UI] Plan started:', id);
      onStarted?.(id);

      // Reset input if it was user-provided
      if (!goal) {
        setInputGoal('');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[155.7][UI] Error starting plan:', message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  // Simple button if goal is pre-set
  if (goal) {
    return (
      <Button
        onClick={handleRun}
        disabled={disabled || loading}
        variant={variant}
        size={size}
        className={className}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Running...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Run Autonomy
          </>
        )}
      </Button>
    );
  }

  // With input field
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {showInput && (
        <div className="flex gap-2">
          <input
            type="text"
            value={inputGoal}
            onChange={(e) => setInputGoal(e.target.value)}
            placeholder="Enter goal (e.g., Add login feature)"
            className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) {
                handleRun();
              }
            }}
          />
          <Button
            onClick={handleRun}
            disabled={disabled || loading || !inputGoal.trim()}
            variant={variant}
            size={size}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      {!showInput && (
        <Button
          onClick={() => setShowInput(true)}
          disabled={disabled}
          variant="outline"
          size={size}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          New Autonomy Task
        </Button>
      )}
    </div>
  );
}

// Compact version for toolbars
export function RunAutonomyIconButton({
  projectId,
  goal,
  onStarted,
  onError,
  disabled = false,
}: Omit<RunAutonomyButtonProps, 'variant' | 'size' | 'className'>) {
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    if (!goal) {
      onError?.('Goal is required for icon button');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/agents/run-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, goal }),
      });

      const data: RunPlanResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start plan');
      }

      const id = data.messageId || data.planId || 'unknown';
      onStarted?.(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleRun}
      disabled={disabled || loading}
      variant="ghost"
      size="icon"
      title={goal || 'Run autonomy'}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
    </Button>
  );
}

console.log('[155.7][UI] RunAutonomyButton module loaded');
