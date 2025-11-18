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
exports.marketplaceWebhook = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const express = __importStar(require("express"));
const stripe = new stripe_1.default(functions.config().stripe.secret_key, { apiVersion: "2024-06-20" });
const app = express();
app.use(express.raw({ type: "application/json" })); // raw body
app.post("/", async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const sig = req.headers["stripe-signature"];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, functions.config().stripe.webhook_secret);
    }
    catch (err) {
        console.error("Webhook signature verification failed", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    const db = admin.firestore();
    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object;
            const meta = session.metadata || {};
            const { orderId, uid, productId, creatorAcct, platformFee } = meta;
            if (!orderId)
                break;
            const orderRef = db.collection("orders").doc(orderId);
            const orderSnap = await orderRef.get();
            if (!orderSnap.exists)
                break;
            // Idempotency: if already paid, skip
            if (orderSnap.data().status === "paid") {
                return res.json({ received: true });
            }
            // Early assertion: payment intent must exist
            if (!session.payment_intent) {
                console.error("[webhook] Missing payment_intent in checkout.session.completed", {
                    sessionId: session.id,
                    orderId
                });
                return res.status(400).send("Missing payment_intent from Stripe payload");
            }
            const amountTotal = typeof session.amount_total === "number" ? session.amount_total : 0;
            const platformFeeUsd = platformFee ? Number(platformFee) / 100 : 0;
            const toCreatorUsd = (amountTotal / 100) - platformFeeUsd;
            await orderRef.set({
                status: "paid",
                paidAt: Date.now(),
                paymentIntentId: session.payment_intent,
                destinationAccount: creatorAcct || null,
                platformFeeUsd,
                amountToCreatorUsd: toCreatorUsd
            }, { merge: true });
            // Grant license
            await db.collection("licenses").add({
                uid,
                productId,
                orderId,
                grantedAt: Date.now(),
                downloadCount: 0,
                lastDownloadAt: null
            });
            await db.collection("audit_logs").add({
                ts: Date.now(),
                kind: "payment_completed",
                actor: "system",
                meta: { orderId, uid, productId, creatorAcct: creatorAcct || null, platformFeeUsd, toCreatorUsd }
            });
            break;
        }
        case "account.updated": {
            const acct = event.data.object;
            const uid = ((_a = acct.metadata) === null || _a === void 0 ? void 0 : _a.uid) || null;
            if (!uid)
                break;
            await db.collection("creators").doc(uid).set({
                stripeAccountId: acct.id,
                chargesEnabled: !!acct.charges_enabled,
                payoutsEnabled: !!acct.payouts_enabled,
                updatedAt: Date.now()
            }, { merge: true });
            await db.collection("audit_logs").add({
                ts: Date.now(),
                kind: "creator_account_updated",
                actor: "system",
                meta: { uid, acct: acct.id, chargesEnabled: acct.charges_enabled, payoutsEnabled: acct.payouts_enabled }
            });
            break;
        }
        case "charge.refunded": {
            const charge = event.data.object;
            const pi = charge.payment_intent;
            // Find order by paymentIntentId
            const os = await db.collection("orders").where("paymentIntentId", "==", pi).limit(1).get();
            if (!os.empty) {
                const orderDoc = os.docs[0];
                const orderData = orderDoc.data();
                // Mark order as refunded
                await orderDoc.ref.set({
                    status: "refunded",
                    refundedAt: Date.now(),
                    refund: {
                        id: ((_d = (_c = (_b = charge.refunds) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.id) || null,
                        status: "succeeded"
                    }
                }, { merge: true });
                // Revoke associated license
                if (orderData.licenseId) {
                    await db.collection("licenses").doc(orderData.licenseId).set({
                        revoked: true,
                        revokedAt: Date.now(),
                        revokeReason: "refund"
                    }, { merge: true });
                }
                else {
                    // Best-effort: find license by orderId
                    const licSnap = await db.collection("licenses").where("orderId", "==", orderDoc.id).limit(1).get();
                    if (!licSnap.empty) {
                        await licSnap.docs[0].ref.set({
                            revoked: true,
                            revokedAt: Date.now(),
                            revokeReason: "refund"
                        }, { merge: true });
                    }
                }
                await db.collection("audit_logs").add({
                    ts: Date.now(),
                    kind: "charge_refunded",
                    actor: "system",
                    meta: { orderId: orderDoc.id, pi, chargeId: charge.id }
                });
                // Slack alert for large refunds (optional)
                const hook = (_e = functions.config().alerts) === null || _e === void 0 ? void 0 : _e.slack_webhook;
                if (hook && orderData.amountUsd && orderData.amountUsd >= 100) {
                    try {
                        await fetch(hook, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                text: `💸 *Large Refund*\nOrder: ${orderDoc.id}\nAmount: $${orderData.amountUsd}\nPI: ${pi}`
                            })
                        });
                    }
                    catch (err) {
                        console.error("Failed to send Slack alert:", err);
                    }
                }
            }
            break;
        }
        case "charge.dispute.created": {
            const dispute = event.data.object;
            const pi = dispute.payment_intent;
            const charge = dispute.charge;
            // Link order if found
            let orderRef = null;
            const os = await db.collection("orders").where("paymentIntentId", "==", pi).limit(1).get();
            if (!os.empty)
                orderRef = os.docs[0].ref;
            const doc = {
                id: dispute.id,
                paymentIntentId: pi || null,
                chargeId: charge || null,
                status: dispute.status,
                amountUsd: (dispute.amount || 0) / 100,
                reason: dispute.reason || null,
                evidenceDueBy: ((_f = dispute.evidence_details) === null || _f === void 0 ? void 0 : _f.due_by)
                    ? dispute.evidence_details.due_by * 1000
                    : null,
                createdAt: Date.now(),
                orderId: (orderRef === null || orderRef === void 0 ? void 0 : orderRef.id) || null,
            };
            await db.collection("disputes").doc(dispute.id).set(doc, { merge: true });
            // Slack alert (optional)
            const hook = (_g = functions.config().alerts) === null || _g === void 0 ? void 0 : _g.slack_webhook;
            if (hook) {
                try {
                    await fetch(hook, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            text: `⚠️ *Dispute Created*\nPI: ${pi}\nAmount: $${doc.amountUsd}\nStatus: ${doc.status}\n${doc.orderId ? "Order: " + doc.orderId : ""}`
                        })
                    });
                }
                catch (err) {
                    console.error("Failed to send Slack alert:", err);
                }
            }
            await db.collection("audit_logs").add({
                ts: Date.now(),
                kind: "dispute_created",
                actor: "system",
                meta: { disputeId: dispute.id, pi, orderId: (orderRef === null || orderRef === void 0 ? void 0 : orderRef.id) || null }
            });
            break;
        }
        case "charge.dispute.closed": {
            const dispute = event.data.object;
            await db.collection("disputes").doc(dispute.id).set({
                status: dispute.status,
                closedAt: Date.now(),
                outcome: ((_h = dispute.outcome) === null || _h === void 0 ? void 0 : _h.type) || null,
            }, { merge: true });
            await db.collection("audit_logs").add({
                ts: Date.now(),
                kind: "dispute_closed",
                actor: "system",
                meta: { disputeId: dispute.id, status: dispute.status, outcome: ((_j = dispute.outcome) === null || _j === void 0 ? void 0 : _j.type) || null }
            });
            break;
        }
        default:
            break;
    }
    return res.json({ received: true });
});
exports.marketplaceWebhook = functions.https.onRequest(app);
//# sourceMappingURL=webhook.js.map