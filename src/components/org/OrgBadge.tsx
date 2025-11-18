/**
 * Phase 47 - Organization Badge
 * Shows seat usage in header
 */

'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useOrg } from '@/hooks/useOrg';
import Link from 'next/link';

interface OrgData {
  id: string;
  name: string;
  seats: number;
  usedSeats: number;
}

interface OrgBadgeProps {
  uid?: string;
}

export function OrgBadge({ uid }: OrgBadgeProps) {
  const { orgId } = useOrg(uid);
  const [org, setOrg] = useState<OrgData | null>(null);

  useEffect(() => {
    if (!orgId) {
      setOrg(null);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'ops_orgs', orgId), (snapshot) => {
      if (snapshot.exists()) {
        setOrg({ id: snapshot.id, ...snapshot.data() } as OrgData);
      } else {
        setOrg(null);
      }
    });

    return () => unsubscribe();
  }, [orgId]);

  if (!org) return null;

  const percentage = org.seats > 0 ? Math.round((org.usedSeats * 100) / org.seats) : 0;
  const isNearLimit = percentage >= 80;

  return (
    <Link
      href="/org/billing"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
      title={`${org.name}: ${org.usedSeats}/${org.seats} seats used`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-gray-700">
          {org.usedSeats}/{org.seats}
        </span>
        <svg
          className={`w-3.5 h-3.5 ${isNearLimit ? 'text-red-500' : 'text-gray-500'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      </div>
      {isNearLimit && (
        <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold">
          !
        </span>
      )}
    </Link>
  );
}
