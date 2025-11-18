/**
 * Phase 47 - Organization Billing Page
 * Manage subscription, seats, and billing
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OrgSwitcher } from '@/components/org/OrgSwitcher';
import { SeatsCard } from '@/components/org/SeatsCard';
import { useOrg } from '@/hooks/useOrg';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';

export default function OrgBilling() {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const router = useRouter();
  const { orgId, org, canAdmin, isOwner } = useOrg(uid || undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const openCustomerPortal = async () => {
    if (!uid) return;

    setPortalLoading(true);
    try {
      const createPortalSession = httpsCallable(functions, 'createPortalSession');
      const result: any = await createPortalSession({});

      if (result.data?.url) {
        window.location.href = result.data.url;
      } else {
        toast.error('Failed to create portal session');
      }
    } catch (error: any) {
      console.error('Portal error:', error);
      toast.error(error.message || 'Failed to open customer portal');
    } finally {
      setPortalLoading(false);
    }
  };

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
          <p className="text-gray-500">You need to be signed in to view billing</p>
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
            <h1 className="text-2xl font-semibold text-gray-900">Organization Billing</h1>
            {org && <p className="text-sm text-gray-500 mt-1">{org.name}</p>}
          </div>
          <OrgSwitcher uid={uid} />
        </div>

        {/* Content */}
        {!orgId ? (
          <div className="p-8 rounded-2xl bg-white shadow text-center">
            <div className="text-gray-500">
              Select an organization to view billing
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Main Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Seats Card */}
              <SeatsCard orgId={orgId} canAdmin={canAdmin} />

              {/* Billing Portal */}
              <div className="p-5 rounded-2xl bg-white shadow space-y-4">
                <div className="font-semibold text-gray-900">Customer Portal</div>
                <p className="text-sm text-gray-600">
                  Manage your subscription, payment methods, and view invoices through
                  the Stripe Customer Portal.
                </p>
                <button
                  onClick={openCustomerPortal}
                  disabled={portalLoading}
                  className="w-full px-4 py-3 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {portalLoading ? 'Opening...' : '💳 Open Billing Portal'}
                </button>
                <div className="text-xs text-gray-500">
                  You'll be redirected to Stripe to manage your subscription
                </div>
              </div>
            </div>

            {/* Subscription Info */}
            {org && (
              <div className="p-5 rounded-2xl bg-white shadow space-y-4">
                <div className="font-semibold text-gray-900">Subscription Details</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 mb-1">Seats</div>
                    <div className="text-2xl font-semibold text-gray-900">
                      {org.seats}
                    </div>
                    <div className="text-xs text-gray-500">
                      {org.usedSeats} in use
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Status</div>
                    <div className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      Active
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Created</div>
                    <div className="font-medium text-gray-900">
                      {new Date(
                        org.createdAt?.toMillis?.() || Date.now()
                      ).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Last Updated</div>
                    <div className="font-medium text-gray-900">
                      {new Date(
                        org.updatedAt?.toMillis?.() || Date.now()
                      ).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pricing Info */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-900">💎 Upgrade Your Plan</div>
                {canAdmin && (
                  <button className="px-4 py-2 rounded-xl bg-white shadow-sm text-sm font-medium text-gray-900 hover:shadow transition-all">
                    View Plans
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-700">
                Need more seats or advanced features? Upgrade your organization's plan
                to unlock additional capacity and capabilities.
              </p>
            </div>

            {/* Admin Actions */}
            {isOwner && (
              <div className="p-5 rounded-2xl bg-red-50 border border-red-100 space-y-3">
                <div className="font-semibold text-red-900">⚠️ Danger Zone</div>
                <p className="text-sm text-red-700">
                  Careful! These actions cannot be undone.
                </p>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        'Are you sure you want to delete this organization? This cannot be undone!'
                      )
                    ) {
                      toast.error('Organization deletion not yet implemented');
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Delete Organization
                </button>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/org')}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-white hover:shadow transition-all"
              >
                ← Back to Overview
              </button>
              <button
                onClick={() => router.push('/org/members')}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-white hover:shadow transition-all"
              >
                View Members →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
