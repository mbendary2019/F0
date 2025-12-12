// desktop/src/components/preview/index.ts
// Phase 131: Mobile Preview & Device Lab Exports

export { DeviceFrame } from './DeviceFrame';
export { DeviceSwitcher } from './DeviceSwitcher';
export { MobilePreviewPane } from './MobilePreviewPane';
export { QRCodePanel } from './QRCodePanel';

// Re-export types
export type {
  DeviceType,
  DevicePreset,
  DeviceOrientation,
  PreviewScale,
  DeviceProfile,
  PreviewState,
  PreviewActions,
} from '../../lib/preview/previewTypes';

// Re-export context
export { PreviewDevicesProvider, usePreviewDevices, usePreviewDevicesOptional } from '../../state/previewDevicesContext';
