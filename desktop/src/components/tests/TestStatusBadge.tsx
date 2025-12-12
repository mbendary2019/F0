// desktop/src/components/tests/TestStatusBadge.tsx
// Phase 133.1: Test Status Badge for file tree and editor header

import React from 'react';
import type { TestLabStatus } from '../../lib/tests/testLabTypes';

interface Props {
  /** Test status for the file */
  status: TestLabStatus | null;
  /** Size of the badge */
  size?: 'sm' | 'md' | 'lg';
  /** Show label text */
  showLabel?: boolean;
  /** Locale for labels */
  locale?: 'ar' | 'en';
}

/**
 * Status colors and icons
 */
const STATUS_CONFIG: Record<TestLabStatus, { icon: string; color: string; bgColor: string; label: { ar: string; en: string } }> = {
  passing: {
    icon: '✓',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    label: { ar: 'ناجح', en: 'Passing' },
  },
  failing: {
    icon: '✗',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    label: { ar: 'فاشل', en: 'Failing' },
  },
  pending: {
    icon: '○',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    label: { ar: 'معلق', en: 'Pending' },
  },
  skipped: {
    icon: '⊘',
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.15)',
    label: { ar: 'متجاوز', en: 'Skipped' },
  },
};

/**
 * Size configurations
 */
const SIZE_CONFIG = {
  sm: { fontSize: 10, padding: '1px 4px', iconSize: 8 },
  md: { fontSize: 11, padding: '2px 6px', iconSize: 10 },
  lg: { fontSize: 12, padding: '3px 8px', iconSize: 12 },
};

/**
 * Test Status Badge Component
 * Shows visual indicator for test status on files
 */
export const TestStatusBadge: React.FC<Props> = ({
  status,
  size = 'sm',
  showLabel = false,
  locale = 'ar',
}) => {
  // No badge if no status
  if (!status) return null;

  const config = STATUS_CONFIG[status];
  const sizeConfig = SIZE_CONFIG[size];

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: showLabel ? 4 : 0,
    padding: sizeConfig.padding,
    fontSize: sizeConfig.fontSize,
    fontWeight: 600,
    color: config.color,
    backgroundColor: config.bgColor,
    borderRadius: 4,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  };

  const iconStyle: React.CSSProperties = {
    fontSize: sizeConfig.iconSize,
    lineHeight: 1,
  };

  return (
    <span style={style} title={config.label[locale]}>
      <span style={iconStyle}>{config.icon}</span>
      {showLabel && <span>{config.label[locale]}</span>}
    </span>
  );
};

/**
 * Inline dot indicator for file tree
 */
export const TestStatusDot: React.FC<{ status: TestLabStatus | null }> = ({ status }) => {
  if (!status) return null;

  const config = STATUS_CONFIG[status];

  const style: React.CSSProperties = {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: config.color,
    marginLeft: 4,
    flexShrink: 0,
  };

  return <span style={style} />;
};

export default TestStatusBadge;
