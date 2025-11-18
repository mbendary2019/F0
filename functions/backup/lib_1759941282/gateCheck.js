"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gateCheck = void 0;
const https_1 = require("firebase-functions/v2/https");
const limits_1 = require("./limits"); // عندك بالفعل
exports.gateCheck = (0, https_1.onCall)(async (req) => {
    var _a, _b;
    const uid = ((_a = req.data) === null || _a === void 0 ? void 0 : _a.uid) || ((_b = req.auth) === null || _b === void 0 ? void 0 : _b.uid);
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'UID required');
    const out = await (0, limits_1.enforceGate)(uid);
    return out; // { decision: { allow, reason, hard }, subscription }
});
//# sourceMappingURL=gateCheck.js.map