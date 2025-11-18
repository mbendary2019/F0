"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyPolicies = applyPolicies;
function matches(policy, ctx) {
    var _a, _b;
    const c = policy.conditions || {};
    if (typeof c.piiLeak === "boolean" && c.piiLeak !== ctx.piiLeak)
        return false;
    if (typeof c.minToxicity === "number" && !(ctx.toxicity >= c.minToxicity))
        return false;
    if (typeof c.minBias === "number" && !(ctx.bias >= c.minBias))
        return false;
    if (((_a = c.labelsAny) === null || _a === void 0 ? void 0 : _a.length) && !c.labelsAny.some(l => ctx.labels.includes(l)))
        return false;
    if (((_b = c.uidIn) === null || _b === void 0 ? void 0 : _b.length) && !c.uidIn.includes(ctx.uid))
        return false;
    if (c.modelRegex) {
        try {
            const re = new RegExp(c.modelRegex);
            if (!re.test(ctx.model))
                return false;
        }
        catch (_c) {
            return false;
        }
    }
    return true;
}
function applyPolicies(policies, draft) {
    var _a;
    const applied = [];
    const ordered = [...policies].filter(p => p.enabled).sort((a, b) => { var _a, _b; return ((_a = a.priority) !== null && _a !== void 0 ? _a : 0) - ((_b = b.priority) !== null && _b !== void 0 ? _b : 0); });
    for (const p of ordered) {
        if (!matches(p, draft.ctx))
            continue;
        const a = p.actions || {};
        if (a.escalateSeverity)
            draft.severity = a.escalateSeverity;
        if ((_a = a.addLabels) === null || _a === void 0 ? void 0 : _a.length) {
            draft.labels = Array.from(new Set([...draft.labels, ...a.addLabels]));
        }
        if (a.autoAssignTo) {
            draft.assignedTo = a.autoAssignTo;
            draft.status = "assigned";
        }
        if (typeof a.setSlaHours === "number") {
            draft.slaDueAt = draft.createdAt + a.setSlaHours * 60 * 60 * 1000;
        }
        if (a.requireTwoPersonReview) {
            draft.requireTwoPersonReview = true; // stored for future enforcement
        }
        applied.push(p.name || "unnamed_policy");
    }
    return { draft, applied };
}
//# sourceMappingURL=evaluate.js.map