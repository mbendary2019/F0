/**
 * Phase 47 - useOrg Hook
 * Organization context and membership management
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface OrgMembership {
  orgId: string;
  uid: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: any;
}

interface Organization {
  id: string;
  name: string;
  seats: number;
  usedSeats: number;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export function useOrg(uid?: string) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore last selected org from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('selectedOrgId');
    if (stored) {
      setOrgId(stored);
    }
    setLoading(false);
  }, []);

  // Persist selected org to localStorage
  useEffect(() => {
    if (orgId) {
      localStorage.setItem('selectedOrgId', orgId);
    } else {
      localStorage.removeItem('selectedOrgId');
    }
  }, [orgId]);

  // Load user's memberships
  useEffect(() => {
    if (!uid) {
      setMemberships([]);
      return;
    }

    const q = query(
      collection(db, 'ops_org_members'),
      where('uid', '==', uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as OrgMembership[];

      setMemberships(data);

      // Auto-select first org if none selected
      if (data.length > 0 && !orgId) {
        setOrgId(data[0].orgId);
      }
    });

    return () => unsubscribe();
  }, [uid]);

  // Load current organization details
  useEffect(() => {
    if (!orgId) {
      setOrg(null);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'ops_orgs', orgId), (snapshot) => {
      if (snapshot.exists()) {
        setOrg({
          id: snapshot.id,
          ...snapshot.data(),
        } as Organization);
      } else {
        setOrg(null);
      }
    });

    return () => unsubscribe();
  }, [orgId]);

  // Get current user's role in selected org
  const currentRole = useMemo(() => {
    const membership = memberships.find((m) => m.orgId === orgId);
    return membership?.role ?? null;
  }, [memberships, orgId]);

  // Check if user can perform admin actions
  const canAdmin = currentRole === 'owner' || currentRole === 'admin';

  // Check if user is owner
  const isOwner = currentRole === 'owner';

  // Check if user can write
  const canWrite = currentRole !== 'viewer';

  return {
    // Current org
    orgId,
    setOrgId,
    org,

    // Memberships
    memberships,
    currentRole,

    // Permissions
    canAdmin,
    isOwner,
    canWrite,

    // Loading state
    loading,
  };
}
