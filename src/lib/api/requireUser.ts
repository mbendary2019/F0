/**
 * Phase 84.7: Authentication Helper
 * Verify Firebase ID token and extract user info
 */

import { NextRequest } from 'next/server';
import { adminAuth } from '@/server/firebaseAdmin';

export interface AuthedUser {
  uid: string;
  email?: string;
}

/**
 * Extract and verify Firebase ID token from Authorization header
 * Throws an error if token is missing or invalid
 */
export async function requireUser(req: NextRequest): Promise<AuthedUser> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;

  if (!token) {
    throw new Error('NO_TOKEN');
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
    };
  } catch (err) {
    console.error('verifyIdToken failed:', err);
    throw new Error('INVALID_TOKEN');
  }
}
