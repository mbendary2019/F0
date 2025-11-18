/**
 * Admin Authentication Helper
 * Verifies admin claims from request headers
 */

import { auth } from './firebase-admin';

/**
 * Verify admin authentication from request headers
 * Throws error if not authenticated or not admin
 */
export async function requireAdminFromHeaders(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: No token provided');
  }

  const token = authHeader.substring(7);

  try {
    const decodedToken = await auth.verifyIdToken(token);

    if (!decodedToken.admin) {
      throw new Error('Forbidden: Admin access required');
    }

    return decodedToken.uid;
  } catch (error: any) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}
