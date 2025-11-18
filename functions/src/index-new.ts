// Sprint 26 Phase 4 - New Functions Only
// This file exports only the new functions to avoid legacy code errors

import * as admin from "firebase-admin";

// Initialize Firebase Admin once
if (!admin.apps.length) {
  admin.initializeApp();
}

// Export API Keys functions
export { createApiKey, listApiKeys, revokeApiKey } from "./apiKeys";

// Export Billing functions
export { createBillingPortalLink, stripeWebhook } from "./billing";

// Export Webhooks Test function
export { sendTestWebhook } from "./webhooksTest";

// Sprint 27 – Phase 5 Schedulers
export { rollupDailyToMonthly } from "./aggregateMonthly";
export { pushUsageToStripe } from "./overage";
export { closeBillingPeriod } from "./periodClose";
export { quotaWarning } from "./quotaWarn";

// Sprint 27 – Phase 5 Callables (Billing UI + Gate)
export { getSubscription } from "./subscriptionRead";
export { getUsageMonth } from "./usageMonthRead";
export { gateCheck } from "./gateCheck";

// Admin Debug (manual scheduler triggers)
export { debugRollup, debugPushUsage, debugQuotaWarn, debugClosePeriod, debugStatus } from "./debugSchedulers";
