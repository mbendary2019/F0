'use client';

/**
 * Phase 97.1: Device Preview Pane
 * Phase 115.1: Auto-Refresh Preview on Task Execution
 * Displays a live preview of the app in desktop/tablet/mobile modes
 * Shows iframe with device frame styling
 * Auto-refreshes when tasks execute or QA completes via Firestore heartbeat
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { db } from '@/lib/firebaseClient';
import { doc, onSnapshot } from 'firebase/firestore';

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

interface DevicePreviewPaneProps {
  previewUrl?: string | null;
  initialMode?: DeviceMode;
  locale?: 'ar' | 'en';
  /** Phase 115.1: Project ID for Firestore subscription */
  projectId?: string | null;
}

const DEVICE_PRESETS: Record<DeviceMode, { label: string; labelAr: string; width: number; icon: string }> = {
  desktop: { label: 'Desktop', labelAr: 'سطح المكتب', width: 1280, icon: '🖥️' },
  tablet: { label: 'Tablet', labelAr: 'تابلت', width: 834, icon: '📱' },
  mobile: { label: 'Mobile', labelAr: 'موبايل', width: 430, icon: '📲' },
};

export default function DevicePreviewPane({
  previewUrl,
  initialMode = 'desktop',
  locale = 'ar',
  projectId,
}: DevicePreviewPaneProps) {
  const [mode, setMode] = useState<DeviceMode>(initialMode);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // Phase 115.1: Auto-refresh state
  const [refreshToken, setRefreshToken] = useState(0);
  const lastSeenTsRef = useRef<number | null>(null);
  const [lastAutoRefreshReason, setLastAutoRefreshReason] = useState<string | null>(null);

  const currentPreset = useMemo(() => DEVICE_PRESETS[mode], [mode]);

  const hasPreview = !!previewUrl;

  const [copied, setCopied] = useState(false);

  // Phase 115.1: Cache-busting helper
  const withCacheBust = useCallback(
    (url: string) => {
      if (!url) return url;
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}_fz_preview=${refreshToken}`;
    },
    [refreshToken]
  );

  // Phase 115.1: Subscribe to Firestore heartbeat
  useEffect(() => {
    if (!projectId) return;

    const previewDocRef = doc(db, 'ops_projects', projectId, '_meta', 'preview');

    const unsubscribe = onSnapshot(
      previewDocRef,
      (snapshot) => {
        if (!snapshot.exists()) return;

        const data = snapshot.data();
        const ts = data?.lastTriggeredAt?.toMillis?.() ?? null;

        // Skip if no timestamp or it's the same as last seen
        if (!ts) return;
        if (lastSeenTsRef.current !== null && ts <= lastSeenTsRef.current) return;

        // This is a new heartbeat
        lastSeenTsRef.current = ts;

        // Trigger auto-refresh
        setRefreshToken((prev) => prev + 1);
        setLastAutoRefreshReason(data?.lastReason || 'unknown');
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1500);

        console.log('[DevicePreviewPane] Auto-refresh triggered:', data?.lastReason);
      },
      (error) => {
        console.warn('[DevicePreviewPane] Firestore subscription error:', error);
      }
    );

    return () => unsubscribe();
  }, [projectId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setIframeKey((k) => k + 1);
    setRefreshToken((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Phase 97.2: Open in new tab
  const handleOpenInNewTab = useCallback(() => {
    if (previewUrl) {
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    }
  }, [previewUrl]);

  // Phase 97.2: Copy URL to clipboard
  const handleCopyUrl = useCallback(async () => {
    if (!previewUrl) return;
    try {
      await navigator.clipboard.writeText(previewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = previewUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [previewUrl]);

  // Phase 115.1: Compute iframe src with cache busting
  const iframeSrc = useMemo(() => {
    if (!previewUrl) return null;
    return withCacheBust(previewUrl);
  }, [previewUrl, withCacheBust]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#2c1466] bg-[#050017]">
      {/* Header / Controls */}
      <div className="flex items-center justify-between border-b border-[#2c1466] px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-violet-200/80">
          <span className="text-[10px] uppercase tracking-wide text-violet-400">
            {locale === 'ar' ? 'معاينة' : 'Preview'}
          </span>
          {hasPreview ? (
            <span className="truncate text-[11px] text-violet-100/70 max-w-[150px]">
              {previewUrl}
            </span>
          ) : (
            <span className="text-[11px] text-amber-200/80">
              {locale === 'ar' ? 'لا يوجد رابط معاينة' : 'No preview URL configured'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Phase 97.2: Open / Copy / Refresh Buttons */}
          {hasPreview && (
            <>
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="rounded-full px-2 py-1 text-[11px] transition hover:bg-violet-600/20 text-violet-200/80"
                title={locale === 'ar' ? 'فتح في تبويب جديد' : 'Open in new tab'}
              >
                {locale === 'ar' ? 'فتح' : 'Open'}
              </button>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="rounded-full px-2 py-1 text-[11px] transition hover:bg-violet-600/20 text-violet-200/80"
                title={locale === 'ar' ? 'نسخ الرابط' : 'Copy URL'}
              >
                {copied ? (locale === 'ar' ? 'تم!' : 'Copied!') : (locale === 'ar' ? 'نسخ' : 'Copy')}
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="rounded-full p-1.5 text-[11px] transition hover:bg-violet-600/10 text-violet-200/70 disabled:opacity-50"
                title={locale === 'ar' ? 'تحديث' : 'Refresh'}
              >
                {isRefreshing ? '⏳' : '🔄'}
              </button>
            </>
          )}

          {/* Device toggles */}
          <div className="flex items-center gap-1">
            {(['desktop', 'tablet', 'mobile'] as DeviceMode[]).map((m) => {
              const active = m === mode;
              const preset = DEVICE_PRESETS[m];
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-full px-2.5 py-1 text-[11px] transition flex items-center gap-1 ${
                    active
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-transparent text-violet-200/70 hover:bg-violet-600/10'
                  }`}
                  title={locale === 'ar' ? preset.labelAr : preset.label}
                >
                  <span>{preset.icon}</span>
                  <span className="hidden sm:inline">
                    {locale === 'ar' ? preset.labelAr : preset.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 items-center justify-center overflow-hidden px-3 pb-3 pt-2">
        {hasPreview && iframeSrc ? (
          <div className="flex h-full max-h-full items-center justify-center w-full">
            {/* Device frame */}
            <div
              className={`relative flex items-center justify-center rounded-[28px] border border-[#2c1466] bg-black/80 shadow-[0_0_40px_rgba(124,58,237,0.35)] transition-all duration-300 ${
                mode === 'desktop' ? 'h-[90%]' : 'h-[95%]'
              }`}
              style={{
                width: mode === 'desktop' ? '100%' : currentPreset.width,
                maxWidth: currentPreset.width,
              }}
            >
              {/* Top bar (camera/notch) - only for mobile/tablet */}
              {mode !== 'desktop' && (
                <div className="pointer-events-none absolute top-1.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/80 px-4 py-1">
                  <div className="h-1 w-10 rounded-full bg-gray-600/60" />
                  <div className="h-2 w-2 rounded-full bg-gray-500/70" />
                </div>
              )}

              {/* Screen */}
              <div className={`relative m-3 h-[calc(100%-24px)] w-[calc(100%-24px)] overflow-hidden bg-black ${
                mode === 'desktop' ? 'rounded-lg' : 'rounded-[20px]'
              }`}>
                <iframe
                  key={`${previewUrl}-${mode}-${iframeKey}-${refreshToken}`}
                  src={iframeSrc}
                  className="h-full w-full border-0"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  title="App Preview"
                />
              </div>

              {/* Home indicator for mobile */}
              {mode === 'mobile' && (
                <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2">
                  <div className="h-1 w-24 rounded-full bg-gray-600/60" />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-sm text-violet-100/70">
            <div className="text-4xl opacity-50">📱</div>
            <span>
              {locale === 'ar'
                ? 'لا يوجد رابط معاينة لهذا المشروع حتى الآن.'
                : 'No preview URL configured for this project yet.'}
            </span>
            <span className="text-[11px] text-violet-300/70 max-w-[280px]">
              {locale === 'ar' ? (
                <>
                  قم بإعداد <code className="rounded bg-black/40 px-1">previewUrl</code>{' '}
                  في إعدادات المشروع أو بعد أول نشر للنسخة.
                </>
              ) : (
                <>
                  Set up <code className="rounded bg-black/40 px-1">previewUrl</code>{' '}
                  in project settings or after the first deployment.
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Footer - Device Info + Auto-refresh indicator */}
      {hasPreview && (
        <div className="flex items-center justify-center gap-2 border-t border-[#2c1466] px-4 py-1.5 text-[10px] text-violet-300/50">
          <span>{currentPreset.icon}</span>
          <span>{currentPreset.width}px</span>
          <span>•</span>
          <span>{locale === 'ar' ? currentPreset.labelAr : currentPreset.label}</span>
          {/* Phase 115.1: Auto-refresh indicator */}
          {lastAutoRefreshReason && (
            <>
              <span>•</span>
              <span className="text-green-400/70">
                {isRefreshing ? '⏳' : '✓'}{' '}
                {locale === 'ar' ? 'تحديث تلقائي' : 'Auto-refreshed'}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
