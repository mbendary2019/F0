// desktop/src/components/cleanup/CleanupPanel.tsx
// Phase 129.3: Main Cleanup Panel - Combines Wizard, Running, and Summary
// Phase 133.4: Updated with matching theme, resizable, conditional positioning

import React, { useState, useCallback, useMemo, useRef } from 'react';
import type { CleanupSession, SessionHealthSnapshot } from '../../lib/cleanup/cleanupTypes';
import {
  runCleanupSession,
  cancelSession,
  createStepExecutors,
} from '../../lib/cleanup/cleanupOrchestrator';
import { CleanupWizard } from './CleanupWizard';
import { CleanupRunning } from './CleanupRunning';
import { CleanupSummary } from './CleanupSummary';

type PanelState = 'wizard' | 'running' | 'summary';

// Min/max dimensions
const MIN_WIDTH = 380;
const MIN_HEIGHT = 450;
const MAX_WIDTH = 700;
const MAX_HEIGHT = 800;

interface Props {
  locale?: 'ar' | 'en';
  projectRoot: string;
  fileCount: number;
  currentHealthScore?: number;

  // Callbacks for orchestrator
  onScanProject: () => Promise<{ filesScanned: number; totalIssues: number }>;
  onFixSafe: () => Promise<{ fixedCount: number }>;
  onFixTypes: () => Promise<{ fixedCount: number }>;
  onRunAcePhase: (phaseId: string) => Promise<{ success: boolean }>;
  onGetHealthSnapshot: () => SessionHealthSnapshot;
  onCreateSnapshot: () => Promise<string>;

  // UI callbacks
  onClose?: () => void;
  onViewIssues?: () => void;

  // Phase 133.4: Conditional positioning props
  isQualityPanelOpen?: boolean;
  qualityPanelWidth?: number;
  isTestsPanelOpen?: boolean;
  testsPanelWidth?: number;
}

export const CleanupPanel: React.FC<Props> = ({
  locale = 'en',
  projectRoot,
  fileCount,
  currentHealthScore,
  onScanProject,
  onFixSafe,
  onFixTypes,
  onRunAcePhase,
  onGetHealthSnapshot,
  onCreateSnapshot,
  onClose,
  onViewIssues,
  isQualityPanelOpen = false,
  qualityPanelWidth = 476,
  isTestsPanelOpen = false,
  testsPanelWidth = 420,
}) => {
  const isRTL = locale === 'ar';
  const [panelState, setPanelState] = useState<PanelState>('wizard');
  const [currentSession, setCurrentSession] = useState<CleanupSession | null>(null);
  const [progress, setProgress] = useState(0);

  // Resizable state
  const [size, setSize] = useState({ width: 420, height: 520 });
  const panelRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef<'right' | 'top' | 'corner' | null>(null);
  const startPos = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, direction: 'right' | 'top' | 'corner') => {
      e.preventDefault();
      e.stopPropagation();
      isResizing.current = direction;
      startPos.current = {
        x: e.clientX,
        y: e.clientY,
        width: size.width,
        height: size.height,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return;

        const deltaX = moveEvent.clientX - startPos.current.x;
        const deltaY = startPos.current.y - moveEvent.clientY; // Inverted for top resize

        let newWidth = startPos.current.width;
        let newHeight = startPos.current.height;

        if (isResizing.current === 'right' || isResizing.current === 'corner') {
          newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startPos.current.width + deltaX));
        }
        if (isResizing.current === 'top' || isResizing.current === 'corner') {
          newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startPos.current.height + deltaY));
        }

        setSize({ width: newWidth, height: newHeight });
      };

      const handleMouseUp = () => {
        isResizing.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor =
        direction === 'corner' ? 'ne-resize' : direction === 'right' ? 'ew-resize' : 'ns-resize';
      document.body.style.userSelect = 'none';
    },
    [size]
  );

  // Create step executors
  const executors = useMemo(() => createStepExecutors({
    scanProject: onScanProject,
    fixSafe: onFixSafe,
    fixTypes: onFixTypes,
    runAcePhase: onRunAcePhase,
    getHealthSnapshot: onGetHealthSnapshot,
    createSnapshot: onCreateSnapshot,
  }), [onScanProject, onFixSafe, onFixTypes, onRunAcePhase, onGetHealthSnapshot, onCreateSnapshot]);

  // Handle session start
  const handleStartSession = useCallback(async (session: CleanupSession) => {
    console.log('[CleanupPanel] Starting session:', session.id);
    setCurrentSession(session);
    setPanelState('running');
    setProgress(0);

    try {
      const completedSession = await runCleanupSession(
        session,
        executors,
        {
          getHealthSnapshot: onGetHealthSnapshot,
          createSnapshot: onCreateSnapshot,
          onStepStart: (step, sess) => {
            console.log('[CleanupPanel] Step started:', step.id);
            setCurrentSession({ ...sess });
          },
          onStepComplete: (step, sess) => {
            console.log('[CleanupPanel] Step completed:', step.id);
            setCurrentSession({ ...sess });
          },
          onProgress: (sess, prog) => {
            setProgress(prog);
            setCurrentSession({ ...sess });
          },
          onComplete: (sess) => {
            console.log('[CleanupPanel] Session completed');
            setCurrentSession({ ...sess });
            setPanelState('summary');
          },
          onError: (error, sess) => {
            console.error('[CleanupPanel] Error:', error);
            setCurrentSession({ ...sess });
          },
        }
      );

      setCurrentSession(completedSession);
    } catch (err) {
      console.error('[CleanupPanel] Session failed:', err);
      if (currentSession) {
        currentSession.status = 'failed';
        setCurrentSession({ ...currentSession });
      }
      setPanelState('summary');
    }
  }, [executors, onGetHealthSnapshot, onCreateSnapshot, currentSession]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (currentSession && panelState === 'running') {
      const cancelled = cancelSession(currentSession);
      setCurrentSession({ ...cancelled });
      setPanelState('summary');
    }
  }, [currentSession, panelState]);

  // Handle start new
  const handleStartNew = useCallback(() => {
    setCurrentSession(null);
    setProgress(0);
    setPanelState('wizard');
  }, []);

  // Calculate left position based on open panels
  const calculateLeftPosition = useCallback(() => {
    let offset = 16; // Base offset from edge
    if (isQualityPanelOpen) {
      offset += qualityPanelWidth + 16; // Quality panel width + gap
    }
    if (isTestsPanelOpen) {
      offset += testsPanelWidth + 16; // Tests panel width + gap
    }
    return offset;
  }, [isQualityPanelOpen, qualityPanelWidth, isTestsPanelOpen, testsPanelWidth]);

  const leftPosition = calculateLeftPosition();

  return (
    <div
      ref={panelRef}
      className="fixed bottom-4 z-50 flex flex-col bg-[#050016] text-white rounded-2xl overflow-hidden border border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.25),0_0_40px_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.5)]"
      style={{
        width: size.width,
        height: size.height,
        left: leftPosition,
        transition: 'left 0.3s ease-out',
      }}
    >
      {/* Resize Handles */}
      {/* Right edge */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-amber-500/20 transition-colors z-10"
        onMouseDown={(e) => handleResizeStart(e, 'right')}
      />
      {/* Top edge */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-amber-500/20 transition-colors z-10"
        onMouseDown={(e) => handleResizeStart(e, 'top')}
      />
      {/* Top-right corner */}
      <div
        className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize hover:bg-amber-500/30 transition-colors z-20"
        onMouseDown={(e) => handleResizeStart(e, 'corner')}
      />

      {/* Header */}
      <div className="relative border-b border-[#3d2c14] bg-gradient-to-r from-[#1a1205] via-[#2a1c0a] to-[#1a1205] px-4 py-3 shadow-[0_0_24px_rgba(245,158,11,0.35)] rounded-t-2xl ring-1 ring-amber-500/30">
        {/* Neon glow behind header */}
        <div className="pointer-events-none absolute -inset-x-6 -top-4 h-10 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.35),_transparent_60%)] opacity-80 blur-xl -z-10" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧹</span>
            <div>
              <h2 className="text-sm font-semibold">
                {isRTL ? 'جلسة التنظيف' : 'Guided Cleanup Session'}
              </h2>
              <p className="text-[10px] text-white/55">
                {panelState === 'wizard'
                  ? isRTL ? 'اختر مستوى التنظيف' : 'Configure cleanup level'
                  : panelState === 'running'
                  ? isRTL ? 'جارٍ التنظيف...' : 'Cleanup in progress...'
                  : isRTL ? 'اكتملت الجلسة' : 'Session complete'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Progress indicator during running */}
            {panelState === 'running' && (
              <span className="text-[11px] text-amber-300 font-medium">
                {Math.round(progress)}%
              </span>
            )}
            {onClose && (
              <button
                className="rounded-md p-1.5 text-white/50 transition-all hover:bg-white/10 hover:text-white"
                onClick={onClose}
                aria-label="Close"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[#030010] scrollbar-thin p-4">
        {/* Wizard state */}
        {panelState === 'wizard' && (
          <CleanupWizard
            locale={locale}
            projectRoot={projectRoot}
            fileCount={fileCount}
            currentHealthScore={currentHealthScore}
            onStart={handleStartSession}
            onCancel={onClose || (() => {})}
          />
        )}

        {/* Running state */}
        {panelState === 'running' && currentSession && (
          <CleanupRunning
            locale={locale}
            session={currentSession}
            progress={progress}
            onCancel={handleCancel}
          />
        )}

        {/* Summary state */}
        {panelState === 'summary' && currentSession && (
          <CleanupSummary
            locale={locale}
            session={currentSession}
            onClose={onClose}
            onViewIssues={onViewIssues}
            onStartNew={handleStartNew}
          />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[#3d2c14] bg-[#050016] px-4 py-2 text-[10px] text-white/40 flex items-center justify-between">
        <span>
          {fileCount} {isRTL ? 'ملف' : 'files'} • {currentHealthScore ?? '--'}% {isRTL ? 'صحة' : 'health'}
        </span>
        {currentSession && (
          <span className="flex items-center gap-1">
            {currentSession.status === 'completed' ? (
              <span className="text-amber-400">✓ {isRTL ? 'اكتمل' : 'Complete'}</span>
            ) : currentSession.status === 'failed' ? (
              <span className="text-red-400">✗ {isRTL ? 'فشل' : 'Failed'}</span>
            ) : currentSession.status === 'running' ? (
              <span className="text-amber-300">⋯ {isRTL ? 'جارٍ' : 'Running'}</span>
            ) : (
              <span className="text-white/50">– {isRTL ? 'انتظار' : 'Pending'}</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
};
