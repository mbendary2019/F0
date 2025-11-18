/**
 * Phase 47 - Organization Switcher
 * Dropdown to switch between user's organizations
 */

'use client';

import { useOrg } from '@/hooks/useOrg';

interface OrgSwitcherProps {
  uid: string;
}

export function OrgSwitcher({ uid }: OrgSwitcherProps) {
  const { orgId, setOrgId, memberships, loading } = useOrg(uid);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  if (memberships.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">No organizations</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">Organization</span>
      <select
        className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        value={orgId ?? ''}
        onChange={(e) => setOrgId(e.target.value || null)}
      >
        <option value="">Select organization...</option>
        {memberships.map((m) => (
          <option key={m.orgId} value={m.orgId}>
            {m.orgId} · {m.role}
          </option>
        ))}
      </select>
    </div>
  );
}
