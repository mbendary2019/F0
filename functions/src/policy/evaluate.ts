import { Policy, Severity } from "./types";

export interface ReviewDraft {
  uid: string;
  model: string;
  createdAt: number;
  status: "queued" | "assigned" | "resolved";
  severity: Severity;
  labels: string[];
  assignedTo: string | null;
  slaDueAt: number;
  // source context
  ctx: {
    toxicity: number;
    bias: number;
    piiLeak: boolean;
    model: string;
    labels: string[];
    uid: string;
  };
  // policy flags
  requireTwoPersonReview?: boolean;
}

function matches(policy: Policy, ctx: ReviewDraft["ctx"]) {
  const c = policy.conditions || {};
  if (typeof c.piiLeak === "boolean" && c.piiLeak !== ctx.piiLeak) return false;
  if (typeof c.minToxicity === "number" && !(ctx.toxicity >= c.minToxicity)) return false;
  if (typeof c.minBias === "number" && !(ctx.bias >= c.minBias)) return false;
  if (c.labelsAny?.length && !c.labelsAny.some(l => ctx.labels.includes(l))) return false;
  if (c.uidIn?.length && !c.uidIn.includes(ctx.uid)) return false;
  if (c.modelRegex) {
    try {
      const re = new RegExp(c.modelRegex);
      if (!re.test(ctx.model)) return false;
    } catch { return false; }
  }
  return true;
}

export function applyPolicies(policies: Policy[], draft: ReviewDraft) {
  const applied: string[] = [];
  const ordered = [...policies].filter(p => p.enabled).sort((a,b) => (a.priority ?? 0) - (b.priority ?? 0));
  for (const p of ordered) {
    if (!matches(p, draft.ctx)) continue;
    const a = p.actions || {};
    if (a.escalateSeverity) draft.severity = a.escalateSeverity;
    if (a.addLabels?.length) {
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
