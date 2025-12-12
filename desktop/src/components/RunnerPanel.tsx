/**
 * Phase 111.3: Runner Panel Component
 *
 * UI for running commands (dev/test/lint) in Desktop IDE
 * Shows live output stream with status indicators
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRunner, formatDuration } from '../hooks/useRunner';

// ============================================
// Types
// ============================================

// Phase 112.1: Runner finished payload for Agent context
export interface RunnerFinishedPayload {
  command: string;
  exitCode: number | null;
  duration: number | null;
  logs: Array<{ stream: 'stdout' | 'stderr'; chunk: string }>;
  status: 'success' | 'failed' | 'killed';
}

export interface RunnerPanelProps {
  projectPath: string | null;
  suggestedCommand?: string | null;
  onSuggestedCommandUsed?: () => void;
  onRunnerFinished?: (payload: RunnerFinishedPayload) => void; // Phase 112.1
  locale?: 'ar' | 'en';
}

// ============================================
// Default Commands (with nice labels)
// ============================================

const COMMAND_OPTIONS = [
  { value: 'pnpm dev', label: '🚀 Dev Server', labelAr: '🚀 سيرفر التطوير' },
  { value: 'pnpm test', label: '🧪 Tests', labelAr: '🧪 الاختبارات' },
  { value: 'pnpm lint', label: '🔍 Lint', labelAr: '🔍 فحص الكود' },
  { value: 'pnpm build', label: '📦 Build', labelAr: '📦 البناء' },
  { value: 'pnpm typecheck', label: '✅ TypeCheck', labelAr: '✅ فحص الأنواع' },
  { value: 'npx tsc --noEmit', label: '🔷 TSC', labelAr: '🔷 TypeScript' },
];

// ============================================
// Status Badge Component
// ============================================

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: string; color: string; bg: string }> = {
    idle: { icon: '⚪', color: 'text-gray-400', bg: 'bg-gray-500/20' },
    running: { icon: '🔄', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    success: { icon: '✅', color: 'text-green-400', bg: 'bg-green-500/20' },
    failed: { icon: '❌', color: 'text-red-400', bg: 'bg-red-500/20' },
    killed: { icon: '⏹️', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  };

  const { icon, color, bg } = config[status] || config.idle;

  return (
    <span className={`runner-status-badge ${color} ${bg}`}>
      {icon} {status}
    </span>
  );
}

// ============================================
// Runner Panel Component
// ============================================

export const RunnerPanel: React.FC<RunnerPanelProps> = ({
  projectPath,
  suggestedCommand,
  onSuggestedCommandUsed,
  onRunnerFinished, // Phase 112.1
  locale = 'ar',
}) => {
  const [command, setCommand] = useState('pnpm dev');
  const [customCommand, setCustomCommand] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [lastCommand, setLastCommand] = useState<string>(''); // Track last run command

  const logContainerRef = useRef<HTMLPreElement>(null);

  const { logs, status, exitCode, pid, error, duration, run, kill, clear } = useRunner();

  // Phase 112.1: Notify parent when run finishes
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;

    // Only fire when transitioning from 'running' to a finished state
    if (prevStatus === 'running' && (status === 'success' || status === 'failed' || status === 'killed')) {
      if (onRunnerFinished && lastCommand) {
        onRunnerFinished({
          command: lastCommand,
          exitCode,
          duration,
          logs: logs.map(l => ({ stream: l.stream, chunk: l.chunk })),
          status: status as 'success' | 'failed' | 'killed',
        });
        console.log('[RunnerPanel] Runner finished, notified parent:', { command: lastCommand, status, exitCode });
      }
    }
  }, [status, exitCode, duration, logs, lastCommand, onRunnerFinished]);

  const isArabic = locale === 'ar';

  // Labels
  const labels = {
    title: isArabic ? '🖥️ تشغيل الأوامر' : '🖥️ Command Runner',
    selectCommand: isArabic ? 'اختر الأمر:' : 'Select Command:',
    customCommand: isArabic ? 'أمر مخصص' : 'Custom',
    run: isArabic ? '▶️ تشغيل' : '▶️ Run',
    stop: isArabic ? '⏹️ إيقاف' : '⏹️ Stop',
    clear: isArabic ? '🗑️ مسح' : '🗑️ Clear',
    noProject: isArabic ? 'افتح مشروع أولاً' : 'Open a project first',
    running: isArabic ? 'جاري التشغيل...' : 'Running...',
    exitCode: isArabic ? 'كود الخروج:' : 'Exit code:',
    pid: isArabic ? 'معرف العملية:' : 'PID:',
    duration: isArabic ? 'المدة:' : 'Duration:',
    autoScroll: isArabic ? 'تمرير تلقائي' : 'Auto-scroll',
    useSuggested: isArabic ? '💡 استخدم اقتراح Agent' : '💡 Use Agent suggestion',
    noOutput: isArabic ? 'لا يوجد مخرجات بعد...' : 'No output yet...',
  };

  // Auto-scroll logs
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Handle suggested command from Agent
  // Phase 112.1: Always apply suggested command when it changes
  useEffect(() => {
    if (suggestedCommand) {
      // Check if it matches a preset
      const preset = COMMAND_OPTIONS.find((opt) => opt.value === suggestedCommand);
      if (preset) {
        setIsCustom(false);
        setCommand(suggestedCommand);
      } else {
        // Custom command - always apply it
        setIsCustom(true);
        setCustomCommand(suggestedCommand);
      }
      console.log('[RunnerPanel] Applied suggested command:', suggestedCommand);
    }
  }, [suggestedCommand]); // Remove isCustom dependency to always apply

  const handleRun = () => {
    if (!projectPath) return;
    const cmd = isCustom ? customCommand : command;
    if (!cmd.trim()) return;
    setLastCommand(cmd); // Phase 112.1: Track command for callback
    run(projectPath, cmd);
  };

  const handleUseSuggested = () => {
    if (!suggestedCommand || !projectPath) return;
    const preset = COMMAND_OPTIONS.find((opt) => opt.value === suggestedCommand);
    if (preset) {
      setIsCustom(false);
      setCommand(suggestedCommand);
    } else {
      setIsCustom(true);
      setCustomCommand(suggestedCommand);
    }
    setLastCommand(suggestedCommand); // Phase 112.1: Track command for callback
    run(projectPath, suggestedCommand);
    onSuggestedCommandUsed?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (status === 'running') {
        kill();
      } else {
        handleRun();
      }
    }
  };

  return (
    <div className="runner-panel">
      {/* Header */}
      <div className="runner-panel-header">
        <span className="runner-panel-title">{labels.title}</span>
        <StatusBadge status={status} />
        {duration !== null && status !== 'idle' && (
          <span className="runner-duration">{formatDuration(duration)}</span>
        )}
      </div>

      {/* Command Selection */}
      <div className="runner-controls">
        <div className="runner-command-row">
          {/* Preset Commands */}
          <select
            value={isCustom ? '__custom__' : command}
            onChange={(e) => {
              if (e.target.value === '__custom__') {
                setIsCustom(true);
              } else {
                setIsCustom(false);
                setCommand(e.target.value);
              }
            }}
            disabled={status === 'running'}
            className="runner-select"
          >
            {COMMAND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isArabic ? opt.labelAr : opt.label}
              </option>
            ))}
            <option value="__custom__">{labels.customCommand}</option>
          </select>

          {/* Custom Command Input */}
          {isCustom && (
            <input
              type="text"
              value={customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="pnpm test --watch"
              disabled={status === 'running'}
              className="runner-custom-input"
            />
          )}
        </div>

        {/* Action Buttons */}
        <div className="runner-actions">
          {status === 'running' ? (
            <button onClick={kill} className="runner-btn runner-btn-stop">
              {labels.stop}
            </button>
          ) : (
            <button
              onClick={handleRun}
              disabled={!projectPath}
              className="runner-btn runner-btn-run"
            >
              {labels.run}
            </button>
          )}

          <button
            onClick={clear}
            disabled={status === 'running'}
            className="runner-btn runner-btn-clear"
          >
            {labels.clear}
          </button>

          {/* Suggested command button */}
          {suggestedCommand && status !== 'running' && (
            <button
              onClick={handleUseSuggested}
              className="runner-btn runner-btn-suggested"
              title={suggestedCommand}
            >
              {labels.useSuggested}
            </button>
          )}
        </div>
      </div>

      {/* Status Info */}
      {(pid || exitCode !== null || error) && (
        <div className="runner-info">
          {pid && (
            <span className="runner-info-item">
              {labels.pid} {pid}
            </span>
          )}
          {exitCode !== null && (
            <span
              className={`runner-info-item ${exitCode === 0 ? 'text-green-400' : 'text-red-400'}`}
            >
              {labels.exitCode} {exitCode}
            </span>
          )}
          {error && <span className="runner-info-item text-red-400">⚠️ {error}</span>}
        </div>
      )}

      {/* Log Output */}
      <div className="runner-log-container">
        <div className="runner-log-header">
          <label className="runner-autoscroll">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            {labels.autoScroll}
          </label>
        </div>

        <pre ref={logContainerRef} className="runner-log">
          {logs.length === 0 && status === 'idle' ? (
            <span className="runner-log-placeholder">{labels.noOutput}</span>
          ) : (
            logs.map((log, i) => (
              <span
                key={i}
                className={log.stream === 'stderr' ? 'runner-log-stderr' : 'runner-log-stdout'}
              >
                {log.chunk}
              </span>
            ))
          )}
        </pre>
      </div>

      {/* No Project Warning */}
      {!projectPath && (
        <div className="runner-no-project">
          📂 {labels.noProject}
        </div>
      )}
    </div>
  );
};

export default RunnerPanel;
