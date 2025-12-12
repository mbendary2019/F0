// desktop/src/components/preview/DeviceFrame.tsx
// Phase 131.1: Device Frame UI Component with Device Bezels

import React, { useMemo, type ReactNode, type CSSProperties } from 'react';
import type { DeviceProfile, DeviceOrientation, PreviewScale } from '../../lib/preview/previewTypes';
import { getViewportDimensions } from '../../lib/preview/previewTypes';
import './DeviceFrame.css';

interface Props {
  profile: DeviceProfile;
  orientation: DeviceOrientation;
  scale: PreviewScale;
  showFrame?: boolean;
  children: ReactNode;
  locale?: 'ar' | 'en';
  containerWidth?: number;
  containerHeight?: number;
}

/**
 * Device Frame - Renders device bezels around preview content
 */
export const DeviceFrame: React.FC<Props> = ({
  profile,
  orientation,
  scale,
  showFrame = true,
  children,
  locale = 'ar',
  containerWidth = 800,
  containerHeight = 600,
}) => {
  const isArabic = locale === 'ar';
  const isResponsive = profile.id === 'responsive';

  // Get viewport dimensions
  const { width: viewportWidth, height: viewportHeight } = useMemo(() => {
    if (isResponsive) {
      return { width: containerWidth, height: containerHeight };
    }
    return getViewportDimensions(profile, orientation);
  }, [profile, orientation, isResponsive, containerWidth, containerHeight]);

  // Calculate actual scale
  const actualScale = useMemo(() => {
    if (scale === 'fit' || isResponsive) {
      // Calculate scale to fit container
      const totalWidth = viewportWidth + (showFrame ? (profile.bezelWidth || 0) * 2 : 0);
      const totalHeight = viewportHeight + (showFrame ? (profile.bezelWidth || 0) * 2 + 40 : 0); // 40 for status bar

      const scaleX = (containerWidth - 40) / totalWidth;
      const scaleY = (containerHeight - 40) / totalHeight;

      return Math.min(scaleX, scaleY, 1);
    }
    return scale;
  }, [scale, viewportWidth, viewportHeight, containerWidth, containerHeight, showFrame, profile.bezelWidth, isResponsive]);

  // Frame styles
  const frameStyle: CSSProperties = useMemo(() => {
    if (isResponsive || !showFrame) {
      return {
        width: viewportWidth,
        height: viewportHeight,
        transform: actualScale !== 1 ? `scale(${actualScale})` : undefined,
        transformOrigin: 'center center',
      };
    }

    const bezel = profile.bezelWidth || 0;
    const totalWidth = viewportWidth + bezel * 2;
    const totalHeight = viewportHeight + bezel * 2;

    return {
      width: totalWidth,
      height: totalHeight,
      borderRadius: profile.cornerRadius || 0,
      padding: bezel,
      transform: actualScale !== 1 ? `scale(${actualScale})` : undefined,
      transformOrigin: 'center center',
    };
  }, [viewportWidth, viewportHeight, profile, showFrame, actualScale, isResponsive]);

  // Screen style
  const screenStyle: CSSProperties = useMemo(() => ({
    width: viewportWidth,
    height: viewportHeight,
    borderRadius: Math.max(0, (profile.cornerRadius || 0) - (profile.bezelWidth || 0)),
  }), [viewportWidth, viewportHeight, profile]);

  // Don't render frame for responsive or when disabled
  if (isResponsive || !showFrame) {
    return (
      <div className="f0-device-frame-container">
        <div className="f0-device-responsive" style={frameStyle}>
          {children}
        </div>
      </div>
    );
  }

  // Determine frame type
  const frameType = profile.type === 'mobile' ? 'phone' : profile.type === 'tablet' ? 'tablet' : 'desktop';

  return (
    <div className="f0-device-frame-container">
      <div
        className={`f0-device-frame f0-device-frame-${frameType} ${orientation === 'landscape' ? 'landscape' : 'portrait'}`}
        style={frameStyle}
      >
        {/* Device bezel/body */}
        <div className="f0-device-body">
          {/* Notch for iPhones */}
          {profile.hasNotch && profile.type === 'mobile' && (
            <div className="f0-device-notch" />
          )}

          {/* Dynamic Island for iPhone 14 Pro+ */}
          {profile.hasDynamicIsland && profile.type === 'mobile' && (
            <div className="f0-device-dynamic-island" />
          )}

          {/* Status bar for mobile/tablet */}
          {profile.type !== 'desktop' && profile.statusBarHeight && (
            <div
              className="f0-device-status-bar"
              style={{ height: profile.statusBarHeight }}
            >
              <span className="f0-device-time">9:41</span>
              <div className="f0-device-status-icons">
                <span className="f0-device-signal">||||</span>
                <span className="f0-device-wifi">W</span>
                <span className="f0-device-battery">100%</span>
              </div>
            </div>
          )}

          {/* Screen/viewport */}
          <div className="f0-device-screen" style={screenStyle}>
            {children}
          </div>

          {/* Home indicator for modern iPhones/iPads */}
          {profile.hasHomeIndicator && (
            <div className="f0-device-home-indicator" />
          )}

          {/* Physical button for iPhone SE style */}
          {!profile.hasHomeIndicator && !profile.hasNotch && profile.type === 'mobile' && (
            <div className="f0-device-home-button" />
          )}
        </div>

        {/* Side buttons (volume, power) for phones */}
        {profile.type === 'mobile' && (
          <>
            <div className="f0-device-button-power" />
            <div className="f0-device-button-volume-up" />
            <div className="f0-device-button-volume-down" />
          </>
        )}

        {/* Desktop stand/base */}
        {profile.type === 'desktop' && profile.id.includes('macbook') && (
          <div className="f0-device-laptop-base">
            <div className="f0-device-keyboard" />
            <div className="f0-device-trackpad" />
          </div>
        )}
      </div>

      {/* Device name label */}
      <div className="f0-device-label">
        {isArabic ? profile.nameAr : profile.name}
        <span className="f0-device-dimensions">
          {viewportWidth} × {viewportHeight}
        </span>
      </div>
    </div>
  );
};

export default DeviceFrame;
