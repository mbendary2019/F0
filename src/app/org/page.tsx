/**
 * Phase 47 - Organization Home Page
 * Main organization overview and settings
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OrgSwitcher } from '@/components/org/OrgSwitcher';
import { SeatsCard } from '@/components/org/SeatsCard';
import { useOrg } from '@/hooks/useOrg';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function OrgHome() {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { orgId, org, canAdmin, memberships } = useOrg(uid || undefined);

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
          <p className="text-gray-500">You need to be signed in to view organizations</p>
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
            <h1 className="text-2xl font-semibold text-gray-900">Organization</h1>
            {org && <p className="text-sm text-gray-500 mt-1">{org.name}</p>}
          </div>
          <OrgSwitcher uid={uid} />
        </div>

        {/* Content */}
        {memberships.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white shadow text-center space-y-4">
            <div className="text-gray-500">
              You don't belong to any organizations yet.
            </div>
            <button
              onClick={() => router.push('/org/create')}
              className="px-6 py-3 rounded-2xl bg-black text-white font-medium hover:bg-gray-800 transition-colors"
            >
              Create Organization
            </button>
          </div>
        ) : !orgId ? (
          <div className="p-8 rounded-2xl bg-white shadow text-center">
            <div className="text-gray-500">
              Select an organization from the dropdown above
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SeatsCard orgId={orgId} canAdmin={canAdmin} />

              <div className="p-5 rounded-2xl bg-white shadow space-y-4">
                <div className="font-semibold text-gray-900">Quick Actions</div>
                <div className="space-y-2">
                  <button
                    onClick={() => router.push('/org/members')}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-left text-sm font-medium text-gray-900 transition-colors"
                  >
                    👥 Manage Members
                  </button>
                  <button
                    onClick={() => router.push('/org/billing')}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-left text-sm font-medium text-gray-900 transition-colors"
                  >
                    💳 Billing & Subscription
                  </button>
                  {canAdmin && (
                    <button
                      onClick={() => router.push('/org/settings')}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-left text-sm font-medium text-gray-900 transition-colors"
                    >
                      ⚙️ Organization Settings
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Organization Details */}
            {org && (
              <div className="p-5 rounded-2xl bg-white shadow space-y-3">
                <div className="font-semibold text-gray-900">Organization Details</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Name</div>
                    <div className="font-medium text-gray-900">{org.name}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">ID</div>
                    <div className="font-mono text-xs text-gray-900">{org.id}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Created</div>
                    <div className="font-medium text-gray-900">
                      {new Date(org.createdAt?.toMillis?.() || Date.now()).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Seats</div>
                    <div className="font-medium text-gray-900">
                      {org.usedSeats} / {org.seats}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
