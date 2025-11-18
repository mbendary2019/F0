/**
 * Authentication Guard
 * Verifies user authentication via session cookie
 */

import { cookies } from 'next/headers';
import { adminAuth } from './firebaseAdmin';

export async function authGuard() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    const error = new Error('Unauthorized: No session cookie');
    // @ts-ignore
    error.status = 401;
    throw error;
  }

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    return {
      user: {
        uid: decodedClaims.uid,
        email: decodedClaims.email || null,
      },
      claims: decodedClaims,
    };
  } catch (err) {
    const error = new Error('Unauthorized: Invalid session');
    // @ts-ignore
    error.status = 401;
    throw error;
  }
}

