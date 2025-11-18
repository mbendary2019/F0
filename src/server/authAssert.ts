import { adminAuth } from "@/server/firebaseAdmin";

/**
 * Custom Claims Interface
 */
export interface CustomClaims {
  sub_active?: boolean;
  sub_tier?: string;
  sub_exp?: number | null;
  [key: string]: any;
}

/**
 * Requirements for Authorization
 */
export interface RequireClaims {
  requireActive?: boolean; // Require active subscription
  tiers?: string[]; // Allowed subscription tiers
}

/**
 * Success Response
 */
export interface AuthSuccess {
  ok: true;
  uid: string;
  claims: CustomClaims;
  status?: number;
  error?: string;
}

/**
 * Error Response
 */
export interface AuthError {
  ok: false;
  status: number;
  error: string;
}

/**
 * Auth Assertion Helper
 *
 * Verifies Firebase ID token and checks custom claims for subscription requirements.
 *
 * @param request - Next.js Request object or Headers
 * @param require - Optional requirements for subscription tier/status
 * @returns Auth result with user ID and claims or error
 *
 * @example
 * ```ts
 * const auth = await assertAuth(request, { requireActive: true, tiers: ['pro'] });
 * if (!auth.ok) {
 *   return NextResponse.json({ error: auth.error }, { status: auth.status });
 * }
 * // Use auth.uid and auth.claims
 * ```
 */
export async function assertAuth(
  request: Request | { headers: Headers },
  require?: RequireClaims
): Promise<AuthSuccess | AuthError> {
  // Extract headers
  const headers = request.headers;

  // Get Authorization header
  const authz = headers.get("authorization") || headers.get("Authorization");

  if (!authz) {
    return {
      ok: false,
      status: 401,
      error: "Missing authorization header",
    };
  }

  // Extract token
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;

  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Invalid authorization format. Use: Bearer <token>",
    };
  }

  // Verify token
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const claims = decoded as CustomClaims;

    // Check if subscription is active (if required)
    if (require?.requireActive && !claims.sub_active) {
      return {
        ok: false,
        status: 402, // Payment Required
        error: "Active subscription required",
      };
    }

    // Check if subscription tier is allowed (if required)
    if (require?.tiers && require.tiers.length > 0) {
      const userTier = (claims.sub_tier || "free").toLowerCase();

      if (!require.tiers.map((t) => t.toLowerCase()).includes(userTier)) {
        return {
          ok: false,
          status: 403, // Forbidden
          error: `Subscription tier '${userTier}' not allowed. Required: ${require.tiers.join(", ")}`,
        };
      }
    }

    // Check if subscription has expired
    if (claims.sub_exp && typeof claims.sub_exp === "number") {
      const now = Math.floor(Date.now() / 1000);
      if (claims.sub_exp < now) {
        return {
          ok: false,
          status: 402, // Payment Required
          error: "Subscription has expired",
        };
      }
    }

    // Success
    return {
      ok: true,
      uid: decoded.uid,
      claims,
    };
  } catch (error: any) {
    console.error("Auth verification error:", error.message);

    // Handle specific Firebase Auth errors
    if (error.code === "auth/id-token-expired") {
      return {
        ok: false,
        status: 401,
        error: "Token has expired",
      };
    }

    if (error.code === "auth/argument-error") {
      return {
        ok: false,
        status: 401,
        error: "Invalid token format",
      };
    }

    return {
      ok: false,
      status: 401,
      error: "Invalid or expired token",
    };
  }
}

/**
 * Extract User ID from Request (without full verification)
 *
 * This is a lightweight helper for cases where you just need the UID
 * without full claims verification. Still verifies token signature.
 *
 * @param request - Next.js Request object or Headers
 * @returns User ID or null
 */
export async function extractUid(
  request: Request | { headers: Headers }
): Promise<string | null> {
  const auth = await assertAuth(request);
  return auth.ok ? auth.uid : null;
}
