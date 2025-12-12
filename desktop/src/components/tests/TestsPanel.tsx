// desktop/src/components/tests/TestsPanel.tsx
// Phase 130.4: Main Tests Panel Component
// Phase 133.2: Updated with matching theme, resizable, conditional positioning
// Phase 133.3: Added auto-run settings toggles

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTests } from '../../state/testResultsContext';
import { useTestSettings } from '../../state/testSettingsContext';
import { TestsOverviewTab } from './TestsOverviewTab';
import { TestsRunsTab } from './TestsRunsTab';
import { TestsFailuresTab } from './TestsFailuresTab';

type TabId = 'overview' | 'runs' | 'failures' | 'settings';

// Min/max dimensions
const MIN_WIDTH = 340;
const MIN_HEIGHT = 400;
const MAX_WIDTH = 800;
const MAX_HEIGHT = 900;

interface Props {
  locale?: 'ar' | 'en';
  onClose?: () => void;
  onOpenFile?: (filePath: string, line?: number) => void;
  /** When true, position panel to the right of QualityPanel */
  isQualityPanelOpen?: boolean;
  /** Width of quality panel to offset (default 476) */
  qualityPanelWidth?: number;
  /** Phase 133.4: Callback when panel width changes (for CleanupPanel positioning) */
  onWidthChange?: (width: number) => void;
}

export const TestsPanel: React.FC<Props> = ({
  locale = 'en',
  onClose,
  onOpenFile,
  isQualityPanelOpen = false,
  qualityPanelWidth = 476,
  onWidthChange,
}) => {
  const isRTL = locale === 'ar';
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Resizable state
  const [size, setSize] = useState({ width: 420, height: 520 });
  const panelRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef<'right' | 'top' | 'corner' | null>(null);
  const startPos = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const {
    meta,
    isDiscovering,
    hasTests,
    isRunning,
    currentRun,
    currentOutput,
    runs,
    lastRun,
    passRate,
    totalRuns,
    lastStatus,
    runAllTests,
    runSuite,
    refreshTests,
    cancelRun,
  } = useTests();

  // Phase 133.3: Test settings for auto-run
  const { settings, toggleSetting } = useTestSettings();

  // Phase 133.4: Notify parent when width changes (for CleanupPanel positioning)
  useEffect(() => {
    onWidthChange?.(size.width);
  }, [size.width, onWidthChange]);

  const suites = meta?.suites ?? [];
  const failures = currentRun?.failures ?? [];

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

  const handleRunAll = useCallback(async () => {
    try {
      await runAllTests();
    } catch (err) {
      console.error('[TestsPanel] Run all failed:', err);
    }
  }, [runAllTests]);

  const handleRunSuite = useCallback(async (suiteId: string) => {
    try {
      await runSuite(suiteId);
    } catch (err) {
      console.error('[TestsPanel] Run suite failed:', err);
    }
  }, [runSuite]);

  const handleRefresh = useCallback(async () => {
    try {
      await refreshTests();
    } catch (err) {
      console.error('[TestsPanel] Refresh failed:', err);
    }
  }, [refreshTests]);

  const tabs: { id: TabId; label: string; labelAr: string; badge?: number; icon?: string }[] = [
    { id: 'overview', label: 'Overview', labelAr: 'نظرة عامة' },
    { id: 'runs', label: 'Runs', labelAr: 'التشغيلات', badge: runs.length },
    { id: 'failures', label: 'Failures', labelAr: 'الفشل', badge: failures.length },
    { id: 'settings', label: 'Auto', labelAr: 'تلقائي', icon: '⚙️' },
  ];

  // Calculate left position based on whether QualityPanel is open
  const leftPosition = isQualityPanelOpen ? qualityPanelWidth + 24 : 16; // 24px gap between panels

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
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-emerald-500/20 transition-colors z-10"
        onMouseDown={(e) => handleResizeStart(e, 'right')}
      />
      {/* Top edge */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-emerald-500/20 transition-colors z-10"
        onMouseDown={(e) => handleResizeStart(e, 'top')}
      />
      {/* Top-right corner */}
      <div
        className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize hover:bg-emerald-500/30 transition-colors z-20"
        onMouseDown={(e) => handleResizeStart(e, 'corner')}
      />

      {/* Header */}
      <div className="relative border-b border-[#1a4734] bg-gradient-to-r from-[#071a12] via-[#0a2a1c] to-[#071a12] px-4 py-3 shadow-[0_0_24px_rgba(16,185,129,0.35)] rounded-t-2xl ring-1 ring-emerald-500/30">
        {/* Neon glow behind header */}
        <div className="pointer-events-none absolute -inset-x-6 -top-4 h-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.35),_transparent_60%)] opacity-80 blur-xl -z-10" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧪</span>
            <div>
              <h2 className="text-sm font-semibold">
                {isRTL ? 'الاختبارات' : 'Tests'}
              </h2>
              <p className="text-[10px] text-white/55">
                {isRTL ? 'تشغيل وتتبع الاختبارات' : 'Run and track test suites'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 hover:border-emerald-400/50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleRunAll}
              disabled={isRunning || !hasTests}
            >
              {isRunning
                ? isRTL ? 'جارٍ...' : 'Running...'
                : isRTL ? '▶ تشغيل الكل' : '▶ Run All'}
            </button>
            <button
              className="rounded-full border border-white/15 px-2 py-1.5 text-[11px] text-white/70 transition-colors hover:border-white/30 hover:bg-white/5 disabled:opacity-50"
              onClick={handleRefresh}
              disabled={isDiscovering}
            >
              🔄
            </button>
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

        {/* Tabs */}
        <div className="mt-3 flex gap-1.5 text-[11px]">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white shadow-[0_0_12px_rgba(255,255,255,0.18)]'
                    : 'bg-white/3 text-white/60 hover:bg-white/8 hover:text-white/80'
                }`}
              >
                {isRTL ? tab.labelAr : tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                      tab.id === 'failures'
                        ? 'bg-red-500/30 text-red-300'
                        : 'bg-white/10 text-white/70'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto bg-[#030010] scrollbar-thin">
        {/* Running State Overlay */}
        {isRunning && (
          <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
              <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-b-emerald-300/50 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <div className="text-sm text-white/80 font-medium">
              {isRTL ? 'جارٍ تشغيل الاختبارات...' : 'Running tests...'}
            </div>
            <div className="w-full max-w-xs bg-black/40 rounded-lg p-2 font-mono text-[10px] text-emerald-400/70 max-h-24 overflow-y-auto">
              {currentOutput.slice(-10).map((line, i) => (
                <div key={i} className="truncate">{line}</div>
              ))}
            </div>
            <button
              className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-[11px] text-red-300 hover:bg-red-500/20 transition-colors"
              onClick={cancelRun}
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        )}

        {/* Normal Tab Content */}
        {!isRunning && (
          <div className="p-4">
            {activeTab === 'overview' && (
              <TestsOverviewTab
                locale={locale}
                suites={suites}
                lastRun={lastRun}
                passRate={passRate}
                totalRuns={totalRuns}
                lastStatus={lastStatus}
                isRunning={isRunning}
                onRunSuite={handleRunSuite}
              />
            )}

            {activeTab === 'runs' && (
              <TestsRunsTab
                locale={locale}
                runs={runs}
              />
            )}

            {activeTab === 'failures' && (
              <TestsFailuresTab
                locale={locale}
                failures={failures}
                onOpenFile={onOpenFile}
              />
            )}

            {/* Phase 133.3: Settings Tab */}
            {activeTab === 'settings' && (
              <div className="flex flex-col gap-4">
                <div className="text-sm font-medium text-white/90 mb-2">
                  {isRTL ? 'تشغيل تلقائي للاختبارات' : 'Auto-Run Tests'}
                </div>

                {/* After ACE fixes */}
                <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 ring-1 ring-white/10 cursor-pointer hover:bg-white/8 transition-colors">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-white/90">
                      {isRTL ? 'بعد إصلاحات ACE' : 'After ACE fixes'}
                    </span>
                    <span className="text-[10px] text-white/50">
                      {isRTL ? 'تشغيل الاختبارات تلقائياً بعد تطبيق الإصلاحات' : 'Run tests automatically after applying fixes'}
                    </span>
                  </div>
                  <div
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      settings.autoRunAfterAce ? 'bg-emerald-500' : 'bg-white/20'
                    }`}
                    onClick={() => toggleSetting('autoRunAfterAce')}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        settings.autoRunAfterAce ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </label>

                {/* After generating tests */}
                <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 ring-1 ring-white/10 cursor-pointer hover:bg-white/8 transition-colors">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-white/90">
                      {isRTL ? 'بعد توليد الاختبارات' : 'After generating tests'}
                    </span>
                    <span className="text-[10px] text-white/50">
                      {isRTL ? 'تشغيل الاختبارات الجديدة تلقائياً' : 'Run newly generated tests automatically'}
                    </span>
                  </div>
                  <div
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      settings.autoRunAfterGenerate ? 'bg-emerald-500' : 'bg-white/20'
                    }`}
                    onClick={() => toggleSetting('autoRunAfterGenerate')}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        settings.autoRunAfterGenerate ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </label>

                {/* Show toast notifications */}
                <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 ring-1 ring-white/10 cursor-pointer hover:bg-white/8 transition-colors">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-white/90">
                      {isRTL ? 'إشعارات النتائج' : 'Result notifications'}
                    </span>
                    <span className="text-[10px] text-white/50">
                      {isRTL ? 'عرض إشعار عند انتهاء الاختبارات' : 'Show toast when tests complete'}
                    </span>
                  </div>
                  <div
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      settings.showTestToasts ? 'bg-emerald-500' : 'bg-white/20'
                    }`}
                    onClick={() => toggleSetting('showTestToasts')}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        settings.showTestToasts ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </label>

                {/* Info text */}
                <div className="text-[10px] text-white/40 mt-2 px-1">
                  {isRTL
                    ? 'عند تفعيل التشغيل التلقائي، ستظهر نتائج الاختبارات في Timeline.'
                    : 'When auto-run is enabled, test results will appear in the Quality Timeline.'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[#1a4734] bg-[#050016] px-4 py-2 text-[10px] text-white/40 flex items-center justify-between">
        <span>
          {suites.length} {isRTL ? 'مجموعة اختبارات' : 'test suites'}
        </span>
        {lastRun && (
          <span className="flex items-center gap-1">
            {lastStatus === 'passed' ? (
              <span className="text-emerald-400">✓ {isRTL ? 'ناجحة' : 'Passing'}</span>
            ) : lastStatus === 'failed' || lastStatus === 'error' ? (
              <span className="text-red-400">✗ {isRTL ? 'فاشلة' : 'Failing'}</span>
            ) : (
              <span className="text-white/50">– {isRTL ? 'غير معروف' : 'Unknown'}</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
};

export default TestsPanel;
