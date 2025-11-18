/**
 * Phase 47 - Seats Card
 * Display and manage organization seat usage
 */

'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { updateSeats } from '@/lib/org';
import { toast } from 'sonner';

interface SeatsCardProps {
  orgId: string;
  canAdmin: boolean;
}

interface OrgData {
  id: string;
  name: string;
  seats: number;
  usedSeats: number;
}

export function SeatsCard({ orgId, canAdmin }: SeatsCardProps) {
  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [newSeats, setNewSeats] = useState(0);

  useEffect(() => {
    if (!orgId) {
      setOrg(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'ops_orgs', orgId), (snapshot) => {
      if (snapshot.exists()) {
        const data = {
          id: snapshot.id,
          ...snapshot.data(),
        } as OrgData;
        setOrg(data);
        setNewSeats(data.seats);
      } else {
        setOrg(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orgId]);

  const handleUpdateSeats = async () => {
    if (!org || newSeats < org.usedSeats) {
      toast.error(`Cannot reduce seats below current usage (${org?.usedSeats})`);
      return;
    }

    if (newSeats < 1 || newSeats > 1000) {
      toast.error('Seats must be between 1 and 1000');
      return;
    }

    setUpdating(true);
    try {
      await updateSeats({ orgId, newSeats });
      toast.success(`Seats updated to ${newSeats}`);
      setShowUpgrade(false);
    } catch (error: any) {
      console.error('Update seats error:', error);
      toast.error(error.message || 'Failed to update seats');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-5 rounded-2xl bg-white shadow">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="p-5 rounded-2xl bg-white shadow">
        <div className="text-sm text-gray-500">Organization not found</div>
      </div>
    );
  }

  const used = org.usedSeats || 0;
  const limit = org.seats || 0;
  const percentage = limit > 0 ? Math.min(100, Math.round((used * 100) / limit)) : 0;
  const isNearLimit = percentage >= 80;

  return (
    <div className="p-5 rounded-2xl bg-white shadow space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="font-semibold text-gray-900">Seats</div>
        <div className="text-sm text-gray-500">
          {used} / {limit} used
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="h-2 rounded-xl bg-gray-100 overflow-hidden">
          <div
            className={`h-full transition-all ${
              isNearLimit ? 'bg-red-500' : 'bg-black'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {isNearLimit && (
          <div className="text-xs text-red-600 font-medium">
            ⚠️ Approaching seat limit
          </div>
        )}
      </div>

      {/* Upgrade Section */}
      {canAdmin && (
        <div className="pt-2 border-t border-gray-100">
          {!showUpgrade ? (
            <button
              onClick={() => setShowUpgrade(true)}
              className="w-full px-4 py-2 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Upgrade Seats
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  New seat limit
                </label>
                <input
                  type="number"
                  min={org.usedSeats}
                  max={1000}
                  value={newSeats}
                  onChange={(e) => setNewSeats(parseInt(e.target.value) || 0)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  disabled={updating}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Minimum: {org.usedSeats} (current usage)
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleUpdateSeats}
                  disabled={updating}
                  className="flex-1 px-4 py-2 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? 'Updating...' : 'Update'}
                </button>
                <button
                  onClick={() => {
                    setShowUpgrade(false);
                    setNewSeats(org.seats);
                  }}
                  disabled={updating}
                  className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
        Each member occupies one seat. Upgrade your plan to add more members.
      </div>
    </div>
  );
}
