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
Object.defineProperty(exports, "__esModule", { value: true });
exports.quotaWarning = void 0;
// functions/src/quotaWarn.ts
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
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
exports.quotaWarning = (0, scheduler_1.onSchedule)("every 6 hours", async () => {
    var _a, e_1, _b, _c;
    var _d, _e;
    const mk = new Date().toISOString().slice(0, 7);
    try {
        for (var _f = true, _g = __asyncValues(iterateUsers(500)), _h; _h = await _g.next(), _a = _h.done, !_a; _f = true) {
            _c = _h.value;
            _f = false;
            const u = _c;
            const uid = u.id;
            try {
                const sub = await db.doc(`users/${uid}/subscription`).get();
                const quota = (_d = sub.get("limits.monthlyQuota")) !== null && _d !== void 0 ? _d : 10000;
                const used = (_e = (await db.doc(`usage_logs/${uid}/monthly/${mk}`).get()).get("total")) !== null && _e !== void 0 ? _e : 0;
                if (quota > 0 && used >= quota * 0.8) {
                    await db.collection("billing_events").add({
                        uid,
                        type: "quota_warn",
                        meta: { used, quota, percentage: (used / quota) * 100 },
                        createdAt: new Date(),
                    });
                }
            }
            catch (err) {
                console.error("[quotaWarning] user:", uid, "error:", err);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_f && !_a && (_b = _g.return)) await _b.call(_g);
        }
        finally { if (e_1) throw e_1.error; }
    }
});
//# sourceMappingURL=quotaWarn.js.map