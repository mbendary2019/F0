/**
 * Auth Adapter - Read-only authentication and RBAC
 * Reads from Firebase Auth + Firestore users collection
 */

import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

export type UserRole = "admin" | "member" | "viewer";

export interface SessionInfo {
  uid: string;
  email: string | null;
  roles: UserRole[];
  displayName: string | null;
  photoURL: string | null;
}

/**
 * Get current user session info including roles
 * @returns SessionInfo or null if not authenticated
 */
export async function getSessionInfo(): Promise<SessionInfo | null> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) return null;

  // Try to get roles from custom claims first
  let roles: UserRole[] = [];
  try {
    const token = await user.getIdTokenResult();
    roles = (token?.claims?.roles as UserRole[]) || [];
  } catch (error) {
    console.error("Error getting custom claims:", error);
  }

  // Fallback: get roles from Firestore users collection
  if (!roles.length) {
    try {
      const db = getFirestore();
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        roles = (userData.roles as UserRole[]) || [];
      }
    } catch (error) {
      console.error("Error getting user roles from Firestore:", error);
    }
  }

  return {
    uid: user.uid,
    email: user.email,
    roles,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
  };
}

/**
 * Check if user has specific role
 */
export function hasRole(roles: UserRole[] | undefined, role: UserRole): boolean {
  return Array.isArray(roles) && roles.includes(role);
}

/**
 * Check if user is admin
 */
export function isAdmin(roles: UserRole[] | undefined): boolean {
  return hasRole(roles, "admin");
}

/**
 * Check if user can see ops pages
 */
export function canSeeOps(roles: UserRole[] | undefined): boolean {
  return isAdmin(roles);
}
