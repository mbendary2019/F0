/**
 * Phase 180: Agent Module Exports
 * Central exports for all agent modules
 */

// Shell Agent (Phase 180.1)
export {
  detectShellCommandIntent,
  formatShellResult,
  formatBlockedMessage,
  type ShellCommandIntent,
} from './shellAgent';

// Browser Agent (Phase 180.2)
export {
  detectBrowserIntent,
  fetchWebContent,
  formatFetchedContent,
  formatBlockedUrlMessage,
  type BrowserFetchIntent,
  type FetchedContent,
} from './browserAgent';

// Agent Message Handler (existing)
export {
  buildRagEnrichedMessages,
  buildRagContextForCloudAgent,
  type HandleAgentMessageInput,
  type RagEnrichedResult,
} from './handleAgentMessage';
