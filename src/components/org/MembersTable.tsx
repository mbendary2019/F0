/**
 * Phase 47 - Members Table & Role Select
 * Display and manage organization members
 */

'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { updateRole, removeMember } from '@/lib/org';
import { toast } from 'sonner';

interface Member {
  id: string;
  orgId: string;
  uid: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: any;
}

interface MembersTableProps {
  orgId: string;
  canAdmin: boolean;
}

export function MembersTable({ orgId, canAdmin }: MembersTableProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'ops_org_members'),
      where('orgId', '==', orgId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Member[];

      setMembers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orgId]);

  const handleRemove = async (uid: string) => {
    if (!confirm('Remove this member from the organization?')) return;

    try {
      await removeMember({ orgId, memberUid: uid });
      toast.success('Member removed successfully');
    } catch (error: any) {
      console.error('Remove member error:', error);
      toast.error(error.message || 'Failed to remove member');
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white shadow p-8 text-center text-gray-500">
        Loading members...
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="rounded-2xl bg-white shadow p-8 text-center text-gray-500">
        No members found
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white shadow divide-y">
      {members.map((member) => (
        <div key={member.id} className="p-4 flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900">{member.uid}</div>
            <div className="text-xs text-gray-500">
              Joined {new Date(member.joinedAt?.toMillis?.() || Date.now()).toLocaleDateString()}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {member.role}
            </span>
            {canAdmin && member.role !== 'owner' && (
              <>
                <RoleSelect orgId={orgId} uid={member.uid} currentRole={member.role} />
                <button
                  onClick={() => handleRemove(member.uid)}
                  className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface RoleSelectProps {
  orgId: string;
  uid: string;
  currentRole: 'admin' | 'member' | 'viewer';
}

export function RoleSelect({ orgId, uid, currentRole }: RoleSelectProps) {
  const [role, setRole] = useState(currentRole);
  const [updating, setUpdating] = useState(false);

  const handleChange = async (newRole: 'admin' | 'member' | 'viewer') => {
    if (newRole === role) return;

    setUpdating(true);
    try {
      await updateRole({ orgId, memberUid: uid, newRole });
      setRole(newRole);
      toast.success('Role updated successfully');
    } catch (error: any) {
      console.error('Update role error:', error);
      toast.error(error.message || 'Failed to update role');
      setRole(currentRole); // Revert on error
    } finally {
      setUpdating(false);
    }
  };

  return (
    <select
      className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed"
      value={role}
      onChange={(e) => handleChange(e.target.value as typeof role)}
      disabled={updating}
    >
      <option value="admin">Admin</option>
      <option value="member">Member</option>
      <option value="viewer">Viewer</option>
    </select>
  );
}
