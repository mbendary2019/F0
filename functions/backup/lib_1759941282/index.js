"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.creatorPayoutsDaily = exports.creatorEarningsDaily = exports.reconcileTransfersHourly = exports.refundOrder = exports.analyticsFunnelsHourly = exports.reindexProducts = exports.onProductWrite = exports.analyticsAdvancedDaily = exports.upsertCouponCode = exports.createStripeCoupon = exports.onReviewStatusChange = exports.analyticsDaily = exports.approveReview = exports.submitReview = exports.createDashboardLink = exports.createAccountLink = exports.createConnectAccount = exports.generateDownloadUrl = exports.marketplaceWebhook = exports.createCheckoutSession = exports.policyValidate = exports.redteamRunNightly = exports.redteamRun = exports.safeRegenerate = exports.redactPII = exports.hitlResolve = exports.hitlAssign = exports.hitlQueueIngest = exports.aiGovFlagRateAlert = exports.aiGovCleanup = exports.createAIGovernanceReport = exports.logAiEval = exports.generateLegalReport = exports.triggerRetentionCleanup = exports.retentionCleaner = exports.autoProcessDSAR = exports.cleanupExpiredExports = exports.processDeletions = exports.retentionSweep = exports.onDsarRequest = exports.driftDetector = exports.hourlyRedTeam = exports.nightlyEvals = exports.watchFunctionErrors = exports.watchQuotaBreach = exports.watchAuthFails = exports.watchErrorRate = exports.resetDailyQuotas = exports.aggregateDailyUsage = exports.syncClaimsOnEntitlementsWrite = void 0;
exports.sendTestWebhook = exports.createBillingPortalLink = exports.revokeApiKey = exports.listApiKeys = exports.createApiKey = exports.verifyBackupCode = exports.generateBackupCodes = exports.createStripeCustomer = exports.stripeWebhook = exports.customerVatStatementsMonthly = exports.generateCustomerVatStatement = exports.autoInvoiceOnOrderPaid = exports.guessRegionCurrency = exports.exportTaxReport = exports.generateVatInvoice = exports.convertPrice = exports.syncFxRates = exports.validateTaxId = exports.accountingDailyRollup = exports.accountingMonthlyExport = exports.generatePlatformMonthlyReport = exports.alertsWatcherQuarterHour = exports.submitDisputeEvidence = exports.creatorPayoutReconDaily = exports.generateMonthlyStatements = exports.generateCreatorStatement = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const crypto = __importStar(require("crypto"));
// Initialize Firebase Admin
admin.initializeApp();
// Export claims sync function
var claims_1 = require("./claims");
Object.defineProperty(exports, "syncClaimsOnEntitlementsWrite", { enumerable: true, get: function () { return claims_1.syncClaimsOnEntitlementsWrite; } });
// Export usage aggregation functions
var usage_1 = require("./usage");
Object.defineProperty(exports, "aggregateDailyUsage", { enumerable: true, get: function () { return usage_1.aggregateDailyUsage; } });
Object.defineProperty(exports, "resetDailyQuotas", { enumerable: true, get: function () { return usage_1.resetDailyQuotas; } });
// Export alert monitoring functions
var alerts_1 = require("./alerts");
Object.defineProperty(exports, "watchErrorRate", { enumerable: true, get: function () { return alerts_1.watchErrorRate; } });
Object.defineProperty(exports, "watchAuthFails", { enumerable: true, get: function () { return alerts_1.watchAuthFails; } });
Object.defineProperty(exports, "watchQuotaBreach", { enumerable: true, get: function () { return alerts_1.watchQuotaBreach; } });
Object.defineProperty(exports, "watchFunctionErrors", { enumerable: true, get: function () { return alerts_1.watchFunctionErrors; } });
// Export evaluation functions
var evals_1 = require("./evals");
Object.defineProperty(exports, "nightlyEvals", { enumerable: true, get: function () { return evals_1.nightlyEvals; } });
Object.defineProperty(exports, "hourlyRedTeam", { enumerable: true, get: function () { return evals_1.hourlyRedTeam; } });
Object.defineProperty(exports, "driftDetector", { enumerable: true, get: function () { return evals_1.driftDetector; } });
// Export compliance functions
var compliance_1 = require("./compliance");
Object.defineProperty(exports, "onDsarRequest", { enumerable: true, get: function () { return compliance_1.onDsarRequest; } });
Object.defineProperty(exports, "retentionSweep", { enumerable: true, get: function () { return compliance_1.retentionSweep; } });
Object.defineProperty(exports, "processDeletions", { enumerable: true, get: function () { return compliance_1.processDeletions; } });
Object.defineProperty(exports, "cleanupExpiredExports", { enumerable: true, get: function () { return compliance_1.cleanupExpiredExports; } });
// Export Sprint 12 functions
var autoApproval_1 = require("./autoApproval");
Object.defineProperty(exports, "autoProcessDSAR", { enumerable: true, get: function () { return autoApproval_1.autoProcessDSAR; } });
var retentionCleaner_1 = require("./retentionCleaner");
Object.defineProperty(exports, "retentionCleaner", { enumerable: true, get: function () { return retentionCleaner_1.retentionCleaner; } });
Object.defineProperty(exports, "triggerRetentionCleanup", { enumerable: true, get: function () { return retentionCleaner_1.triggerRetentionCleanup; } });
var legalReport_1 = require("./legalReport");
Object.defineProperty(exports, "generateLegalReport", { enumerable: true, get: function () { return legalReport_1.generateLegalReport; } });
// Export Sprint 13 functions (AI Governance)
var logEval_1 = require("./aiGovernance/logEval");
Object.defineProperty(exports, "logAiEval", { enumerable: true, get: function () { return logEval_1.logAiEval; } });
var report_1 = require("./aiGovernance/report");
Object.defineProperty(exports, "createAIGovernanceReport", { enumerable: true, get: function () { return report_1.createAIGovernanceReport; } });
var cleanup_1 = require("./aiGovernance/cleanup");
Object.defineProperty(exports, "aiGovCleanup", { enumerable: true, get: function () { return cleanup_1.aiGovCleanup; } });
var alerts_2 = require("./aiGovernance/alerts");
Object.defineProperty(exports, "aiGovFlagRateAlert", { enumerable: true, get: function () { return alerts_2.aiGovFlagRateAlert; } });
// Export Sprint 14 functions (HITL Reviews - Phase 1 & 2)
var queueIngest_1 = require("./hitl/queueIngest");
Object.defineProperty(exports, "hitlQueueIngest", { enumerable: true, get: function () { return queueIngest_1.hitlQueueIngest; } });
var assign_1 = require("./hitl/assign");
Object.defineProperty(exports, "hitlAssign", { enumerable: true, get: function () { return assign_1.hitlAssign; } });
var resolve_1 = require("./hitl/resolve");
Object.defineProperty(exports, "hitlResolve", { enumerable: true, get: function () { return resolve_1.hitlResolve; } });
var redactPII_1 = require("./hitl/redactPII");
Object.defineProperty(exports, "redactPII", { enumerable: true, get: function () { return redactPII_1.redactPII; } });
var safeRegenerate_1 = require("./hitl/safeRegenerate");
Object.defineProperty(exports, "safeRegenerate", { enumerable: true, get: function () { return safeRegenerate_1.safeRegenerate; } });
// Export Sprint 14 functions (Red-Teaming - Phase 3)
var run_1 = require("./redteam/run");
Object.defineProperty(exports, "redteamRun", { enumerable: true, get: function () { return run_1.redteamRun; } });
Object.defineProperty(exports, "redteamRunNightly", { enumerable: true, get: function () { return run_1.redteamRunNightly; } });
// Export Sprint 14 functions (Policies - Phase 4)
var validate_1 = require("./policy/validate");
Object.defineProperty(exports, "policyValidate", { enumerable: true, get: function () { return validate_1.policyValidate; } });
// Export Sprint 15 functions (Marketplace MVP)
var checkout_1 = require("./market/checkout");
Object.defineProperty(exports, "createCheckoutSession", { enumerable: true, get: function () { return checkout_1.createCheckoutSession; } });
var webhook_1 = require("./market/webhook");
Object.defineProperty(exports, "marketplaceWebhook", { enumerable: true, get: function () { return webhook_1.marketplaceWebhook; } });
var download_1 = require("./market/download");
Object.defineProperty(exports, "generateDownloadUrl", { enumerable: true, get: function () { return download_1.generateDownloadUrl; } });
// Export Sprint 16 functions (Creator Program)
var connect_1 = require("./creator/connect");
Object.defineProperty(exports, "createConnectAccount", { enumerable: true, get: function () { return connect_1.createConnectAccount; } });
Object.defineProperty(exports, "createAccountLink", { enumerable: true, get: function () { return connect_1.createAccountLink; } });
Object.defineProperty(exports, "createDashboardLink", { enumerable: true, get: function () { return connect_1.createDashboardLink; } });
// Export Sprint 17 functions (Growth Features)
var reviews_1 = require("./reviews/reviews");
Object.defineProperty(exports, "submitReview", { enumerable: true, get: function () { return reviews_1.submitReview; } });
Object.defineProperty(exports, "approveReview", { enumerable: true, get: function () { return reviews_1.approveReview; } });
var daily_1 = require("./analytics/daily");
Object.defineProperty(exports, "analyticsDaily", { enumerable: true, get: function () { return daily_1.analyticsDaily; } });
var media_1 = require("./reviews/media");
Object.defineProperty(exports, "onReviewStatusChange", { enumerable: true, get: function () { return media_1.onReviewStatusChange; } });
// Export Sprint 17 Phase 3 functions (Coupons + Advanced Analytics)
var createStripeCoupon_1 = require("./coupons/createStripeCoupon");
Object.defineProperty(exports, "createStripeCoupon", { enumerable: true, get: function () { return createStripeCoupon_1.createStripeCoupon; } });
var upsertCode_1 = require("./coupons/upsertCode");
Object.defineProperty(exports, "upsertCouponCode", { enumerable: true, get: function () { return upsertCode_1.upsertCouponCode; } });
var advancedDaily_1 = require("./analytics/advancedDaily");
Object.defineProperty(exports, "analyticsAdvancedDaily", { enumerable: true, get: function () { return advancedDaily_1.analyticsAdvancedDaily; } });
// Export Sprint 17 Phase 4 functions (Search 2.0 + Funnels)
var indexer_1 = require("./search/indexer");
Object.defineProperty(exports, "onProductWrite", { enumerable: true, get: function () { return indexer_1.onProductWrite; } });
Object.defineProperty(exports, "reindexProducts", { enumerable: true, get: function () { return indexer_1.reindexProducts; } });
var funnelsHourly_1 = require("./analytics/funnelsHourly");
Object.defineProperty(exports, "analyticsFunnelsHourly", { enumerable: true, get: function () { return funnelsHourly_1.analyticsFunnelsHourly; } });
// Export Sprint 18 Phase 1 functions (Creator Finance - Refunds/Reconciliation/Earnings)
var refunds_1 = require("./market/refunds");
Object.defineProperty(exports, "refundOrder", { enumerable: true, get: function () { return refunds_1.refundOrder; } });
var reconcile_1 = require("./market/reconcile");
Object.defineProperty(exports, "reconcileTransfersHourly", { enumerable: true, get: function () { return reconcile_1.reconcileTransfersHourly; } });
var earnings_1 = require("./creator/earnings");
Object.defineProperty(exports, "creatorEarningsDaily", { enumerable: true, get: function () { return earnings_1.creatorEarningsDaily; } });
// Export Sprint 18 Phase 2 functions (Payouts/Disputes/Statements)
var payouts_1 = require("./finance/payouts");
Object.defineProperty(exports, "creatorPayoutsDaily", { enumerable: true, get: function () { return payouts_1.creatorPayoutsDaily; } });
var statements_1 = require("./creator/statements");
Object.defineProperty(exports, "generateCreatorStatement", { enumerable: true, get: function () { return statements_1.generateCreatorStatement; } });
Object.defineProperty(exports, "generateMonthlyStatements", { enumerable: true, get: function () { return statements_1.generateMonthlyStatements; } });
// Export Sprint 18 Phase 3 functions (Recon/Evidence/Alerts/Platform Reports)
var payoutRecon_1 = require("./finance/payoutRecon");
Object.defineProperty(exports, "creatorPayoutReconDaily", { enumerable: true, get: function () { return payoutRecon_1.creatorPayoutReconDaily; } });
var disputesEvidence_1 = require("./market/disputesEvidence");
Object.defineProperty(exports, "submitDisputeEvidence", { enumerable: true, get: function () { return disputesEvidence_1.submitDisputeEvidence; } });
var refundWatcher_1 = require("./alerts/refundWatcher");
Object.defineProperty(exports, "alertsWatcherQuarterHour", { enumerable: true, get: function () { return refundWatcher_1.alertsWatcherQuarterHour; } });
var reports_1 = require("./platform/reports");
Object.defineProperty(exports, "generatePlatformMonthlyReport", { enumerable: true, get: function () { return reports_1.generatePlatformMonthlyReport; } });
// Export Sprint 18 Phase 4 functions (Accounting)
var export_1 = require("./accounting/export");
Object.defineProperty(exports, "accountingMonthlyExport", { enumerable: true, get: function () { return export_1.accountingMonthlyExport; } });
var daily_2 = require("./accounting/daily");
Object.defineProperty(exports, "accountingDailyRollup", { enumerable: true, get: function () { return daily_2.accountingDailyRollup; } });
// Export Sprint 19 Phase 1 functions (Taxes & Multi-Currency)
var validateVat_1 = require("./tax/validateVat");
Object.defineProperty(exports, "validateTaxId", { enumerable: true, get: function () { return validateVat_1.validateTaxId; } });
var syncRates_1 = require("./fx/syncRates");
Object.defineProperty(exports, "syncFxRates", { enumerable: true, get: function () { return syncRates_1.syncFxRates; } });
var convert_1 = require("./fx/convert");
Object.defineProperty(exports, "convertPrice", { enumerable: true, get: function () { return convert_1.convertPrice; } });
// Export Sprint 19 Phase 2 functions (Pricing Overrides • VAT Invoices • Tax Reports)
var invoice_1 = require("./tax/invoice");
Object.defineProperty(exports, "generateVatInvoice", { enumerable: true, get: function () { return invoice_1.generateVatInvoice; } });
var reports_2 = require("./tax/reports");
Object.defineProperty(exports, "exportTaxReport", { enumerable: true, get: function () { return reports_2.exportTaxReport; } });
var region_1 = require("./pricing/region");
Object.defineProperty(exports, "guessRegionCurrency", { enumerable: true, get: function () { return region_1.guessRegionCurrency; } });
// Export Sprint 19 Phase 3 functions (Region Pricing • Auto-Invoice • Customer Statements • Bundles)
var autoInvoice_1 = require("./tax/autoInvoice");
Object.defineProperty(exports, "autoInvoiceOnOrderPaid", { enumerable: true, get: function () { return autoInvoice_1.autoInvoiceOnOrderPaid; } });
var customerStatements_1 = require("./tax/customerStatements");
Object.defineProperty(exports, "generateCustomerVatStatement", { enumerable: true, get: function () { return customerStatements_1.generateCustomerVatStatement; } });
Object.defineProperty(exports, "customerVatStatementsMonthly", { enumerable: true, get: function () { return customerStatements_1.customerVatStatementsMonthly; } });
// Initialize Stripe
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
});
/**
 * Stripe Webhook Handler
 * Handles subscription events from Stripe and updates Firestore entitlements
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    var _a;
    // Accept only POST requests
    if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
    }
    const sig = req.headers["stripe-signature"];
    if (!sig) {
        return res.status(400).send("Missing stripe-signature header");
    }
    let event;
    try {
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    }
    catch (err) {
        console.error("⚠️  Webhook signature verification failed.", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    console.log(`✅ Received event: ${event.type}`);
    /**
     * Helper function to update user entitlements in Firestore
     */
    const upsertEntitlements = async (sub) => {
        var _a, _b, _c;
        try {
            // Get UID from subscription metadata
            const uid = ((_a = sub.metadata) === null || _a === void 0 ? void 0 : _a.uid) || null;
            if (!uid) {
                console.warn("⚠️  No UID found in subscription metadata:", sub.id);
                return;
            }
            // Determine subscription status
            const active = sub.status === "active" || sub.status === "trialing";
            // Get tier from price nickname or default to 'pro'
            const tier = (((_c = (_b = sub.items.data[0]) === null || _b === void 0 ? void 0 : _b.price) === null || _c === void 0 ? void 0 : _c.nickname) || "pro").toLowerCase();
            // Get period end timestamp
            const periodEnd = sub.current_period_end * 1000;
            // Prepare entitlements data
            const entitlements = {
                provider: "stripe",
                active,
                tier,
                periodEnd: admin.firestore.Timestamp.fromMillis(periodEnd),
                customerId: sub.customer,
                subscriptionId: sub.id,
                status: sub.status,
                cancelAtPeriodEnd: sub.cancel_at_period_end,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            // Update Firestore
            await admin
                .firestore()
                .doc(`users/${uid}`)
                .set({
                entitlements,
            }, { merge: true });
            console.log(`✅ Updated entitlements for user ${uid}:`, JSON.stringify(entitlements, null, 2));
        }
        catch (error) {
            console.error("❌ Error updating entitlements:", error.message);
            throw error;
        }
    };
    // Handle different webhook events
    try {
        switch (event.type) {
            case "customer.subscription.created":
                console.log("📝 Subscription created");
                await upsertEntitlements(event.data.object);
                break;
            case "customer.subscription.updated":
                console.log("🔄 Subscription updated");
                await upsertEntitlements(event.data.object);
                break;
            case "customer.subscription.deleted":
                console.log("🗑️  Subscription deleted");
                await upsertEntitlements(event.data.object);
                break;
            case "invoice.payment_succeeded":
                console.log("💰 Payment succeeded");
                const invoice = event.data.object;
                if (invoice.subscription) {
                    const sub = await stripe.subscriptions.retrieve(invoice.subscription);
                    await upsertEntitlements(sub);
                }
                break;
            case "invoice.payment_failed":
                console.log("❌ Payment failed");
                const failedInvoice = event.data.object;
                if (failedInvoice.subscription) {
                    const sub = await stripe.subscriptions.retrieve(failedInvoice.subscription);
                    await upsertEntitlements(sub);
                }
                break;
            case "checkout.session.completed":
                console.log("🎉 Checkout session completed");
                const session = event.data.object;
                // If this is a subscription checkout, retrieve and process it
                if (session.subscription) {
                    const sub = await stripe.subscriptions.retrieve(session.subscription);
                    await upsertEntitlements(sub);
                }
                // Optionally link customer to Firebase user via metadata
                if (session.customer && ((_a = session.metadata) === null || _a === void 0 ? void 0 : _a.uid)) {
                    const uid = session.metadata.uid;
                    await admin
                        .firestore()
                        .doc(`users/${uid}`)
                        .set({
                        stripeCustomerId: session.customer,
                    }, { merge: true });
                    console.log(`✅ Linked customer ${session.customer} to user ${uid}`);
                }
                break;
            default:
                console.log(`⏭️  Unhandled event type: ${event.type}`);
        }
        res.json({ received: true });
    }
    catch (error) {
        console.error("❌ Error processing webhook:", error.message);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Create Stripe Customer
 * Creates a Stripe customer for a Firebase user
 */
exports.createStripeCustomer = functions.auth.user().onCreate(async (user) => {
    try {
        const customer = await stripe.customers.create({
            email: user.email,
            metadata: {
                uid: user.uid,
            },
        });
        await admin
            .firestore()
            .doc(`users/${user.uid}`)
            .set({
            stripeCustomerId: customer.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`✅ Created Stripe customer ${customer.id} for user ${user.uid}`);
    }
    catch (error) {
        console.error("❌ Error creating Stripe customer:", error.message);
    }
});
/**
 * Helper function to hash backup codes
 */
function hashCode(code) {
    return crypto.createHash("sha256").update(code).digest("hex");
}
/**
 * Generate and store backup recovery codes
 * Called via HTTPS with Authorization header
 */
exports.generateBackupCodes = functions.https.onRequest(async (req, res) => {
    // CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    try {
        // Verify Firebase ID token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const { codes } = req.body;
        if (!codes || !Array.isArray(codes) || codes.length === 0) {
            res.status(400).json({ error: "Invalid codes" });
            return;
        }
        // Hash all codes before storing
        const hashedCodes = codes.map((code) => ({
            hash: hashCode(code),
            used: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }));
        // Store in Firestore
        await admin
            .firestore()
            .doc(`users/${uid}`)
            .set({
            backupCodes: hashedCodes,
            backupCodesGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`✅ Generated ${codes.length} backup codes for user ${uid}`);
        res.json({
            success: true,
            count: codes.length,
        });
    }
    catch (error) {
        console.error("❌ Error generating backup codes:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
});
/**
 * Verify backup code and disable all MFA factors
 * Emergency recovery function
 */
exports.verifyBackupCode = functions.https.onRequest(async (req, res) => {
    // CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            res.status(400).json({ error: "Email and code required" });
            return;
        }
        // Get user by email
        const userRecord = await admin.auth().getUserByEmail(email);
        const uid = userRecord.uid;
        // Get backup codes from Firestore
        const userDoc = await admin.firestore().doc(`users/${uid}`).get();
        const userData = userDoc.data();
        if (!(userData === null || userData === void 0 ? void 0 : userData.backupCodes) || userData.backupCodes.length === 0) {
            res.status(404).json({ error: "No backup codes found" });
            return;
        }
        // Hash the provided code
        const codeHash = hashCode(code);
        // Find matching unused code
        const codeIndex = userData.backupCodes.findIndex((c) => c.hash === codeHash && !c.used);
        if (codeIndex === -1) {
            res.status(401).json({ error: "Invalid or used backup code" });
            return;
        }
        // Mark code as used
        userData.backupCodes[codeIndex].used = true;
        userData.backupCodes[codeIndex].usedAt = admin.firestore.FieldValue.serverTimestamp();
        await admin.firestore().doc(`users/${uid}`).update({
            backupCodes: userData.backupCodes,
        });
        // Disable all MFA factors
        await admin.auth().updateUser(uid, {
            multiFactor: {
                enrolledFactors: [],
            },
        });
        console.log(`✅ Backup code verified for user ${uid}, MFA disabled`);
        // Send email notification
        // TODO: Implement email notification
        res.json({
            success: true,
            message: "Backup code verified. All MFA factors have been removed. Please sign in and re-enable MFA.",
        });
    }
    catch (error) {
        console.error("❌ Error verifying backup code:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
});
// Export Sprint 26 Phase 4 functions (API Keys, Billing & Webhooks)
var apiKeys_1 = require("./apiKeys");
Object.defineProperty(exports, "createApiKey", { enumerable: true, get: function () { return apiKeys_1.createApiKey; } });
Object.defineProperty(exports, "listApiKeys", { enumerable: true, get: function () { return apiKeys_1.listApiKeys; } });
Object.defineProperty(exports, "revokeApiKey", { enumerable: true, get: function () { return apiKeys_1.revokeApiKey; } });
var billing_1 = require("./billing");
Object.defineProperty(exports, "createBillingPortalLink", { enumerable: true, get: function () { return billing_1.createBillingPortalLink; } });
var webhooksTest_1 = require("./webhooksTest");
Object.defineProperty(exports, "sendTestWebhook", { enumerable: true, get: function () { return webhooksTest_1.sendTestWebhook; } });
//# sourceMappingURL=index.js.map