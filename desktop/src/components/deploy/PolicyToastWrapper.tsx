// desktop/src/components/deploy/PolicyToastWrapper.tsx
// Phase 135.2: Wrapper component for PolicyToast that uses context

import React from 'react';
import { useDeployQuality } from '../../state/deployQualityContext';
import { PolicyToast } from './PolicyToast';

interface PolicyToastWrapperProps {
  locale?: 'ar' | 'en';
  /** Callback when user clicks to view details (opens deploy gate modal) */
  onViewDetails?: () => void;
}

/**
 * Wrapper that connects PolicyToast to DeployQuality context
 * Automatically shows/hides based on shouldShowToast from context
 */
export const PolicyToastWrapper: React.FC<PolicyToastWrapperProps> = ({
  locale = 'en',
  onViewDetails,
}) => {
  const {
    policyStatus,
    policyResult,
    policyReasons,
    shouldShowToast,
    hidePolicyToast,
  } = useDeployQuality();

  // Don't render if status is OK or toast should not be shown
  if (policyStatus === 'OK' || !shouldShowToast || !policyResult) {
    return null;
  }

  return (
    <PolicyToast
      status={policyStatus}
      reasons={policyReasons}
      summary={policyResult.summary}
      summaryAr={policyResult.summaryAr}
      locale={locale}
      duration={6000}
      onDismiss={hidePolicyToast}
      onViewDetails={onViewDetails}
    />
  );
};

export default PolicyToastWrapper;
