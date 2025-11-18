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
exports.debugStatus = exports.debugClosePeriod = exports.debugQuotaWarn = exports.debugPushUsage = exports.debugRollup = void 0;
// functions/src/debugSchedulers.ts
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const stripe_1 = __importDefault(require("stripe"));
const config_1 = require("./config");
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
function assertAdmin(req) {
    var _a, _b, _c, _d;
    // ❶ حماية مبدئية: Admin Token من بيئة Next يمرر داخل Authorization: Bearer <token>
    const tok = (((_b = (_a = req.rawRequest) === null || _a === void 0 ? void 0 : _a.headers) === null || _b === void 0 ? void 0 : _b.authorization) || "").replace(/^Bearer\s+/i, "");
    const dataBearer = (_c = req.data) === null || _c === void 0 ? void 0 : _c._adminBearer;
    const tokFinal = tok || dataBearer || "";
    const allowed = process.env.ADMIN_DASH_TOKEN || ((_d = process.env.admin) === null || _d === void 0 ? void 0 : _d.dash_token);
    if (!allowed || tokFinal !== allowed)
        throw new https_1.HttpsError("permission-denied", "Not authorized");
}
function monthKey(d = new Date()) { return d.toISOString().slice(0, 7); }
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
// ===== ROLLUP: daily -> monthly =====
exports.debugRollup = (0, https_1.onCall)(async (req) => {
    var _a, e_1, _b, _c;
    assertAdmin(req);
    const since = Date.now();
    const counters = { users: 0, total: 0, cost: 0 };
    const mk = monthKey();
    try {
        for (var _d = true, _e = __asyncValues(iterateUsers()), _f; _f = await _e.next(), _a = _f.done, !_a; _d = true) {
            _c = _f.value;
            _d = false;
            const u = _c;
            counters.users++;
            const uid = u.id;
            const dcol = db.collection(`usage_logs/${uid}/daily`);
            const q = await dcol.where("lastUpdated", ">=", new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)).get();
            let total = 0;
            let cost = 0;
            const byEndpoint = {};
            q.forEach(d => {
                const data = d.data();
                total += data.total || 0;
                cost += data.cost || 0;
                Object.keys(data).forEach(k => {
                    if (k.includes("_/v1") || k.startsWith("GET_") || k.startsWith("POST_")) {
                        byEndpoint[k] = (byEndpoint[k] || 0) + (data[k] || 0);
                    }
                });
            });
            counters.total += total;
            counters.cost += cost;
            await db.doc(`usage_logs/${uid}/monthly/${mk}`).set({
                total, byEndpoint, cost, lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_d && !_a && (_b = _e.return)) await _b.call(_e);
        }
        finally { if (e_1) throw e_1.error; }
    }
    await db.doc("admin/scheduler_status").set({
        rollup: { ok: true, at: admin.firestore.FieldValue.serverTimestamp(), tookMs: Date.now() - since, counters }
    }, { merge: true });
    return { ok: true, counters };
});
// ===== PUSH USAGE: Stripe usage records =====
exports.debugPushUsage = (0, https_1.onCall)(async (req) => {
    var _a, e_2, _b, _c;
    var _d, _e, _f, _g;
    assertAdmin(req);
    const since = Date.now();
    const cfg = (0, config_1.getConfig)();
    const stripe = new stripe_1.default(cfg.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
    const mk = monthKey();
    let pushed = 0;
    try {
        for (var _h = true, _j = __asyncValues(iterateUsers()), _k; _k = await _j.next(), _a = _k.done, !_a; _h = true) {
            _c = _k.value;
            _h = false;
            const u = _c;
            const uid = u.id;
            const subSnap = await db.doc(`users/${uid}/subscription`).get();
            const ent = subSnap.data();
            if (!ent || ent.status !== "active" || !((_e = (_d = ent.limits) === null || _d === void 0 ? void 0 : _d.overage) === null || _e === void 0 ? void 0 : _e.enabled))
                continue;
            const mdoc = await db.doc(`usage_logs/${uid}/monthly/${mk}`).get();
            const total = mdoc.get("total") || 0;
            const reported = ((_f = mdoc.get("stripeReported")) === null || _f === void 0 ? void 0 : _f.totalUnits) || 0;
            const delta = total - reported;
            if (delta <= 0)
                continue;
            const subItemId = (_g = ent === null || ent === void 0 ? void 0 : ent.stripe) === null || _g === void 0 ? void 0 : _g.overagePriceItemId;
            if (!subItemId)
                continue;
            await stripe.subscriptionItems.createUsageRecord(subItemId, {
                quantity: delta, timestamp: Math.floor(Date.now() / 1000), action: "increment"
            });
            await db.doc(`usage_logs/${uid}/monthly/${mk}`).set({
                stripeReported: { totalUnits: total, at: admin.firestore.FieldValue.serverTimestamp() }
            }, { merge: true });
            pushed += delta;
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (!_h && !_a && (_b = _j.return)) await _b.call(_j);
        }
        finally { if (e_2) throw e_2.error; }
    }
    await db.doc("admin/scheduler_status").set({
        pushUsage: { ok: true, at: admin.firestore.FieldValue.serverTimestamp(), tookMs: Date.now() - since, pushed }
    }, { merge: true });
    return { ok: true, pushed };
});
// ===== QUOTA WARN =====
exports.debugQuotaWarn = (0, https_1.onCall)(async (req) => {
    var _a, e_3, _b, _c;
    var _d, _e;
    assertAdmin(req);
    const since = Date.now();
    const mk = monthKey();
    let warned = 0;
    try {
        for (var _f = true, _g = __asyncValues(iterateUsers()), _h; _h = await _g.next(), _a = _h.done, !_a; _f = true) {
            _c = _h.value;
            _f = false;
            const u = _c;
            const uid = u.id;
            const sub = await db.doc(`users/${uid}/subscription`).get();
            const quota = (_d = sub.get("limits.monthlyQuota")) !== null && _d !== void 0 ? _d : 10000;
            const used = (_e = (await db.doc(`usage_logs/${uid}/monthly/${mk}`).get()).get("total")) !== null && _e !== void 0 ? _e : 0;
            if (quota > 0 && used >= quota * 0.8) {
                warned++;
                await db.collection("billing_events").add({
                    uid, type: "quota_warn",
                    meta: { used, quota, percentage: (used / quota) * 100 },
                    createdAt: new Date()
                });
            }
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (!_f && !_a && (_b = _g.return)) await _b.call(_g);
        }
        finally { if (e_3) throw e_3.error; }
    }
    await db.doc("admin/scheduler_status").set({
        quotaWarn: { ok: true, at: admin.firestore.FieldValue.serverTimestamp(), tookMs: Date.now() - since, warned }
    }, { merge: true });
    return { ok: true, warned };
});
// ===== CLOSE PERIOD =====
exports.debugClosePeriod = (0, https_1.onCall)(async (req) => {
    var _a, e_4, _b, _c;
    assertAdmin(req);
    const since = Date.now();
    let closed = 0;
    try {
        for (var _d = true, _e = __asyncValues(iterateUsers()), _f; _f = await _e.next(), _a = _f.done, !_a; _d = true) {
            _c = _f.value;
            _d = false;
            const u = _c;
            const uid = u.id;
            await db.collection("billing_events").add({ uid, type: "period_close", createdAt: new Date() });
            closed++;
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (!_d && !_a && (_b = _e.return)) await _b.call(_e);
        }
        finally { if (e_4) throw e_4.error; }
    }
    await db.doc("admin/scheduler_status").set({
        closePeriod: { ok: true, at: admin.firestore.FieldValue.serverTimestamp(), tookMs: Date.now() - since, closed }
    }, { merge: true });
    return { ok: true, closed };
});
// ===== STATUS =====
exports.debugStatus = (0, https_1.onCall)(async (req) => {
    assertAdmin(req);
    const snap = await db.doc("admin/scheduler_status").get();
    return snap.exists ? snap.data() : {};
});
//# sourceMappingURL=debugSchedulers.js.map