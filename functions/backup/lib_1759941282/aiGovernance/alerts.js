"use strict";
/**
 * AI Governance - Alert Scheduled Function
 * Monitors flagged rate and sends alerts when threshold is exceeded
 */
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
exports.aiGovFlagRateAlert = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const functions = __importStar(require("firebase-functions"));
/**
 * Scheduled alert job (runs every 60 minutes)
 * Checks flagged rate in the last 24 hours and sends alert if above threshold
 */
exports.aiGovFlagRateAlert = (0, scheduler_1.onSchedule)('every 60 minutes', async () => {
    var _a;
    const db = admin.firestore();
    console.log('🔔 Checking AI Governance flag rate...');
    try {
        // Get evaluations from last 24 hours
        const since = Date.now() - 24 * 60 * 60 * 1000;
        const snaps = await db
            .collectionGroup('runs')
            .where('meta.ts', '>=', since)
            .get();
        const total = snaps.size || 1; // Avoid division by zero
        const flagged = snaps.docs.filter((d) => !!d.data().flagged).length;
        const ratePct = (flagged / total) * 100;
        console.log(`📊 Last 24h: ${total} evals, ${flagged} flagged (${ratePct.toFixed(1)}%)`);
        // Get alert threshold from config
        const cfgRef = db.collection('config').doc('ai_governance');
        const cfg = (await cfgRef.get()).data() || {};
        const limitPct = (_a = cfg.alertFlagRatePct) !== null && _a !== void 0 ? _a : 10;
        console.log(`🎯 Alert threshold: ${limitPct}%`);
        // Check if threshold exceeded
        if (ratePct >= limitPct) {
            console.warn(`⚠️  Flag rate ${ratePct.toFixed(1)}% exceeds threshold ${limitPct}%`);
            // Send alert
            await sendAlert({
                ratePct,
                limitPct,
                total,
                flagged,
            });
            // Log alert to audit trail
            await db.collection('audit_logs').add({
                ts: admin.firestore.FieldValue.serverTimestamp(),
                actor: 'system',
                action: 'ai_gov.alert.flag_rate',
                resource: 'ai_evals',
                status: 'warning',
                metadata: {
                    flagRate: ratePct,
                    threshold: limitPct,
                    total,
                    flagged,
                    period: '24h',
                },
            });
        }
        else {
            console.log('✅ Flag rate within acceptable range');
        }
    }
    catch (error) {
        console.error('❌ Error checking flag rate:', error);
        // Log error to audit trail
        await db
            .collection('audit_logs')
            .add({
            ts: admin.firestore.FieldValue.serverTimestamp(),
            actor: 'system',
            action: 'ai_gov.alert.flag_rate',
            resource: 'ai_evals',
            status: 'error',
            metadata: {
                error: error instanceof Error ? error.message : String(error),
            },
        })
            .catch(() => { }); // Ignore logging errors
    }
});
/**
 * Send alert via Slack or Discord webhook
 */
async function sendAlert(data) {
    var _a, _b;
    const { ratePct, limitPct, total, flagged } = data;
    // Get webhook URL from Functions config
    const slackUrl = (_a = functions.config().alerts) === null || _a === void 0 ? void 0 : _a.slack_webhook;
    const discordUrl = (_b = functions.config().alerts) === null || _b === void 0 ? void 0 : _b.discord_webhook;
    const url = slackUrl || discordUrl;
    if (!url) {
        console.warn('⚠️  No webhook URL configured, skipping alert notification');
        return;
    }
    const message = `🚨 **AI Governance Alert**

Flagged rate has exceeded the threshold in the last 24 hours.

• **Flagged Rate:** ${ratePct.toFixed(1)}%
• **Threshold:** ${limitPct}%
• **Total Evaluations:** ${total}
• **Flagged Outputs:** ${flagged}

Please review the AI Governance dashboard for details.`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.assign(Object.assign({ text: message }, (slackUrl && {
                attachments: [
                    {
                        color: 'danger',
                        fields: [
                            {
                                title: 'Flagged Rate',
                                value: `${ratePct.toFixed(1)}%`,
                                short: true,
                            },
                            {
                                title: 'Threshold',
                                value: `${limitPct}%`,
                                short: true,
                            },
                            {
                                title: 'Total Evaluations',
                                value: total.toString(),
                                short: true,
                            },
                            {
                                title: 'Flagged Outputs',
                                value: flagged.toString(),
                                short: true,
                            },
                        ],
                    },
                ],
            })), (discordUrl && {
                embeds: [
                    {
                        title: '🚨 AI Governance Alert',
                        description: message,
                        color: 15158332, // Red
                        timestamp: new Date().toISOString(),
                    },
                ],
            }))),
        });
        if (response.ok) {
            console.log('✅ Alert sent successfully');
        }
        else {
            console.error(`❌ Failed to send alert: ${response.status} ${response.statusText}`);
        }
    }
    catch (error) {
        console.error('❌ Error sending alert:', error);
    }
}
//# sourceMappingURL=alerts.js.map