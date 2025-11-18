import crypto from "crypto";

/**
 * Cryptographic Utilities for Workspace Invites
 *
 * Provides secure token generation and hashing for workspace invitations.
 */

/**
 * Create a secure random invite token
 *
 * Generates a URL-safe base64 token (24 bytes = 192 bits of entropy)
 *
 * @returns Base64URL-encoded random token
 */
export function createInviteToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Hash a token using SHA-256
 *
 * We store only the hash in Firestore, never the raw token.
 * This prevents token leakage if database is compromised.
 *
 * @param token - Raw token string
 * @returns Hex-encoded SHA-256 hash
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a secure random ID
 *
 * @param bytes - Number of random bytes (default: 16)
 * @returns Hex-encoded random ID
 */
export function generateSecureId(bytes: number = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Verify a token against its hash
 *
 * @param token - Token to verify
 * @param hash - Expected hash
 * @returns True if token matches hash
 */
export function verifyToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token);
  return crypto.timingSafeEqual(
    Buffer.from(tokenHash),
    Buffer.from(hash)
  );
}
