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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushUsageToStripe = void 0;
// functions/src/overage.ts
const stripe_1 = __importDefault(require("stripe"));
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const config_1 = require("./config");
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
function iterateUsers() {
    return __asyncGenerator(this, arguments, function* iterateUsers_1(batchSize = 500) {
        let last = undefined;
        while (true) {
            let q = db.collection("users").orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize);
            if (last)
                q = q.startAfter(last);
            const snap = yield __await(q.get());
            if (snap.empty)
                break;
            for (const doc of snap.docs)
                yield yield __await(doc);
            if (snap.size < batchSize)
                break;
            last = snap.docs[snap.docs.length - 1];
        }
    });
}
/** Push usage deltas to Stripe once per hour */
exports.pushUsageToStripe = (0, scheduler_1.onSchedule)("every 60 minutes", async () => {
    var _a, e_1, _b, _c;
    var _d, _e, _f, _g;
    const cfg = (0, config_1.getConfig)();
    const stripe = new stripe_1.default(cfg.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
    try {
        for (var _h = true, _j = __asyncValues(iterateUsers()), _k; _k = await _j.next(), _a = _k.done, !_a; _h = true) {
            _c = _k.value;
            _h = false;
            const u = _c;
            const uid = u.id;
            try {
                const subSnap = await db.doc(`users/${uid}/subscription`).get();
                const ent = subSnap.data();
                if (!ent || ent.status !== "active" || !((_e = (_d = ent.limits) === null || _d === void 0 ? void 0 : _d.overage) === null || _e === void 0 ? void 0 : _e.enabled))
                    continue;
                const mk = new Date().toISOString().slice(0, 7); // YYYY-MM
                const mdoc = await db.doc(`usage_logs/${uid}/monthly/${mk}`).get();
                const total = mdoc.get("total") || 0;
                const reported = ((_f = mdoc.get("stripeReported")) === null || _f === void 0 ? void 0 : _f.totalUnits) || 0;
                const delta = total - reported;
                if (delta <= 0)
                    continue;
                const subItemId = (_g = ent.stripe) === null || _g === void 0 ? void 0 : _g.overagePriceItemId;
                if (!subItemId)
                    continue; // لا يوجد عنصر اشتراك متري
                await stripe.subscriptionItems.createUsageRecord(subItemId, {
                    quantity: delta,
                    timestamp: Math.floor(Date.now() / 1000),
                    action: "increment",
                });
                await db.doc(`usage_logs/${uid}/monthly/${mk}`).set({
                    stripeReported: {
                        totalUnits: total,
                        at: admin.firestore.FieldValue.serverTimestamp(),
                    },
                }, { merge: true });
                await db.collection("billing_events").add({
                    uid,
                    type: "overage_record",
                    meta: { delta, total, subItemId },
                    createdAt: new Date(),
                });
            }
            catch (err) {
                // لا توقف بقية المستخدمين
                console.error("[pushUsageToStripe] user:", uid, "error:", (err === null || err === void 0 ? void 0 : err.message) || err);
                await db.collection("billing_events").add({
                    uid,
                    type: "overage_error",
                    meta: { message: String((err === null || err === void 0 ? void 0 : err.message) || err) },
                    createdAt: new Date(),
                });
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_h && !_a && (_b = _j.return)) await _b.call(_j);
        }
        finally { if (e_1) throw e_1.error; }
    }
});
//# sourceMappingURL=overage.js.map