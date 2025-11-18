/**
 * Admin Request Guard
 * Ensures the request is from an authenticated admin user
 */

import { authGuard } from '@/lib/authGuard';
import { isAdmin } from '@/lib/userProfile';

export async function assertAdminReq() {
  const { user } = await authGuard(); // 401 if not authenticated
  const admin = await isAdmin(user.uid);
  
  if (!admin) {
    const err = new Error('Forbidden: admin only');
    // @ts-ignore
    err.status = 403;
    throw err;
  }
  
  return { uid: user.uid };
}

