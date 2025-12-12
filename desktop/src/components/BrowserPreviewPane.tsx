// desktop/src/components/BrowserPreviewPane.tsx
// Phase 115.1: Browser Preview Pane for Live Preview
// Phase 115.2: Use Electron webview instead of iframe for proper HMR/RSC support
// Phase 115.3: Added reloadToken support for auto-refresh
// Phase 115.4: Cursor-like Toolbar with navigation, status, and auto-refresh toggle
// Phase 115.5: Device Frames for Desktop/Tablet/Mobile viewport preview
// Phase 116.2: Multi Preview Tabs integration
// Phase 117: Console logs capture and display
// Phase 119.8: Fallback to iframe when not in Electron environment
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { usePreviewState, type ViewportMode, type FitMode } from '../state/previewState';
import { usePreviewLogsState, type PreviewLogLevel } from '../state/previewLogsState';
import { PreviewToolbar } from './PreviewToolbar';
import { PreviewTabsBar } from './PreviewTabsBar';
import { PreviewUrlBar } from './PreviewUrlBar';
import { PreviewLogsPane } from './PreviewLogsPane';

type PreviewStatus = 'idle' | 'loading' | 'live' | 'error';

// Type for Electron's webview element
type WebviewElement = HTMLElement & {
  src: string;
  reload: () => void;
  loadURL: (url: string) => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => void;
  goForward: () => void;
  addEventListener: (event: string, handler: () => void) => void;
  removeEventListener: (event: string, handler: () => void) => void;
};

type BrowserPreviewPaneProps = {
  onClose?: () => void;
  locale?: string;
};

// Phase 115.5: Helper to get viewport width based on mode
const getViewportWidth = (mode: ViewportMode): number | '100%' => {
  switch (mode) {
    case 'desktop':
      return 1440;
    case 'tablet':
      return 1024;
    case 'mobile':
      return 430;
    case 'full':
    default:
      return '100%';
  }
};

// Phase 132.1: Helper to get scale factor based on fit mode
const getFitScale = (fitMode: FitMode): number => {
  switch (fitMode) {
    case '100%':
      return 1;
    case '75%':
      return 0.75;
    case '50%':
      return 0.5;
    case 'auto':
    default:
      return 0; // 0 means auto-calculate
  }
};

export const BrowserPreviewPane: React.FC<BrowserPreviewPaneProps> = ({
  onClose,
  locale = 'en',
}) => {
  const { isOpen, tabs, reloadToken, viewportMode, showLogs, fitMode } = usePreviewState();

  // Phase 119.7: Get active tab's URL
  const activeTab = tabs.find((t) => t.isActive);
  const url = activeTab?.url ?? 'http://localhost:3030/en';
  const { addLog } = usePreviewLogsState();
  const webviewRef = useRef<WebviewElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const isArabic = locale === 'ar';

  // Phase 119.8: Detect if running in Electron (check for f0Desktop bridge)
  const isElectron = typeof window !== 'undefined' && !!(window as any).f0Desktop;

  // Phase 115.5: Compute viewport dimensions
  const contentWidth = getViewportWidth(viewportMode);
  const isFramed = viewportMode !== 'full';

  // Phase 132.1: Ref for content container to measure available space
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Phase 132.1: Measure container size for auto-fit calculation
  useEffect(() => {
    const container = contentContainerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    updateSize();

    // Use ResizeObserver to track container size changes
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Phase 132.1: Calculate actual scale based on fitMode and container size
  const calculateAutoFitScale = useCallback((): number => {
    const manualScale = getFitScale(fitMode);
    if (manualScale > 0) return manualScale; // Use manual scale if set

    // Auto-fit calculation
    if (viewportMode === 'full') return 1; // No scaling for full mode

    const targetWidth = contentWidth as number;
    const targetHeight = viewportMode === 'mobile' ? (targetWidth * 19) / 9 : containerSize.height * 0.85;

    if (containerSize.width <= 0 || containerSize.height <= 0) return 1;

    // Calculate scale to fit width (with some padding)
    const availableWidth = containerSize.width - 32; // 16px padding each side
    const availableHeight = containerSize.height - 32;

    const scaleX = availableWidth / targetWidth;
    const scaleY = availableHeight / targetHeight;

    // Use the smaller scale to ensure content fits both dimensions
    const autoScale = Math.min(scaleX, scaleY, 1); // Cap at 1 (no upscaling)

    return Math.max(0.3, autoScale); // Minimum 30% scale
  }, [fitMode, viewportMode, contentWidth, containerSize]);

  const currentScale = calculateAutoFitScale();

  // Phase 119.8: Listen to iframe events (fallback mode)
  useEffect(() => {
    if (isElectron) return; // Skip for Electron

    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setStatus('live');
    };

    const handleError = () => {
      setStatus('error');
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    // Set loading when URL changes
    setStatus('loading');

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, [reloadToken, url, isElectron]);

  // Listen to webview events (Electron mode)
  useEffect(() => {
    if (!isElectron) return; // Skip for browser

    const webview = webviewRef.current;
    if (!webview) return;

    const handleDidStartLoading = () => {
      setStatus('loading');
    };

    const handleDidFinishLoad = () => {
      setStatus('live');
      // Update navigation state
      try {
        setCanGoBack(webview.canGoBack?.() ?? false);
        setCanGoForward(webview.canGoForward?.() ?? false);
      } catch {
        // Ignore errors
      }
    };

    const handleDidFailLoad = () => {
      setStatus('error');
    };

    const handleDidNavigate = () => {
      // Update navigation state after navigation
      try {
        setCanGoBack(webview.canGoBack?.() ?? false);
        setCanGoForward(webview.canGoForward?.() ?? false);
      } catch {
        // Ignore errors
      }
    };

    // Phase 117: Capture console messages from webview
    // Phase 118 Mini-Patch: Filter noise warnings (React DevTools, Electron Security)
    const handleConsoleMessage = (event: any) => {
      const message: string = event.message || '';

      // 🔇 Filter React DevTools noise
      if (message.includes('Download the React DevTools for a better development experience')) {
        return;
      }

      // 🔇 Filter Electron Security Warnings
      if (message.includes('Electron Security Warning')) {
        return;
      }

      // 🔇 Filter Next.js hot reload messages
      if (message.includes('[HMR]') || message.includes('[Fast Refresh]')) {
        return;
      }

      const levelMap: Record<number, PreviewLogLevel> = {
        0: 'log',
        1: 'warn',
        2: 'error',
        3: 'info',
      };
      const level = levelMap[event.level] ?? 'log';
      addLog({
        level,
        message,
        source: event.sourceId,
        lineNumber: event.line,
      });
    };

    // Webview uses custom events
    webview.addEventListener('did-start-loading', handleDidStartLoading);
    webview.addEventListener('did-finish-load', handleDidFinishLoad);
    webview.addEventListener('did-fail-load', handleDidFailLoad);
    webview.addEventListener('did-navigate', handleDidNavigate);
    webview.addEventListener('did-navigate-in-page', handleDidNavigate);
    webview.addEventListener('console-message', handleConsoleMessage);

    return () => {
      webview.removeEventListener('did-start-loading', handleDidStartLoading);
      webview.removeEventListener('did-finish-load', handleDidFinishLoad);
      webview.removeEventListener('did-fail-load', handleDidFailLoad);
      webview.removeEventListener('did-navigate', handleDidNavigate);
      webview.removeEventListener('did-navigate-in-page', handleDidNavigate);
      webview.removeEventListener('console-message', handleConsoleMessage);
    };
  }, [reloadToken, addLog, isElectron]); // Re-attach when webview remounts

  // Navigation handlers
  const handleBack = useCallback(() => {
    const webview = webviewRef.current;
    if (webview && webview.canGoBack?.()) {
      webview.goBack();
    }
  }, []);

  const handleForward = useCallback(() => {
    const webview = webviewRef.current;
    if (webview && webview.canGoForward?.()) {
      webview.goForward();
    }
  }, []);

  const handleReload = useCallback(() => {
    const webview = webviewRef.current;
    if (webview) {
      setStatus('loading');
      if (typeof webview.reload === 'function') {
        webview.reload();
      } else {
        webview.src = url;
      }
    }
  }, [url]);

  const handleOpenExternal = useCallback(() => {
    // Use Electron shell to open in external browser
    const f0Desktop = (window as any).f0Desktop;
    if (f0Desktop?.openExternal) {
      f0Desktop.openExternal(url);
    } else {
      // Fallback: try opening in new window
      window.open(url, '_blank');
    }
  }, [url]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="f0-preview-pane flex flex-col h-full w-full border-l border-[#251347] bg-[#050015]">
      {/* Phase 115.4: Cursor-like Toolbar - Row 1 (LOGS, AUTO, Browser) + Row 2 (Viewport modes) */}
      {/* Phase 131.6: Pass locale for QR Code button */}
      <PreviewToolbar
        status={status}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
        onOpenExternal={handleOpenExternal}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        locale={locale as 'ar' | 'en'}
      />

      {/* Phase 116.2: Preview Tabs Bar - Row 3 (URL tabs) - moved below viewport buttons */}
      <PreviewTabsBar />

      {/* Phase 119.7: URL Bar - Row 4 (separate URL input for each tab) */}
      <PreviewUrlBar />

      {/* Close button in corner */}
      {onClose && (
        <button
          className="absolute top-2 right-2 z-10 h-6 w-6 rounded-full bg-black/50 text-white/70 hover:bg-black/70 hover:text-white flex items-center justify-center text-xs transition"
          onClick={onClose}
          title={isArabic ? 'إغلاق' : 'Close'}
        >
          ✕
        </button>
      )}

      {/* Webview Container - Phase 115.2: Use Electron webview instead of iframe */}
      {/* This enables proper HMR, RSC, and WebSocket support like VS Code/Cursor */}
      {/* Phase 115.3: key={reloadToken} forces remount on reload() call */}
      {/* Phase 115.5: Device Frame UI for Desktop/Tablet/Mobile viewports */}
      {/* Phase 119.4: Polished device frames */}
      {/* Phase 132.1: Added ref for auto-fit measurement */}
      {/* Phase 132.2: Fixed - content now fills container when resized */}
      {/* Phase 132.3: Full mode uses absolute positioning for proper resize */}
      <div
        ref={contentContainerRef}
        className={`f0-preview-content flex-1 bg-[#030010] overflow-hidden relative ${
          isFramed ? 'flex items-center justify-center' : ''
        }`}
      >
        {isFramed ? (
          /* Framed modes (Desktop/Tablet/Mobile) - centered with scaling */
          <div
            className="relative flex justify-center px-4"
            style={{
              width: contentWidth === '100%' ? '100%' : contentWidth,
              maxWidth: '100%',
              height: 'auto',
              transform: currentScale < 1 ? `scale(${currentScale})` : undefined,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease-out',
            }}
          >
            <div
              className="relative w-full bg-black f0-preview-frame-animate rounded-[26px] border border-white/[0.12] shadow-[0_18px_55px_rgba(0,0,0,0.85)] overflow-hidden bg-[#02000a]"
              style={{
                aspectRatio: viewportMode === 'mobile' ? '9 / 19' : undefined,
                height: viewportMode === 'mobile' ? undefined : '85vh',
              }}
            >
              {/* Mobile Notch */}
              {viewportMode === 'mobile' && (
                <div className="pointer-events-none absolute left-1/2 top-2 z-10 flex h-4 w-24 -translate-x-1/2 items-center justify-center">
                  <div className="h-3 w-20 rounded-full bg-black/80 border border-white/10 shadow-[0_0_6px_rgba(0,0,0,0.8)]" />
                </div>
              )}
              {/* Webview/iframe for framed mode */}
              {isElectron ? (
                <webview
                  key={reloadToken}
                  ref={webviewRef as React.RefObject<any>}
                  src={url}
                  className="w-full h-full"
                  // @ts-ignore
                  allowpopups="true"
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <iframe
                  key={reloadToken}
                  ref={iframeRef}
                  src={url}
                  className="w-full h-full border-0 bg-white"
                  style={{ width: '100%', height: '100%', minHeight: '300px' }}
                  title="Preview"
                />
              )}
            </div>
          </div>
        ) : (
          /* Full mode - absolute positioning to fill entire container */
          isElectron ? (
            <webview
              key={reloadToken}
              ref={webviewRef as React.RefObject<any>}
              src={url}
              className="absolute inset-0"
              // @ts-ignore
              allowpopups="true"
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <iframe
              key={reloadToken}
              ref={iframeRef}
              src={url}
              className="absolute inset-0 border-0 bg-white"
              style={{ width: '100%', height: '100%' }}
              title="Preview"
            />
          )
        )}
      </div>

      {/* Phase 117: Console Logs Panel */}
      {showLogs && <PreviewLogsPane />}
    </div>
  );
};

export default BrowserPreviewPane;
