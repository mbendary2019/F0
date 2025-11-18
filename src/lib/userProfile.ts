/**
 * User Profile & RBAC Functions
 * Handles user roles, plans, and usage data from Firestore
 */

import { adminDb } from './firebaseAdmin';

// ===== Roles Management =====

export async function getUserRoles(uid: string): Promise<string[]> {
  try {
    const doc = await adminDb.collection('users').doc(uid).get();
    const data = doc.data();
    return data?.roles || [];
  } catch {
    return [];
  }
}

export async function addRole(uid: string, role: string): Promise<void> {
  const ref = adminDb.collection('users').doc(uid);
  const doc = await ref.get();
  const current = doc.data()?.roles || [];
  if (!current.includes(role)) {
    await ref.set({ roles: [...current, role] }, { merge: true });
  }
}

export async function removeRole(uid: string, role: string): Promise<void> {
  const ref = adminDb.collection('users').doc(uid);
  const doc = await ref.get();
  const current = doc.data()?.roles || [];
  await ref.set({ roles: current.filter((r: string) => r !== role) }, { merge: true });
}

export async function isAdmin(uid: string): Promise<boolean> {
  const roles = await getUserRoles(uid);
  return roles.includes('admin');
}

export async function listAdmins(): Promise<Array<{ uid: string; email?: string; roles: string[] }>> {
  try {
    const snapshot = await adminDb
      .collection('users')
      .where('roles', 'array-contains', 'admin')
      .get();
    
    const admins: Array<{ uid: string; email?: string; roles: string[] }> = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      admins.push({
        uid: doc.id,
        email: data.email,
        roles: data.roles || [],
      });
    });
    
    return admins;
  } catch {
    return [];
  }
}

// ===== Plan & Usage (Stubs for now) =====

export async function getPlan(uid: string): Promise<string> {
  try {
    const doc = await adminDb.collection('users').doc(uid).get();
    return doc.data()?.plan || 'free';
  } catch {
    return 'free';
  }
}

export async function getUsage(uid: string): Promise<Record<string, any>> {
  try {
    const doc = await adminDb.collection('usage').doc(uid).get();
    return doc.data() || { calls: 0, tokens: 0 };
  } catch {
    return { calls: 0, tokens: 0 };
  }
}

