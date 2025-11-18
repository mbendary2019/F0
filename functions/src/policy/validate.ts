import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Policy } from "./types";
import { applyPolicies } from "./evaluate";

export const policyValidate = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated","Auth required");
  const t = (request.auth.token || {}) as any;
  if (!t.admin) throw new HttpsError("permission-denied","Admin only");

  const policy = request.data?.policy as Policy;
  const ctx = request.data?.ctx as any;
  if (!policy || !ctx) throw new HttpsError("invalid-argument","policy and ctx required");

  // Minimal schema checks
  if (typeof policy.name !== "string") throw new HttpsError("invalid-argument","policy.name required");
  if (typeof policy.priority !== "number") throw new HttpsError("invalid-argument","policy.priority number required");

  const draft = {
    uid: ctx.uid || "u",
    model: ctx.model || "gpt-test",
    createdAt: Date.now(),
    status: "queued" as const,
    severity: "low" as const,
    labels: ctx.labels || [],
    assignedTo: null as string | null,
    slaDueAt: Date.now() + 48*60*60*1000,
    ctx: {
      toxicity: Number(ctx.toxicity || 0),
      bias: Number(ctx.bias || 0),
      piiLeak: !!ctx.piiLeak,
      model: ctx.model || "gpt-test",
      labels: ctx.labels || [],
      uid: ctx.uid || "u"
    }
  };

  const { draft: res, applied } = applyPolicies([policy], draft);
  return { applied, result: {
    severity: res.severity,
    labels: res.labels,
    assignedTo: res.assignedTo,
    slaDueAt: res.slaDueAt,
    requireTwoPersonReview: !!res.requireTwoPersonReview
  }};
});
