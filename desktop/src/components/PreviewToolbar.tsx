// desktop/src/components/PreviewToolbar.tsx
// Phase 115.4: Cursor-like Preview Toolbar with navigation, status, and auto-refresh toggle
// Phase 115.5: Added viewport mode buttons (Full/Desktop/Tablet/Mobile)
// Phase 115.6: Polished single-row layout with proper spacing
// Phase 117: Added LOGS toggle button
// Phase 119.7: URL bar moved to separate component (PreviewUrlBar)
// Phase 131.6: Added QR Code button for mobile device preview
// Phase 131.10: Added Device Picker dropdown for specific device selection
'use client';

import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { usePreviewState } from '../state/previewState';
import type { ViewportMode, FitMode } from '../state/previewState';
import { QRCodePanel } from './preview/QRCodePanel';
import { DEVICE_PROFILES, type DeviceProfile, type DeviceType } from '../lib/preview/previewTypes';

type PreviewToolbarProps = {
  status: 'idle' | 'loading' | 'live' | 'error';
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onOpenExternal: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  locale?: 'ar' | 'en';
};

export const PreviewToolbar: React.FC<PreviewToolbarProps> = ({
  status,
  onBack,
  onForward,
  onReload,
  onOpenExternal,
  canGoBack,
  canGoForward,
  locale = 'ar',
}) => {
  const {
    autoRefreshEnabled,
    toggleAutoRefresh,
    viewportMode,
    setViewportMode,
    showLogs,
    toggleLogs,
    tabs,
    fitMode,
    setFitMode,
  } = usePreviewState();

  // Phase 131.6: QR Code panel state
  const [showQR, setShowQR] = useState(false);
  const activeTab = tabs.find((t) => t.isActive);
  const currentUrl = activeTab?.url ?? 'http://localhost:3030';

  // Phase 131.10: Device picker state
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceProfile | null>(null);
  const devicePickerRef = useRef<HTMLDivElement>(null);
  const isArabic = locale === 'ar';

  // Group devices by type
  const mobileDevices = DEVICE_PROFILES.filter(d => d.type === 'mobile');
  const tabletDevices = DEVICE_PROFILES.filter(d => d.type === 'tablet');

  // Close device picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (devicePickerRef.current && !devicePickerRef.current.contains(e.target as Node)) {
        setShowDevicePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle device selection
  const handleSelectDevice = (device: DeviceProfile) => {
    setSelectedDevice(device);
    // Map device type to viewport mode
    if (device.type === 'mobile') {
      setViewportMode('mobile');
    } else if (device.type === 'tablet') {
      setViewportMode('tablet');
    } else {
      setViewportMode('desktop');
    }
    setShowDevicePicker(false);
  };

  const statusLabel =
    status === 'loading'
      ? 'Connecting…'
      : status === 'live'
      ? 'Live'
      : status === 'error'
      ? 'Offline'
      : 'Idle';

  const statusDotClass =
    status === 'live'
      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]'
      : status === 'loading'
      ? 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]'
      : status === 'error'
      ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]'
      : 'bg-slate-400';

  // Phase 132.1: Fit mode button renderer
  const fitButton = (mode: FitMode, label: string) => (
    <button
      key={mode}
      onClick={() => setFitMode(mode)}
      className={clsx(
        'h-6 px-2 rounded-md text-[9px] uppercase tracking-[0.12em] font-medium border transition-all duration-200 flex items-center gap-1',
        fitMode === mode
          ? 'border-cyan-500/60 bg-gradient-to-b from-cyan-500/30 to-cyan-500/15 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
          : 'border-[#3a3055] bg-[#1a0a35]/50 text-[#8b7faa] hover:text-[#c4b5fd] hover:border-cyan-500/40 hover:bg-cyan-500/10'
      )}
    >
      {label}
    </button>
  );

  const viewportButton = (mode: ViewportMode, label: string, icon?: string) => (
    <button
      key={mode}
      onClick={() => setViewportMode(mode)}
      className={clsx(
        'h-6 px-3 rounded-md text-[9px] uppercase tracking-[0.12em] font-medium border transition-all duration-200 flex items-center gap-1.5',
        viewportMode === mode
          ? 'border-[#7c3aed]/60 bg-gradient-to-b from-[#7c3aed]/30 to-[#7c3aed]/15 text-[#e0dbff] shadow-[0_0_12px_rgba(124,58,237,0.5)]'
          : 'border-[#3a3055] bg-[#1a0a35]/50 text-[#8b7faa] hover:text-[#c4b5fd] hover:border-[#7c3aed]/40 hover:bg-[#7c3aed]/10'
      )}
    >
      {icon && <span className="text-[10px]">{icon}</span>}
      {label}
    </button>
  );

  return (
    <div className="flex flex-col border-b border-[#251347]">
      {/* Row 1: Navigation + Status/URL + Actions (LOGS, AUTO, Browser) */}
      <div className="flex h-9 items-center gap-3 bg-gradient-to-r from-[#08001b] via-[#0b0223] to-[#050015] px-3 text-[11px] text-[#e0dbff] whitespace-nowrap overflow-hidden border-b border-[#251347]/50">
        {/* LEFT: Navigation buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={onBack}
            disabled={!canGoBack}
            className={clsx(
              'h-6 w-6 rounded-md border border-white/10 bg-white/5 text-[10px] flex items-center justify-center hover:bg-white/10 transition',
              !canGoBack && 'opacity-40 cursor-default hover:bg-white/5'
            )}
            title="Back"
          >
            ←
          </button>
          <button
            onClick={onForward}
            disabled={!canGoForward}
            className={clsx(
              'h-6 w-6 rounded-md border border-white/10 bg-white/5 text-[10px] flex items-center justify-center hover:bg-white/10 transition',
              !canGoForward && 'opacity-40 cursor-default hover:bg-white/5'
            )}
            title="Forward"
          >
            →
          </button>
          <button
            onClick={onReload}
            className="h-6 w-6 rounded-md border border-[#7b5cff]/40 bg-[#7b5cff]/25 text-[10px] flex items-center justify-center hover:bg-[#7b5cff]/35 shadow-[0_0_12px_rgba(123,92,255,0.6)] transition"
            title="Reload"
          >
            ↻
          </button>
        </div>

        {/* MIDDLE: status indicator */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className={clsx('inline-flex h-2 w-2 rounded-full', statusDotClass)} />
          <span className="text-[10px] uppercase tracking-[0.16em] text-[#c3b5ff]">
            {statusLabel}
          </span>
        </div>

        {/* RIGHT: LOGS + AUTO + Browser - Neon Style Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLogs}
            className={clsx(
              'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] font-medium transition-all duration-200',
              showLogs
                ? 'border-[#7c3aed]/60 bg-gradient-to-b from-[#7c3aed]/30 to-[#7c3aed]/15 text-[#e0dbff] shadow-[0_0_10px_rgba(124,58,237,0.5)]'
                : 'border-[#3a3055] bg-[#1a0a35]/50 text-[#8b7faa] hover:text-[#c4b5fd] hover:border-[#7c3aed]/40 hover:bg-[#7c3aed]/10'
            )}
            title="Toggle console logs"
          >
            <span
              className={clsx(
                'h-1.5 w-1.5 rounded-full transition-all',
                showLogs ? 'bg-[#a78bfa] shadow-[0_0_6px_rgba(167,139,250,0.8)]' : 'bg-[#5a4d7a]'
              )}
            />
            LOGS
          </button>

          <button
            onClick={toggleAutoRefresh}
            className={clsx(
              'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] font-medium transition-all duration-200',
              autoRefreshEnabled
                ? 'border-emerald-500/60 bg-gradient-to-b from-emerald-500/30 to-emerald-500/15 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                : 'border-[#3a3055] bg-[#1a0a35]/50 text-[#8b7faa] hover:text-emerald-300 hover:border-emerald-500/40 hover:bg-emerald-500/10'
            )}
            title="Toggle auto-refresh"
          >
            <span
              className={clsx(
                'h-1.5 w-1.5 rounded-full transition-all',
                autoRefreshEnabled ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-[#5a4d7a]'
              )}
            />
            AUTO
          </button>

          <button
            onClick={onOpenExternal}
            className="flex items-center gap-1.5 rounded-md border border-[#3a3055] bg-[#1a0a35]/50 px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] font-medium text-[#8b7faa] hover:text-[#f5f3ff] hover:border-[#7c3aed]/40 hover:bg-[#7c3aed]/15 transition-all duration-200"
            title="Open in external browser"
          >
            <span>↗</span>
            <span>Browser</span>
          </button>
        </div>
      </div>

      {/* Row 2: Viewport Mode Buttons only */}
      <div className="flex h-8 items-center justify-center gap-1.5 bg-gradient-to-r from-[#0a0015] to-[#08001b] px-3">
        {viewportButton('full', 'Full', '🖥️')}
        {viewportButton('desktop', 'Desk', '💻')}
        {viewportButton('tablet', 'Tab', '📱')}
        {viewportButton('mobile', 'Mob', '📲')}
      </div>

      {/* Row 3: Fit Mode + Device Picker + QR Code */}
      <div className="flex h-7 items-center justify-center gap-1.5 bg-gradient-to-r from-[#08001b] to-[#0a0015] px-3 border-t border-[#251347]/30">
        {/* Phase 132.1: Fit Mode buttons */}
        {fitButton('auto', 'FIT')}
        {fitButton('100%', '100%')}
        {fitButton('75%', '75%')}
        {fitButton('50%', '50%')}

        {/* Divider */}
        <div className="h-4 w-px bg-[#3a3055] mx-1" />

        {/* Phase 131.10: Device Picker Dropdown */}
        <div className="relative" ref={devicePickerRef}>
          <button
            onClick={() => setShowDevicePicker(!showDevicePicker)}
            className={clsx(
              'h-6 px-3 rounded-md text-[9px] uppercase tracking-[0.12em] font-medium border transition-all duration-200 flex items-center gap-1.5',
              selectedDevice
                ? 'border-cyan-500/60 bg-gradient-to-b from-cyan-500/30 to-cyan-500/15 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                : 'border-[#3a3055] bg-[#1a0a35]/50 text-[#8b7faa] hover:text-[#c4b5fd] hover:border-[#7c3aed]/40 hover:bg-[#7c3aed]/10'
            )}
            title={isArabic ? 'اختر جهاز' : 'Select Device'}
          >
            <span className="text-[10px]">📱</span>
            {selectedDevice ? (isArabic ? selectedDevice.nameAr : selectedDevice.name).slice(0, 12) : (isArabic ? 'جهاز' : 'Device')}
            <span className="text-[8px]">▼</span>
          </button>

          {/* Dropdown Menu */}
          {showDevicePicker && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-[#0f0525] border border-[#3a3055] rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
              {/* Mobile Section */}
              <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-[#8b7faa] bg-[#1a0a35]/80 sticky top-0">
                📱 {isArabic ? 'موبايل' : 'Mobile'}
              </div>
              {mobileDevices.map(device => (
                <button
                  key={device.id}
                  onClick={() => handleSelectDevice(device)}
                  className={clsx(
                    'w-full px-3 py-1.5 text-left text-[10px] flex items-center justify-between hover:bg-[#7c3aed]/20 transition-colors',
                    selectedDevice?.id === device.id ? 'bg-[#7c3aed]/30 text-[#e0dbff]' : 'text-[#c3b5ff]'
                  )}
                >
                  <span>{isArabic ? device.nameAr : device.name}</span>
                  <span className="text-[8px] text-[#8b7faa]">{device.width}×{device.height}</span>
                </button>
              ))}

              {/* Tablet Section */}
              <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-[#8b7faa] bg-[#1a0a35]/80 sticky top-0 mt-1">
                📟 {isArabic ? 'تابلت' : 'Tablet'}
              </div>
              {tabletDevices.map(device => (
                <button
                  key={device.id}
                  onClick={() => handleSelectDevice(device)}
                  className={clsx(
                    'w-full px-3 py-1.5 text-left text-[10px] flex items-center justify-between hover:bg-[#7c3aed]/20 transition-colors',
                    selectedDevice?.id === device.id ? 'bg-[#7c3aed]/30 text-[#e0dbff]' : 'text-[#c3b5ff]'
                  )}
                >
                  <span>{isArabic ? device.nameAr : device.name}</span>
                  <span className="text-[8px] text-[#8b7faa]">{device.width}×{device.height}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Phase 131.6: QR Code button for mobile device preview */}
        <button
          onClick={() => setShowQR(true)}
          className="h-6 px-3 rounded-md text-[9px] uppercase tracking-[0.12em] font-medium border transition-all duration-200 flex items-center gap-1.5 border-[#3a3055] bg-[#1a0a35]/50 text-[#8b7faa] hover:text-[#c4b5fd] hover:border-[#7c3aed]/40 hover:bg-[#7c3aed]/10"
          title={locale === 'ar' ? 'افتح على جهازك' : 'Open on Device'}
        >
          <span className="text-[10px]">📲</span>
          QR
        </button>
      </div>

      {/* Phase 131.6: QR Code Panel */}
      <QRCodePanel
        url={currentUrl}
        locale={locale}
        isOpen={showQR}
        onClose={() => setShowQR(false)}
      />
    </div>
  );
};

export default PreviewToolbar;
