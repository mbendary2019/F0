/**
 * Phase 47 - RBAC Helper Utilities
 * Role-based access control helpers for organizations
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface RolePermissions {
  canManageOrg: boolean;
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canUpdateRoles: boolean;
  canUpdateSeats: boolean;
  canDeleteOrg: boolean;
  canRead: boolean;
  canWrite: boolean;
}

/**
 * Get role permissions
 */
export function getRolePermissions(role: OrgRole): RolePermissions {
  switch (role) {
    case 'owner':
      return {
        canManageOrg: true,
        canInviteMembers: true,
        canRemoveMembers: true,
        canUpdateRoles: true,
        canUpdateSeats: true,
        canDeleteOrg: true,
        canRead: true,
        canWrite: true,
      };
    case 'admin':
      return {
        canManageOrg: true,
        canInviteMembers: true,
        canRemoveMembers: true,
        canUpdateRoles: true,
        canUpdateSeats: false,
        canDeleteOrg: false,
        canRead: true,
        canWrite: true,
      };
    case 'member':
      return {
        canManageOrg: false,
        canInviteMembers: false,
        canRemoveMembers: false,
        canUpdateRoles: false,
        canUpdateSeats: false,
        canDeleteOrg: false,
        canRead: true,
        canWrite: true,
      };
    case 'viewer':
      return {
        canManageOrg: false,
        canInviteMembers: false,
        canRemoveMembers: false,
        canUpdateRoles: false,
        canUpdateSeats: false,
        canDeleteOrg: false,
        canRead: true,
        canWrite: false,
      };
    default:
      throw new Error(`Invalid role: ${role}`);
  }
}

/**
 * Get user's role in organization
 */
export async function getUserRole(orgId: string, uid: string): Promise<OrgRole | null> {
  const memberDoc = await db.collection('ops_org_members').doc(`${orgId}_${uid}`).get();
  if (!memberDoc.exists) {
    return null;
  }
  return memberDoc.data()!.role as OrgRole;
}

/**
 * Check if user has permission in organization
 */
export async function hasPermission(
  orgId: string,
  uid: string,
  permission: keyof RolePermissions
): Promise<boolean> {
  const role = await getUserRole(orgId, uid);
  if (!role) return false;

  const permissions = getRolePermissions(role);
  return permissions[permission];
}

/**
 * Check if user is member of organization
 */
export async function isMember(orgId: string, uid: string): Promise<boolean> {
  const memberDoc = await db.collection('ops_org_members').doc(`${orgId}_${uid}`).get();
  return memberDoc.exists;
}

/**
 * Get all organizations for user
 */
export async function getUserOrganizations(uid: string) {
  const memberSnap = await db.collection('ops_org_members')
    .where('uid', '==', uid)
    .get();

  const orgIds = memberSnap.docs.map((doc) => doc.data().orgId);
  if (orgIds.length === 0) return [];

  // Fetch org details
  const orgs = [];
  for (const orgId of orgIds) {
    const orgDoc = await db.collection('ops_orgs').doc(orgId).get();
    if (orgDoc.exists) {
      const memberDoc = memberSnap.docs.find((d) => d.data().orgId === orgId);
      orgs.push({
        ...orgDoc.data(),
        role: memberDoc?.data().role,
      });
    }
  }

  return orgs;
}

/**
 * Get organization members with their roles
 */
export async function getOrgMembers(orgId: string) {
  const memberSnap = await db.collection('ops_org_members')
    .where('orgId', '==', orgId)
    .get();

  return memberSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Validate role hierarchy
 * Returns true if requesterRole can manage targetRole
 */
export function canManageRole(requesterRole: OrgRole, targetRole: OrgRole): boolean {
  if (targetRole === 'owner') return false; // Owner cannot be managed
  if (requesterRole === 'owner') return true; // Owner can manage all
  if (requesterRole === 'admin' && targetRole !== 'admin') return true; // Admin can manage member/viewer
  return false; // Member and viewer cannot manage anyone
}
