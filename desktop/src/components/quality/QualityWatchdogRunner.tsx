// desktop/src/components/quality/QualityWatchdogRunner.tsx
// Phase 132.3: Component to run Quality Watchdog

import { useQualityWatchdog } from '../../lib/quality/useQualityWatchdog';

interface QualityWatchdogRunnerProps {
  enabled?: boolean;
}

/**
 * Component that runs the Quality Watchdog
 * Must be placed inside QualityMonitorProvider and HealthAlertsProvider
 */
export const QualityWatchdogRunner: React.FC<QualityWatchdogRunnerProps> = ({
  enabled = true,
}) => {
  useQualityWatchdog({ enabled });
  return null; // This component renders nothing, just runs the watchdog
};

export default QualityWatchdogRunner;
