// desktop/src/lib/preview/previewTypes.ts
// Phase 131.0: Mobile Preview & Device Lab Types

/**
 * Device type categories
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * Device preset identifiers
 */
export type DevicePreset =
  // Mobile - iPhone
  | 'iphone-16-pro-max'
  | 'iphone-16-pro'
  | 'iphone-15-pro-max'
  | 'iphone-15-pro'
  | 'iphone-15'
  | 'iphone-se'
  // Mobile - Samsung
  | 'samsung-s24-ultra'
  | 'samsung-s24'
  | 'samsung-a54'
  // Mobile - Other Android
  | 'pixel-8-pro'
  | 'android-phone'
  | 'android-small'
  // Tablet - iPad
  | 'ipad-pro-12'
  | 'ipad-pro-11'
  | 'ipad-air'
  | 'ipad-mini'
  // Tablet - Samsung
  | 'samsung-tab-s9-ultra'
  | 'samsung-tab-s9'
  | 'android-tablet'
  // Desktop
  | 'macbook-pro-16'
  | 'macbook-air-13'
  | 'desktop-1080p'
  | 'desktop-1440p'
  | 'responsive';

/**
 * Screen orientation
 */
export type DeviceOrientation = 'portrait' | 'landscape';

/**
 * Zoom/scale levels
 */
export type PreviewScale = 'fit' | 0.5 | 0.75 | 1;

/**
 * Device profile with dimensions and styling
 */
export interface DeviceProfile {
  id: DevicePreset;
  name: string;
  nameAr: string;
  type: DeviceType;
  /** Width in portrait mode (px) */
  width: number;
  /** Height in portrait mode (px) */
  height: number;
  /** Device pixel ratio */
  dpr: number;
  /** Has notch (for frame rendering) */
  hasNotch?: boolean;
  /** Has home indicator (iPhone style) */
  hasHomeIndicator?: boolean;
  /** Has dynamic island (iPhone 14 Pro+) */
  hasDynamicIsland?: boolean;
  /** Corner radius for frame */
  cornerRadius?: number;
  /** Bezel width */
  bezelWidth?: number;
  /** Status bar height */
  statusBarHeight?: number;
  /** User agent string hint */
  userAgent?: 'mobile' | 'tablet' | 'desktop';
}

/**
 * Preview state
 */
export interface PreviewState {
  /** Current device preset */
  currentPreset: DevicePreset;
  /** Current orientation */
  orientation: DeviceOrientation;
  /** Zoom scale */
  scale: PreviewScale;
  /** Preview URL */
  url: string;
  /** Is preview loading */
  isLoading: boolean;
  /** Show device frame */
  showFrame: boolean;
  /** Auto-reload on file change */
  autoReload: boolean;
  /** Last reload timestamp */
  lastReloadAt?: string;
}

/**
 * Preview actions
 */
export interface PreviewActions {
  setDevicePreset: (preset: DevicePreset) => void;
  setOrientation: (orientation: DeviceOrientation) => void;
  toggleOrientation: () => void;
  setScale: (scale: PreviewScale) => void;
  setUrl: (url: string) => void;
  reload: () => void;
  setShowFrame: (show: boolean) => void;
  setAutoReload: (auto: boolean) => void;
  resetToDefault: () => void;
}

/**
 * All device profiles
 */
export const DEVICE_PROFILES: DeviceProfile[] = [
  // ═══════════════════════════════════════════════════════════════
  // Mobile - iPhone (الأحدث أولاً)
  // Phase 132.5: تصحيح جميع أبعاد iPhone حسب المواصفات الرسمية من Apple
  // المصدر: https://developer.apple.com/design/human-interface-guidelines/layout
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'iphone-16-pro-max',
    name: 'iPhone 16 Pro Max',
    nameAr: 'آيفون 16 برو ماكس',
    type: 'mobile',
    width: 440,      // 1320 / 3 = 440 (6.9" screen)
    height: 956,     // 2868 / 3 = 956
    dpr: 3,
    hasDynamicIsland: true,
    hasHomeIndicator: true,
    cornerRadius: 62,
    bezelWidth: 3,
    statusBarHeight: 59,
    userAgent: 'mobile',
  },
  {
    id: 'iphone-16-pro',
    name: 'iPhone 16 Pro',
    nameAr: 'آيفون 16 برو',
    type: 'mobile',
    width: 402,      // 1206 / 3 = 402 (6.3" screen)
    height: 874,     // 2622 / 3 = 874
    dpr: 3,
    hasDynamicIsland: true,
    hasHomeIndicator: true,
    cornerRadius: 55,
    bezelWidth: 3,
    statusBarHeight: 59,
    userAgent: 'mobile',
  },
  {
    id: 'iphone-15-pro-max',
    name: 'iPhone 15 Pro Max',
    nameAr: 'آيفون 15 برو ماكس',
    type: 'mobile',
    width: 430,      // 1290 / 3 = 430 (6.7" screen)
    height: 932,     // 2796 / 3 = 932
    dpr: 3,
    hasDynamicIsland: true,
    hasHomeIndicator: true,
    cornerRadius: 55,
    bezelWidth: 3,
    statusBarHeight: 59,
    userAgent: 'mobile',
  },
  {
    id: 'iphone-15-pro',
    name: 'iPhone 15 Pro',
    nameAr: 'آيفون 15 برو',
    type: 'mobile',
    width: 393,      // 1179 / 3 = 393 (6.1" screen)
    height: 852,     // 2556 / 3 = 852
    dpr: 3,
    hasDynamicIsland: true,
    hasHomeIndicator: true,
    cornerRadius: 55,
    bezelWidth: 3,
    statusBarHeight: 59,
    userAgent: 'mobile',
  },
  {
    id: 'iphone-15',
    name: 'iPhone 15 / 15 Plus',
    nameAr: 'آيفون 15 / 15 بلس',
    type: 'mobile',
    width: 393,      // Same viewport as 15 Pro but with notch instead of Dynamic Island
    height: 852,     // 2556 / 3 = 852
    dpr: 3,
    hasDynamicIsland: true,  // iPhone 15 العادي أيضاً لديه Dynamic Island
    hasHomeIndicator: true,
    cornerRadius: 55,
    bezelWidth: 3,
    statusBarHeight: 54,
    userAgent: 'mobile',
  },
  {
    id: 'iphone-se',
    name: 'iPhone SE (3rd gen)',
    nameAr: 'آيفون SE (الجيل 3)',
    type: 'mobile',
    width: 375,      // 750 / 2 = 375 (4.7" screen)
    height: 667,     // 1334 / 2 = 667
    dpr: 2,
    hasNotch: false,
    hasHomeIndicator: false,  // Has physical home button
    cornerRadius: 0,
    bezelWidth: 3,
    statusBarHeight: 20,
    userAgent: 'mobile',
  },
  // ═══════════════════════════════════════════════════════════════
  // Mobile - Samsung Galaxy
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'samsung-s24-ultra',
    name: 'Samsung S24 Ultra',
    nameAr: 'سامسونج S24 ألترا',
    type: 'mobile',
    width: 412,
    height: 915,
    dpr: 3.5,
    hasNotch: false, // punch hole camera
    hasHomeIndicator: false,
    cornerRadius: 38,
    bezelWidth: 2,
    statusBarHeight: 24,
    userAgent: 'mobile',
  },
  {
    id: 'samsung-s24',
    name: 'Samsung S24',
    nameAr: 'سامسونج S24',
    type: 'mobile',
    width: 360,
    height: 780,
    dpr: 3,
    hasNotch: false,
    hasHomeIndicator: false,
    cornerRadius: 32,
    bezelWidth: 2,
    statusBarHeight: 24,
    userAgent: 'mobile',
  },
  {
    id: 'samsung-a54',
    name: 'Samsung A54',
    nameAr: 'سامسونج A54',
    type: 'mobile',
    width: 393,
    height: 851,
    dpr: 2.625,
    hasNotch: false,
    hasHomeIndicator: false,
    cornerRadius: 28,
    bezelWidth: 2,
    statusBarHeight: 24,
    userAgent: 'mobile',
  },
  // ═══════════════════════════════════════════════════════════════
  // Mobile - Other Android
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'pixel-8-pro',
    name: 'Pixel 8 Pro',
    nameAr: 'بكسل 8 برو',
    type: 'mobile',
    width: 412,
    height: 915,
    dpr: 2.625,
    hasNotch: false,
    hasHomeIndicator: false,
    cornerRadius: 24,
    bezelWidth: 2,
    statusBarHeight: 24,
    userAgent: 'mobile',
  },
  {
    id: 'android-phone',
    name: 'Android Phone',
    nameAr: 'هاتف أندرويد',
    type: 'mobile',
    width: 412,
    height: 915,
    dpr: 2.625,
    hasNotch: true,
    hasHomeIndicator: false,
    cornerRadius: 20,
    bezelWidth: 2,
    statusBarHeight: 24,
    userAgent: 'mobile',
  },
  {
    id: 'android-small',
    name: 'Android Small',
    nameAr: 'أندرويد صغير',
    type: 'mobile',
    width: 360,
    height: 780,
    dpr: 2,
    hasNotch: false,
    hasHomeIndicator: false,
    cornerRadius: 16,
    bezelWidth: 2,
    statusBarHeight: 24,
    userAgent: 'mobile',
  },
  // ═══════════════════════════════════════════════════════════════
  // Tablet - iPad
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'ipad-pro-12',
    name: 'iPad Pro 12.9"',
    nameAr: 'آيباد برو 12.9"',
    type: 'tablet',
    width: 1024,
    height: 1366,
    dpr: 2,
    hasNotch: false,
    hasHomeIndicator: true,
    cornerRadius: 18,
    bezelWidth: 20,
    statusBarHeight: 24,
    userAgent: 'tablet',
  },
  {
    id: 'ipad-pro-11',
    name: 'iPad Pro 11"',
    nameAr: 'آيباد برو 11"',
    type: 'tablet',
    width: 834,
    height: 1194,
    dpr: 2,
    hasNotch: false,
    hasHomeIndicator: true,
    cornerRadius: 18,
    bezelWidth: 18,
    statusBarHeight: 24,
    userAgent: 'tablet',
  },
  {
    id: 'ipad-air',
    name: 'iPad Air',
    nameAr: 'آيباد آير',
    type: 'tablet',
    width: 820,
    height: 1180,
    dpr: 2,
    hasNotch: false,
    hasHomeIndicator: true,
    cornerRadius: 18,
    bezelWidth: 16,
    statusBarHeight: 24,
    userAgent: 'tablet',
  },
  {
    id: 'ipad-mini',
    name: 'iPad Mini',
    nameAr: 'آيباد ميني',
    type: 'tablet',
    width: 744,
    height: 1133,
    dpr: 2,
    hasNotch: false,
    hasHomeIndicator: true,
    cornerRadius: 18,
    bezelWidth: 16,
    statusBarHeight: 24,
    userAgent: 'tablet',
  },
  // ═══════════════════════════════════════════════════════════════
  // Tablet - Samsung Galaxy Tab
  // Phase 132.5: تصحيح أبعاد تابلت سامسونج - viewport = native / dpr
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'samsung-tab-s9-ultra',
    name: 'Samsung Tab S9 Ultra',
    nameAr: 'سامسونج تاب S9 ألترا',
    type: 'tablet',
    width: 962,      // 2960 / 3.076 ≈ 962 (14.6" screen, ~320 dpi)
    height: 1538,    // 1848 in landscape → portrait: 1538
    dpr: 2,
    hasNotch: false,
    hasHomeIndicator: false,
    cornerRadius: 14,
    bezelWidth: 12,
    statusBarHeight: 24,
    userAgent: 'tablet',
  },
  {
    id: 'samsung-tab-s9',
    name: 'Samsung Tab S9',
    nameAr: 'سامسونج تاب S9',
    type: 'tablet',
    width: 753,      // 2560 / 3.4 ≈ 753 (11" screen)
    height: 1205,    // 1600 / 3.4 ≈ 470 → swap for portrait
    dpr: 2,
    hasNotch: false,
    hasHomeIndicator: false,
    cornerRadius: 12,
    bezelWidth: 10,
    statusBarHeight: 24,
    userAgent: 'tablet',
  },
  {
    id: 'android-tablet',
    name: 'Android Tablet',
    nameAr: 'تابلت أندرويد',
    type: 'tablet',
    width: 800,      // Generic 10" tablet viewport
    height: 1280,
    dpr: 2,
    hasNotch: false,
    hasHomeIndicator: false,
    cornerRadius: 12,
    bezelWidth: 12,
    statusBarHeight: 24,
    userAgent: 'tablet',
  },
  // Desktop
  {
    id: 'macbook-pro-16',
    name: 'MacBook Pro 16"',
    nameAr: 'ماك بوك برو 16"',
    type: 'desktop',
    width: 1728,
    height: 1117,
    dpr: 2,
    cornerRadius: 10,
    bezelWidth: 24,
    statusBarHeight: 0,
    userAgent: 'desktop',
  },
  {
    id: 'macbook-air-13',
    name: 'MacBook Air 13"',
    nameAr: 'ماك بوك آير 13"',
    type: 'desktop',
    width: 1440,
    height: 900,
    dpr: 2,
    cornerRadius: 10,
    bezelWidth: 20,
    statusBarHeight: 0,
    userAgent: 'desktop',
  },
  {
    id: 'desktop-1080p',
    name: 'Desktop 1080p',
    nameAr: 'سطح مكتب 1080p',
    type: 'desktop',
    width: 1920,
    height: 1080,
    dpr: 1,
    cornerRadius: 0,
    bezelWidth: 0,
    statusBarHeight: 0,
    userAgent: 'desktop',
  },
  {
    id: 'desktop-1440p',
    name: 'Desktop 1440p',
    nameAr: 'سطح مكتب 1440p',
    type: 'desktop',
    width: 2560,
    height: 1440,
    dpr: 1,
    cornerRadius: 0,
    bezelWidth: 0,
    statusBarHeight: 0,
    userAgent: 'desktop',
  },
  // Responsive (no frame)
  {
    id: 'responsive',
    name: 'Responsive',
    nameAr: 'متجاوب',
    type: 'desktop',
    width: 0, // Will use container width
    height: 0, // Will use container height
    dpr: 1,
    cornerRadius: 0,
    bezelWidth: 0,
    statusBarHeight: 0,
    userAgent: 'desktop',
  },
];

/**
 * Get device profile by ID
 */
export function getDeviceProfile(preset: DevicePreset): DeviceProfile | undefined {
  return DEVICE_PROFILES.find(p => p.id === preset);
}

/**
 * Get devices by type
 */
export function getDevicesByType(type: DeviceType): DeviceProfile[] {
  return DEVICE_PROFILES.filter(p => p.type === type);
}

/**
 * Get viewport dimensions considering orientation
 */
export function getViewportDimensions(
  profile: DeviceProfile,
  orientation: DeviceOrientation
): { width: number; height: number } {
  if (orientation === 'landscape' && profile.type !== 'desktop') {
    return { width: profile.height, height: profile.width };
  }
  return { width: profile.width, height: profile.height };
}

/**
 * Default preview state
 */
export const DEFAULT_PREVIEW_STATE: PreviewState = {
  currentPreset: 'iphone-15-pro',
  orientation: 'portrait',
  scale: 'fit',
  url: 'http://localhost:3000',
  isLoading: false,
  showFrame: true,
  autoReload: true,
};
