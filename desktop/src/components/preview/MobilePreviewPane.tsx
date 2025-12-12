// desktop/src/components/preview/MobilePreviewPane.tsx
// Phase 131.3: Mobile Preview Pane with URL Sync & Live Reload

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { DeviceFrame } from './DeviceFrame';
import { DeviceSwitcher } from './DeviceSwitcher';
import { QRCodePanel } from './QRCodePanel';
import { PreviewDevicesProvider, usePreviewDevices } from '../../state/previewDevicesContext';
import './MobilePreviewPane.css';

interface Props {
  /** Preview URL (e.g., http://localhost:3000) */
  initialUrl?: string;
  /** UI locale */
  locale?: 'ar' | 'en';
  /** Callback when URL changes */
  onUrlChange?: (url: string) => void;
  /** WebSocket URL for live reload (optional) */
  liveReloadWsUrl?: string;
  /** Project root for file watching */
  projectRoot?: string;
}

/**
 * Inner preview component (uses context)
 */
const MobilePreviewPaneInner: React.FC<Props> = ({
  locale = 'ar',
  onUrlChange,
  liveReloadWsUrl,
}) => {
  const isArabic = locale === 'ar';
  const {
    currentProfile,
    orientation,
    scale,
    showFrame,
    url,
    isLoading,
    autoReload,
    lastReloadAt,
    setUrl,
    reload,
  } = usePreviewDevices();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [urlInput, setUrlInput] = useState(url);
  const [showUrlBar, setShowUrlBar] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  // Phase 131.5: QR Code panel state
  const [showQR, setShowQR] = useState(false);

  // Labels
  const labels = {
    urlPlaceholder: isArabic ? 'أدخل رابط المعاينة...' : 'Enter preview URL...',
    go: isArabic ? 'اذهب' : 'Go',
    loading: isArabic ? 'جاري التحميل...' : 'Loading...',
    connected: isArabic ? 'متصل' : 'Connected',
    disconnected: isArabic ? 'غير متصل' : 'Disconnected',
    connecting: isArabic ? 'جاري الاتصال...' : 'Connecting...',
    autoReload: isArabic ? 'تحديث تلقائي' : 'Auto Reload',
    openOnDevice: isArabic ? 'افتح على جهازك' : 'Open on Device',
  };

  // Track container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: rect.width,
          height: rect.height - 100, // Account for toolbar + url bar
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateSize);
      observer.disconnect();
    };
  }, []);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    console.log('[Preview] iframe loaded:', url);
  }, [url]);

  // Handle URL submit
  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    let newUrl = urlInput.trim();

    // Add protocol if missing
    if (newUrl && !newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      newUrl = 'http://' + newUrl;
    }

    if (newUrl) {
      setUrl(newUrl);
      onUrlChange?.(newUrl);
      setShowUrlBar(false);
    }
  }, [urlInput, setUrl, onUrlChange]);

  // Sync urlInput with url
  useEffect(() => {
    setUrlInput(url);
  }, [url]);

  // Live reload via WebSocket
  useEffect(() => {
    if (!liveReloadWsUrl || !autoReload) {
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(liveReloadWsUrl);

        ws.onopen = () => {
          console.log('[Preview] WebSocket connected for live reload');
          setConnectionStatus('connected');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'reload' || data.type === 'change') {
              console.log('[Preview] Live reload triggered:', data);
              reload();
            }
          } catch {
            // Not JSON, might be a simple reload signal
            if (event.data === 'reload') {
              reload();
            }
          }
        };

        ws.onclose = () => {
          console.log('[Preview] WebSocket disconnected');
          setConnectionStatus('disconnected');
          // Reconnect after 3 seconds
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          setConnectionStatus('disconnected');
        };
      } catch (err) {
        console.error('[Preview] WebSocket error:', err);
        setConnectionStatus('disconnected');
      }
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [liveReloadWsUrl, autoReload, reload]);

  // Reload iframe when lastReloadAt changes
  useEffect(() => {
    if (lastReloadAt && iframeRef.current) {
      iframeRef.current.src = url + (url.includes('?') ? '&' : '?') + '_r=' + Date.now();
    }
  }, [lastReloadAt, url]);

  // Build iframe URL with cache buster on reload
  const iframeSrc = useMemo(() => {
    if (lastReloadAt) {
      return url + (url.includes('?') ? '&' : '?') + '_r=' + new Date(lastReloadAt).getTime();
    }
    return url;
  }, [url, lastReloadAt]);

  return (
    <div className="f0-mobile-preview-pane" ref={containerRef} dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Toolbar */}
      <DeviceSwitcher locale={locale} />

      {/* URL Bar */}
      <div className="f0-preview-url-bar">
        <form onSubmit={handleUrlSubmit} className="f0-preview-url-form">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={labels.urlPlaceholder}
            className="f0-preview-url-input"
          />
          <button type="submit" className="f0-preview-url-go">
            {labels.go}
          </button>
        </form>

        {/* Connection status indicator */}
        {autoReload && (
          <div className={`f0-preview-connection-status ${connectionStatus}`}>
            <span className="f0-preview-status-dot" />
            <span className="f0-preview-status-text">
              {labels[connectionStatus]}
            </span>
          </div>
        )}

        {/* Phase 131.5: QR Code button */}
        <button
          className="f0-preview-qr-btn"
          onClick={() => setShowQR(true)}
          title={labels.openOnDevice}
        >
          📱
        </button>
      </div>

      {/* Preview Area */}
      <div className="f0-preview-viewport">
        {isLoading && (
          <div className="f0-preview-loading">
            <div className="f0-preview-spinner" />
            <span>{labels.loading}</span>
          </div>
        )}

        {currentProfile && (
          <DeviceFrame
            profile={currentProfile}
            orientation={orientation}
            scale={scale}
            showFrame={showFrame}
            locale={locale}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          >
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              title="Preview"
              className="f0-preview-iframe"
              onLoad={handleIframeLoad}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
          </DeviceFrame>
        )}
      </div>

      {/* Phase 131.5: QR Code Panel */}
      <QRCodePanel
        url={url}
        locale={locale}
        isOpen={showQR}
        onClose={() => setShowQR(false)}
      />
    </div>
  );
};

/**
 * Mobile Preview Pane - Full preview with device frames and live reload
 */
export const MobilePreviewPane: React.FC<Props> = (props) => {
  return (
    <PreviewDevicesProvider initialUrl={props.initialUrl}>
      <MobilePreviewPaneInner {...props} />
    </PreviewDevicesProvider>
  );
};

export default MobilePreviewPane;
