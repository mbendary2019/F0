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
exports.generateMonthlyStatements = exports.generateCreatorStatement = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const PDFDocument = require("pdfkit");
function yyyymm(d) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
async function buildCreatorMonthSummary(db, uid, month) {
    var _a, _b;
    // month: "YYYY-MM"
    const [y, m] = month.split("-").map(Number);
    const start = Date.UTC(y, m - 1, 1);
    const end = Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1);
    const os = await db
        .collection("orders")
        .where("creatorUid", "==", uid)
        .where("status", "==", "paid")
        .where("paidAt", ">=", start)
        .where("paidAt", "<", end)
        .get();
    let orders = 0, gross = 0, platform = 0, net = 0;
    const byProduct = new Map();
    for (const d of os.docs) {
        const o = d.data();
        orders++;
        const g = Number(o.amountUsd || 0), pf = Number(o.platformFeeUsd || 0), n = Number(o.amountToCreatorUsd || g - pf);
        gross += g;
        platform += pf;
        net += n;
        const pid = o.productId || ((_a = o.product) === null || _a === void 0 ? void 0 : _a.id) || "unknown";
        const t = (_b = o.product) === null || _b === void 0 ? void 0 : _b.title;
        const cur = byProduct.get(pid) || { title: t, revenue: 0, count: 0 };
        cur.revenue += g;
        cur.count += 1;
        byProduct.set(pid, cur);
    }
    const top = Array.from(byProduct.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 10)
        .map(([productId, v]) => ({
        productId,
        title: v.title,
        orders: v.count,
        revenueUsd: Math.round(v.revenue * 100) / 100,
    }));
    return {
        month,
        orders,
        grossUsd: Math.round(gross * 100) / 100,
        platformUsd: Math.round(platform * 100) / 100,
        netUsd: Math.round(net * 100) / 100,
        topProducts: top,
    };
}
/**
 * Generate monthly statement PDF for a creator
 * Callable function - can be invoked by creator or admin
 */
exports.generateCreatorStatement = functions.https.onCall(async (payload, ctx) => {
    if (!ctx.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
    }
    const db = admin.firestore();
    const storage = admin.storage().bucket();
    const targetUid = (payload === null || payload === void 0 ? void 0 : payload.uid) || ctx.auth.uid;
    const month = (payload === null || payload === void 0 ? void 0 : payload.month) || yyyymm(new Date());
    const isAdmin = ctx.auth.token.admin === true;
    if (targetUid !== ctx.auth.uid && !isAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Cannot generate for another user");
    }
    const summary = await buildCreatorMonthSummary(db, targetUid, month);
    // Generate PDF
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(Buffer.from(c)));
    const title = `Creator Statement — ${month}`;
    doc.fontSize(18).text(title, { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Creator UID: ${targetUid}`);
    doc.text(`Orders: ${summary.orders}`);
    doc.text(`Gross: $${summary.grossUsd.toFixed(2)} | Platform: $${summary.platformUsd.toFixed(2)} | Net: $${summary.netUsd.toFixed(2)}`);
    doc.moveDown().text("Top Products:");
    summary.topProducts.forEach((p, i) => {
        doc.text(`${i + 1}. ${p.title || p.productId} — $${p.revenueUsd.toFixed(2)} (${p.orders} orders)`);
    });
    doc.end();
    await new Promise((resolve) => doc.on("end", resolve));
    const pdf = Buffer.concat(chunks);
    // Save to Storage
    const path = `creator_statements/${targetUid}/${month}.pdf`;
    const file = storage.file(path);
    await file.save(pdf, { contentType: "application/pdf", resumable: false });
    // Store metadata
    await db
        .collection("creator_statements")
        .doc(targetUid)
        .collection("files")
        .doc(month)
        .set({
        month,
        path,
        size: pdf.length,
        createdAt: Date.now(),
    }, { merge: true });
    // Generate signed URL (7 days)
    const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    return { month, url };
});
/**
 * Scheduled job to generate monthly statements for all creators
 * Runs on 1st of each month at 02:00 UTC
 */
exports.generateMonthlyStatements = functions.pubsub
    .schedule("0 2 1 * *")
    .timeZone("UTC")
    .onRun(async () => {
    const db = admin.firestore();
    // Get all creators who have paid orders
    const creatorsSnap = await db
        .collection("orders")
        .where("status", "==", "paid")
        .limit(10000)
        .get();
    const creatorSet = new Set();
    creatorsSnap.docs.forEach((d) => {
        const o = d.data();
        if (o.creatorUid)
            creatorSet.add(o.creatorUid);
    });
    // Generate for previous month
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const month = yyyymm(prev);
    console.log(`Generating statements for ${creatorSet.size} creators for ${month}`);
    for (const uid of creatorSet) {
        try {
            // Internal call to generator
            const ctx = { auth: { uid, token: { admin: true } } };
            await exports.generateCreatorStatement({ month }, ctx);
            console.log(`✅ Generated statement for ${uid}`);
        }
        catch (err) {
            console.error(`Failed to generate statement for ${uid}:`, err.message);
        }
    }
    return null;
});
//# sourceMappingURL=statements.js.map