// desktop/src/components/HealthStatusBadge.tsx
// Phase 127.4: Health Status Badge for Header

import React from 'react';
import { useCodeHealth } from '../state/codeHealthContext';
import { useHealthAlerts } from '../state/healthAlertsContext';
import { computeHealthScore } from '../lib/analysis/codeHealthTypes';
import './HealthStatusBadge.css';

interface Props {
  /** Click handler to open alerts panel */
  onClick: () => void;
  /** Locale for labels */
  locale?: 'ar' | 'en';
}

/**
 * Health Status Badge shown in the header
 * Displays current health score color and unread alert count
 */
export const HealthStatusBadge: React.FC<Props> = ({
  onClick,
  locale = 'ar',
}) => {
  const { snapshots } = useCodeHealth();
  const { unreadCount } = useHealthAlerts();

  const isArabic = locale === 'ar';

  // Get latest snapshot
  const latest = snapshots.length > 0 ? snapshots[0] : null;

  // Compute health score
  const score = computeHealthScore(latest);

  // Labels
  const label = isArabic ? score.labelAr : score.label;
  const title = isArabic ? 'صحة الكود' : 'Code Health';

  return (
    <button
      className="f0-health-badge"
      onClick={onClick}
      title={title}
      type="button"
    >
      <span className={`f0-health-dot dot-${score.color}`} />
      <span className="f0-health-label">{label}</span>
      {unreadCount > 0 && (
        <span className="f0-health-badge-count">{unreadCount}</span>
      )}
    </button>
  );
};

export default HealthStatusBadge;
