import { onCall, HttpsError } from "firebase-functions/v2/https";

/**
 * v2 callable: handler(request)
 * - request.data => payload sent by client
 * - request.auth => auth context
 */
export const logAiEval = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Authentication required to log AI evaluations"
    );
  }

  const payload = (request.data as any) || {};
  // TODO: persist evaluation log (stub for build)
  return { ok: true, received: !!payload };
});
