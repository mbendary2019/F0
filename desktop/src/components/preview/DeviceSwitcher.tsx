// desktop/src/components/preview/DeviceSwitcher.tsx
// Phase 131.2: Device Switcher Controls

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { DevicePreset, DeviceType, PreviewScale } from '../../lib/preview/previewTypes';
import { DEVICE_PROFILES, getDevicesByType } from '../../lib/preview/previewTypes';
import { usePreviewDevices } from '../../state/previewDevicesContext';
import './DeviceSwitcher.css';

interface Props {
  locale?: 'ar' | 'en';
}

/**
 * Device type icons
 */
const TYPE_ICONS: Record<DeviceType, string> = {
  mobile: '\uD83D\uDCF1', // 📱
  tablet: '\uD83D\uDCBB', // 📻 (will use tablet emoji or similar)
  desktop: '\uD83D\uDDA5\uFE0F', // 🖥️
};

/**
 * Scale options
 */
const SCALE_OPTIONS: { value: PreviewScale; label: string; labelAr: string }[] = [
  { value: 'fit', label: 'Fit', labelAr: 'ملائم' },
  { value: 1, label: '100%', labelAr: '100%' },
  { value: 0.75, label: '75%', labelAr: '75%' },
  { value: 0.5, label: '50%', labelAr: '50%' },
];

/**
 * Device Switcher - Controls for selecting device, orientation, and zoom
 */
export const DeviceSwitcher: React.FC<Props> = ({ locale = 'ar' }) => {
  const isArabic = locale === 'ar';
  const {
    currentPreset,
    currentProfile,
    orientation,
    scale,
    showFrame,
    setDevicePreset,
    toggleOrientation,
    setScale,
    setShowFrame,
    reload,
  } = usePreviewDevices();

  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [showScaleMenu, setShowScaleMenu] = useState(false);
  const deviceMenuRef = useRef<HTMLDivElement>(null);
  const scaleMenuRef = useRef<HTMLDivElement>(null);

  // Group devices by type
  const devicesByType = useMemo(() => ({
    mobile: getDevicesByType('mobile'),
    tablet: getDevicesByType('tablet'),
    desktop: getDevicesByType('desktop'),
  }), []);

  // Labels
  const labels = {
    mobile: isArabic ? 'موبايل' : 'Mobile',
    tablet: isArabic ? 'تابلت' : 'Tablet',
    desktop: isArabic ? 'سطح المكتب' : 'Desktop',
    portrait: isArabic ? 'عمودي' : 'Portrait',
    landscape: isArabic ? 'أفقي' : 'Landscape',
    showFrame: isArabic ? 'إطار الجهاز' : 'Device Frame',
    reload: isArabic ? 'تحديث' : 'Reload',
    responsive: isArabic ? 'متجاوب' : 'Responsive',
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deviceMenuRef.current && !deviceMenuRef.current.contains(e.target as Node)) {
        setShowDeviceMenu(false);
      }
      if (scaleMenuRef.current && !scaleMenuRef.current.contains(e.target as Node)) {
        setShowScaleMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle device selection
  const handleSelectDevice = useCallback((preset: DevicePreset) => {
    setDevicePreset(preset);
    setShowDeviceMenu(false);
  }, [setDevicePreset]);

  // Handle scale selection
  const handleSelectScale = useCallback((newScale: PreviewScale) => {
    setScale(newScale);
    setShowScaleMenu(false);
  }, [setScale]);

  // Get scale label
  const scaleLabel = useMemo(() => {
    const option = SCALE_OPTIONS.find(o => o.value === scale);
    return isArabic ? option?.labelAr : option?.label;
  }, [scale, isArabic]);

  // Check if rotation is allowed (not for desktop)
  const canRotate = currentProfile?.type !== 'desktop' && currentPreset !== 'responsive';

  return (
    <div className="f0-device-switcher" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Device Type Pills */}
      <div className="f0-device-type-pills">
        {(['mobile', 'tablet', 'desktop'] as DeviceType[]).map(type => (
          <button
            key={type}
            className={`f0-device-type-pill ${currentProfile?.type === type ? 'active' : ''}`}
            onClick={() => {
              const firstDevice = devicesByType[type][0];
              if (firstDevice) handleSelectDevice(firstDevice.id);
            }}
            title={labels[type]}
          >
            {TYPE_ICONS[type]}
          </button>
        ))}
      </div>

      {/* Device Dropdown */}
      <div className="f0-device-dropdown" ref={deviceMenuRef}>
        <button
          className="f0-device-dropdown-trigger"
          onClick={() => setShowDeviceMenu(!showDeviceMenu)}
        >
          <span className="f0-device-dropdown-name">
            {currentProfile ? (isArabic ? currentProfile.nameAr : currentProfile.name) : labels.responsive}
          </span>
          <span className="f0-device-dropdown-arrow">▼</span>
        </button>

        {showDeviceMenu && (
          <div className="f0-device-dropdown-menu">
            {/* Mobile Section */}
            <div className="f0-device-menu-section">
              <div className="f0-device-menu-header">
                {TYPE_ICONS.mobile} {labels.mobile}
              </div>
              {devicesByType.mobile.map(device => (
                <button
                  key={device.id}
                  className={`f0-device-menu-item ${currentPreset === device.id ? 'active' : ''}`}
                  onClick={() => handleSelectDevice(device.id)}
                >
                  <span>{isArabic ? device.nameAr : device.name}</span>
                  <span className="f0-device-menu-size">{device.width}×{device.height}</span>
                </button>
              ))}
            </div>

            {/* Tablet Section */}
            <div className="f0-device-menu-section">
              <div className="f0-device-menu-header">
                {TYPE_ICONS.tablet} {labels.tablet}
              </div>
              {devicesByType.tablet.map(device => (
                <button
                  key={device.id}
                  className={`f0-device-menu-item ${currentPreset === device.id ? 'active' : ''}`}
                  onClick={() => handleSelectDevice(device.id)}
                >
                  <span>{isArabic ? device.nameAr : device.name}</span>
                  <span className="f0-device-menu-size">{device.width}×{device.height}</span>
                </button>
              ))}
            </div>

            {/* Desktop Section */}
            <div className="f0-device-menu-section">
              <div className="f0-device-menu-header">
                {TYPE_ICONS.desktop} {labels.desktop}
              </div>
              {devicesByType.desktop.map(device => (
                <button
                  key={device.id}
                  className={`f0-device-menu-item ${currentPreset === device.id ? 'active' : ''}`}
                  onClick={() => handleSelectDevice(device.id)}
                >
                  <span>{isArabic ? device.nameAr : device.name}</span>
                  {device.width > 0 && (
                    <span className="f0-device-menu-size">{device.width}×{device.height}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Orientation Toggle */}
      {canRotate && (
        <button
          className={`f0-device-rotate-btn ${orientation}`}
          onClick={toggleOrientation}
          title={orientation === 'portrait' ? labels.landscape : labels.portrait}
        >
          <span className="f0-rotate-icon">⟳</span>
          <span className="f0-orientation-label">
            {orientation === 'portrait' ? '↕' : '↔'}
          </span>
        </button>
      )}

      {/* Scale Dropdown */}
      <div className="f0-device-scale-dropdown" ref={scaleMenuRef}>
        <button
          className="f0-device-scale-trigger"
          onClick={() => setShowScaleMenu(!showScaleMenu)}
        >
          <span>{scaleLabel}</span>
          <span className="f0-device-dropdown-arrow">▼</span>
        </button>

        {showScaleMenu && (
          <div className="f0-device-scale-menu">
            {SCALE_OPTIONS.map(option => (
              <button
                key={String(option.value)}
                className={`f0-device-scale-item ${scale === option.value ? 'active' : ''}`}
                onClick={() => handleSelectScale(option.value)}
              >
                {isArabic ? option.labelAr : option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Frame Toggle */}
      <button
        className={`f0-device-frame-toggle ${showFrame ? 'active' : ''}`}
        onClick={() => setShowFrame(!showFrame)}
        title={labels.showFrame}
      >
        <span className="f0-frame-icon">{showFrame ? '📱' : '⬜'}</span>
      </button>

      {/* Reload Button */}
      <button
        className="f0-device-reload-btn"
        onClick={reload}
        title={labels.reload}
      >
        🔄
      </button>
    </div>
  );
};

export default DeviceSwitcher;
