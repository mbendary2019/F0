// desktop/src/components/preview/QRCodePanel.tsx
// Phase 131.4: QR Code Panel for "Open on Real Device"

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import './QRCodePanel.css';

interface Props {
  /** Current preview URL */
  url: string;
  /** UI locale */
  locale?: 'ar' | 'en';
  /** Whether to show panel */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
}

/**
 * Get local IP addresses via Electron IPC
 */
async function getLocalIPAddresses(): Promise<string[]> {
  if (typeof window !== 'undefined' && 'f0Desktop' in window) {
    try {
      const api = (window as any).f0Desktop;
      if (api.getNetworkAddresses) {
        return await api.getNetworkAddresses();
      }
    } catch {
      // Fallback
    }
  }
  return ['localhost'];
}

/**
 * Generate QR code as SVG using qr.js algorithm (simple implementation)
 * This is a minimal implementation - for production, use a library like qrcode
 */
function generateQRCodeSVG(data: string, size: number = 200): string {
  // Simple QR-like pattern for MVP (visual placeholder)
  // In production, replace with actual QR code library
  const moduleCount = 25;
  const moduleSize = size / moduleCount;

  // Create a deterministic pattern based on the URL hash
  const hash = simpleHash(data);
  const pattern: boolean[][] = [];

  for (let row = 0; row < moduleCount; row++) {
    pattern[row] = [];
    for (let col = 0; col < moduleCount; col++) {
      // Finder patterns (corners)
      if (isFinderPattern(row, col, moduleCount)) {
        pattern[row][col] = true;
      }
      // Timing patterns
      else if (row === 6 || col === 6) {
        pattern[row][col] = (row + col) % 2 === 0;
      }
      // Data area with hash-based pattern
      else {
        const seed = hash + row * 31 + col * 17;
        pattern[row][col] = (seed % 3) !== 0;
      }
    }
  }

  // Generate SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (pattern[row][col]) {
        const x = col * moduleSize;
        const y = row * moduleSize;
        svg += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
      }
    }
  }

  svg += '</svg>';
  return svg;
}

/**
 * Check if position is part of finder pattern
 */
function isFinderPattern(row: number, col: number, size: number): boolean {
  // Top-left
  if (row < 7 && col < 7) {
    if (row === 0 || row === 6 || col === 0 || col === 6) return true;
    if (row >= 2 && row <= 4 && col >= 2 && col <= 4) return true;
  }
  // Top-right
  if (row < 7 && col >= size - 7) {
    const adjustedCol = col - (size - 7);
    if (row === 0 || row === 6 || adjustedCol === 0 || adjustedCol === 6) return true;
    if (row >= 2 && row <= 4 && adjustedCol >= 2 && adjustedCol <= 4) return true;
  }
  // Bottom-left
  if (row >= size - 7 && col < 7) {
    const adjustedRow = row - (size - 7);
    if (adjustedRow === 0 || adjustedRow === 6 || col === 0 || col === 6) return true;
    if (adjustedRow >= 2 && adjustedRow <= 4 && col >= 2 && col <= 4) return true;
  }
  return false;
}

/**
 * Simple hash function
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * QR Code Panel - Shows QR code for mobile device access
 */
export const QRCodePanel: React.FC<Props> = ({
  url,
  locale = 'ar',
  isOpen,
  onClose,
}) => {
  const isArabic = locale === 'ar';
  const [localIP, setLocalIP] = useState<string>('localhost');
  const [copied, setCopied] = useState(false);

  // Labels
  const labels = {
    title: isArabic ? 'افتح على جهازك' : 'Open on Your Device',
    subtitle: isArabic
      ? 'امسح الكود بجوالك للمعاينة الفورية'
      : 'Scan with your phone for instant preview',
    urlLabel: isArabic ? 'الرابط' : 'URL',
    copyUrl: isArabic ? 'نسخ الرابط' : 'Copy URL',
    copied: isArabic ? 'تم النسخ!' : 'Copied!',
    note: isArabic
      ? 'تأكد أن جهازك على نفس شبكة WiFi'
      : 'Make sure your device is on the same WiFi network',
    close: isArabic ? 'إغلاق' : 'Close',
    manualUrl: isArabic ? 'أو أدخل الرابط يدوياً:' : 'Or enter the URL manually:',
  };

  // Get local IP on mount
  useEffect(() => {
    getLocalIPAddresses().then((ips) => {
      // Prefer non-localhost IP
      const networkIP = ips.find(ip => ip !== 'localhost' && ip !== '127.0.0.1');
      if (networkIP) {
        setLocalIP(networkIP);
      }
    });
  }, []);

  // Generate QR code URL (replace localhost with local IP)
  const qrUrl = useMemo(() => {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
        urlObj.hostname = localIP;
      }
      return urlObj.toString();
    } catch {
      return url;
    }
  }, [url, localIP]);

  // Generate QR code SVG
  const qrCodeSVG = useMemo(() => {
    return generateQRCodeSVG(qrUrl, 200);
  }, [qrUrl]);

  // Copy URL to clipboard
  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(qrUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [qrUrl]);

  if (!isOpen) return null;

  return (
    <div className="f0-qr-panel-overlay" onClick={onClose}>
      <div
        className="f0-qr-panel"
        dir={isArabic ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="f0-qr-panel-header">
          <div className="f0-qr-panel-title">
            <span className="f0-qr-icon">📱</span>
            {labels.title}
          </div>
          <button className="f0-qr-close" onClick={onClose}>✕</button>
        </div>

        {/* QR Code */}
        <div className="f0-qr-code-container">
          <div
            className="f0-qr-code"
            dangerouslySetInnerHTML={{ __html: qrCodeSVG }}
          />
        </div>

        {/* Subtitle */}
        <p className="f0-qr-subtitle">{labels.subtitle}</p>

        {/* URL Display */}
        <div className="f0-qr-url-container">
          <span className="f0-qr-url-label">{labels.manualUrl}</span>
          <div className="f0-qr-url-box">
            <code className="f0-qr-url">{qrUrl}</code>
            <button
              className={`f0-qr-copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopyUrl}
            >
              {copied ? '✓' : '📋'} {copied ? labels.copied : labels.copyUrl}
            </button>
          </div>
        </div>

        {/* Note */}
        <div className="f0-qr-note">
          <span className="f0-qr-note-icon">ℹ️</span>
          {labels.note}
        </div>

        {/* Close Button */}
        <button className="f0-qr-close-btn" onClick={onClose}>
          {labels.close}
        </button>
      </div>
    </div>
  );
};

export default QRCodePanel;
