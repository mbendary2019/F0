/**
 * Phase 47 - Organization Client SDK
 * Client-side functions for interacting with org Cloud Functions
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export async function createOrg({ name, seats = 5 }: { name: string; seats?: number }) {
  const fn = httpsCallable(functions, 'createOrg');
  const res: any = await fn({ name, seats });
  return res.data as { success: boolean; orgId: string; name: string; seats: number };
}

export async function updateOrg(payload: { orgId: string; name: string }) {
  const fn = httpsCallable(functions, 'updateOrg');
  const res: any = await fn(payload);
  return res.data as { success: boolean; orgId: string };
}

export async function deleteOrg(payload: { orgId: string }) {
  const fn = httpsCallable(functions, 'deleteOrg');
  const res: any = await fn(payload);
  return res.data as { success: boolean; orgId: string };
}

export async function inviteMember(payload: {
  orgId: string;
  email: string;
  role: 'admin' | 'member' | 'viewer'
}) {
  const fn = httpsCallable(functions, 'inviteMember');
  const res: any = await fn(payload);
  return res.data as { success: boolean; inviteId: string; expiresAt: number };
}

export async function acceptInvite(payload: { inviteId: string }) {
  const fn = httpsCallable(functions, 'acceptInvite');
  const res: any = await fn(payload);
  return res.data as { success: boolean; orgId: string; role: string };
}

export async function removeMember(payload: { orgId: string; memberUid: string }) {
  const fn = httpsCallable(functions, 'removeMember');
  const res: any = await fn(payload);
  return res.data as { success: boolean; orgId: string; memberUid: string };
}

export async function updateRole(payload: {
  orgId: string;
  memberUid: string;
  newRole: 'admin' | 'member' | 'viewer'
}) {
  const fn = httpsCallable(functions, 'updateRole');
  const res: any = await fn(payload);
  return res.data as { success: boolean; orgId: string; memberUid: string; newRole: string };
}

export async function updateSeats(payload: { orgId: string; newSeats: number }) {
  const fn = httpsCallable(functions, 'updateSeats');
  const res: any = await fn(payload);
  return res.data as { success: boolean; orgId: string; seats: number; usedSeats: number };
}
