"use strict";
// Sprint 26 Phase 4 - New Functions Only
// This file exports only the new functions to avoid legacy code errors
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugStatus = exports.debugClosePeriod = exports.debugQuotaWarn = exports.debugPushUsage = exports.debugRollup = exports.gateCheck = exports.getUsageMonth = exports.getSubscription = exports.quotaWarning = exports.closeBillingPeriod = exports.pushUsageToStripe = exports.rollupDailyToMonthly = exports.sendTestWebhook = exports.stripeWebhook = exports.createBillingPortalLink = exports.revokeApiKey = exports.listApiKeys = exports.createApiKey = void 0;
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin once
if (!admin.apps.length) {
    admin.initializeApp();
}
// Export API Keys functions
var apiKeys_1 = require("./apiKeys");
Object.defineProperty(exports, "createApiKey", { enumerable: true, get: function () { return apiKeys_1.createApiKey; } });
Object.defineProperty(exports, "listApiKeys", { enumerable: true, get: function () { return apiKeys_1.listApiKeys; } });
Object.defineProperty(exports, "revokeApiKey", { enumerable: true, get: function () { return apiKeys_1.revokeApiKey; } });
// Export Billing functions
var billing_1 = require("./billing");
Object.defineProperty(exports, "createBillingPortalLink", { enumerable: true, get: function () { return billing_1.createBillingPortalLink; } });
Object.defineProperty(exports, "stripeWebhook", { enumerable: true, get: function () { return billing_1.stripeWebhook; } });
// Export Webhooks Test function
var webhooksTest_1 = require("./webhooksTest");
Object.defineProperty(exports, "sendTestWebhook", { enumerable: true, get: function () { return webhooksTest_1.sendTestWebhook; } });
// Sprint 27 – Phase 5 Schedulers
var aggregateMonthly_1 = require("./aggregateMonthly");
Object.defineProperty(exports, "rollupDailyToMonthly", { enumerable: true, get: function () { return aggregateMonthly_1.rollupDailyToMonthly; } });
var overage_1 = require("./overage");
Object.defineProperty(exports, "pushUsageToStripe", { enumerable: true, get: function () { return overage_1.pushUsageToStripe; } });
var periodClose_1 = require("./periodClose");
Object.defineProperty(exports, "closeBillingPeriod", { enumerable: true, get: function () { return periodClose_1.closeBillingPeriod; } });
var quotaWarn_1 = require("./quotaWarn");
Object.defineProperty(exports, "quotaWarning", { enumerable: true, get: function () { return quotaWarn_1.quotaWarning; } });
// Sprint 27 – Phase 5 Callables (Billing UI + Gate)
var subscriptionRead_1 = require("./subscriptionRead");
Object.defineProperty(exports, "getSubscription", { enumerable: true, get: function () { return subscriptionRead_1.getSubscription; } });
var usageMonthRead_1 = require("./usageMonthRead");
Object.defineProperty(exports, "getUsageMonth", { enumerable: true, get: function () { return usageMonthRead_1.getUsageMonth; } });
var gateCheck_1 = require("./gateCheck");
Object.defineProperty(exports, "gateCheck", { enumerable: true, get: function () { return gateCheck_1.gateCheck; } });
// Admin Debug (manual scheduler triggers)
var debugSchedulers_1 = require("./debugSchedulers");
Object.defineProperty(exports, "debugRollup", { enumerable: true, get: function () { return debugSchedulers_1.debugRollup; } });
Object.defineProperty(exports, "debugPushUsage", { enumerable: true, get: function () { return debugSchedulers_1.debugPushUsage; } });
Object.defineProperty(exports, "debugQuotaWarn", { enumerable: true, get: function () { return debugSchedulers_1.debugQuotaWarn; } });
Object.defineProperty(exports, "debugClosePeriod", { enumerable: true, get: function () { return debugSchedulers_1.debugClosePeriod; } });
Object.defineProperty(exports, "debugStatus", { enumerable: true, get: function () { return debugSchedulers_1.debugStatus; } });
//# sourceMappingURL=index-new.js.map