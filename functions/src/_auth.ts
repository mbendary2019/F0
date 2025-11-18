import { HttpsError } from "firebase-functions/v2/https";

/**
 * Assert that the request is from an authenticated admin user.
 * Checks Firebase Auth custom claims for admin role.
 *
 * @param req - The callable function request object
 * @throws HttpsError if user is not authenticated or not an admin
 */
export function assertAdminReq(req: any) {
  // Firebase Callable v2 fills req.auth when Authorization: Bearer <ID_TOKEN> is present
  const auth = req.auth;
  if (!auth || !auth.token) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const t: any = auth.token;
  const isAdmin = t.role === "admin" || (Array.isArray(t.roles) && t.roles.includes("admin"));

  if (!isAdmin) {
    throw new HttpsError("permission-denied", "ADMIN_ONLY");
  }
}

/**
 * Check if user has admin role (non-throwing version)
 *
 * @param req - The callable function request object
 * @returns boolean - true if user is admin, false otherwise
 */
export function isAdmin(req: any): boolean {
  const auth = req.auth;
  if (!auth || !auth.token) return false;

  const t: any = auth.token;
  return t.role === "admin" || (Array.isArray(t.roles) && t.roles.includes("admin"));
}
