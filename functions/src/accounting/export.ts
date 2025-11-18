import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { getStorage } from "firebase-admin/storage";

/**
 * v2 callable: handler(request)
 * request.data => payload
 * request.auth  => auth context
 */
const requireAdmin = (req: CallableRequest) => {
  if (!req.auth?.token?.admin) {
    throw new HttpsError("permission-denied", "Admin only");
  }
};

export const accountingMonthlyExport = onCall(async (request) => {
  requireAdmin(request);
  const { month } = (request.data as { month?: string }) || {};
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new HttpsError("invalid-argument", "Invalid month format (expected YYYY-MM)");
  }

  // TODO: real export implementation
  const bucket = getStorage().bucket();
  const filePath = `exports/accounting/${month}.csv`;
  await bucket.file(filePath).save("accounting,data\n"); // stub content

  return { ok: true, filePath };
});
