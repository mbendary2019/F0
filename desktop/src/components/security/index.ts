// desktop/src/components/security/index.ts
// Phase 136.0: Security Components Exports
// Phase 136.2: Added SecurityCenterPanel for full Security Center
// Phase 136.3: Added SecurityInlineBadge for editor gutter integration

export { SecurityAlertsPanel } from './SecurityAlertsPanel';
export { SecurityCenterPanel } from './SecurityCenterPanel';
export {
  SecurityInlineBadge,
  useAlertsByLine,
  getSecurityLineDecorations,
  SECURITY_DECORATION_CSS,
} from './SecurityInlineBadge';
