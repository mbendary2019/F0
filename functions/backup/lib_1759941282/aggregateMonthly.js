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
Object.defineProperty(exports, "__esModule", { value: true });
exports.rollupDailyToMonthly = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
function monthKey(d = new Date()) {
    return d.toISOString().slice(0, 7); // YYYY-MM
}
/** Rollup daily usage to monthly (every 3 hours) */
exports.rollupDailyToMonthly = (0, scheduler_1.onSchedule)('every 3 hours', async () => {
    console.log('🔄 Starting daily → monthly rollup');
    const users = await db.collection('users').limit(1000).get();
    let processed = 0;
    for (const u of users.docs) {
        const uid = u.id;
        const mk = monthKey();
        try {
            // Get all daily docs for current month
            const dcol = db.collection(`usage_logs/${uid}/daily`);
            const thirtyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 31);
            const dailyDocs = await dcol
                .where('lastUpdated', '>=', thirtyDaysAgo)
                .get();
            if (dailyDocs.empty)
                continue;
            let total = 0;
            const byEndpoint = {};
            let cost = 0;
            dailyDocs.forEach(d => {
                const data = d.data();
                total += data.total || 0;
                cost += data.cost || 0;
                // Aggregate endpoint counters
                Object.keys(data).forEach(k => {
                    if (k.includes('_/v1') ||
                        k.includes('/api/') ||
                        k.startsWith('GET_') ||
                        k.startsWith('POST_')) {
                        byEndpoint[k] = (byEndpoint[k] || 0) + (data[k] || 0);
                    }
                });
            });
            // Update monthly doc
            await db.doc(`usage_logs/${uid}/monthly/${mk}`).set({
                total,
                byEndpoint,
                cost,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            processed++;
        }
        catch (error) {
            console.error(`❌ Error processing user ${uid}:`, error);
        }
    }
    console.log(`✅ Rollup complete: processed ${processed} users`);
});
//# sourceMappingURL=aggregateMonthly.js.map