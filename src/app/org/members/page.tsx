/**
 * Phase 47 - Organization Members Page
 * Manage team members, roles, and invitations
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OrgSwitcher } from '@/components/org/OrgSwitcher';
import { MembersTable } from '@/components/org/MembersTable';
import { InviteDialog } from '@/components/org/InviteDialog';
import { useOrg } from '@/hooks/useOrg';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function OrgMembers() {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { orgId, org, canAdmin, currentRole } = useOrg(uid || undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!uid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900">Please sign in</h1>
          <p className="text-gray-500">You need to be signed in to manage members</p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 rounded-2xl bg-black text-white font-medium hover:bg-gray-800 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Team Members</h1>
            {org && <p className="text-sm text-gray-500 mt-1">{org.name}</p>}
          </div>
          <OrgSwitcher uid={uid} />
        </div>

        {/* Content */}
        {!orgId ? (
          <div className="p-8 rounded-2xl bg-white shadow text-center">
            <div className="text-gray-500">
              Select an organization to view members
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white shadow">
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-900">
                  Manage roles and invitations
                </div>
                <div className="text-xs text-gray-500">
                  Your role: <span className="font-medium">{currentRole}</span>
                </div>
              </div>
              {canAdmin && <InviteDialog orgId={orgId} />}
            </div>

            {/* Members Table */}
            <MembersTable orgId={orgId} canAdmin={canAdmin} />

            {/* Permission Info */}
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
              <div className="text-sm font-medium text-blue-900 mb-2">
                👥 Role Permissions
              </div>
              <div className="text-xs text-blue-800 space-y-1">
                <div>
                  <strong>Owner:</strong> Full control including deleting the organization
                </div>
                <div>
                  <strong>Admin:</strong> Can invite, remove members, and change roles
                  (except other admins)
                </div>
                <div>
                  <strong>Member:</strong> Can read and write, but cannot manage team
                </div>
                <div>
                  <strong>Viewer:</strong> Read-only access to the organization
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/org')}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-white hover:shadow transition-all"
              >
                ← Back to Overview
              </button>
              <button
                onClick={() => router.push('/org/billing')}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-white hover:shadow transition-all"
              >
                View Billing →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
