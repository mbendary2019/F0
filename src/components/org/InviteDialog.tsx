/**
 * Phase 47 - Invite Dialog
 * Dialog for inviting new members to organization
 */

'use client';

import { useState } from 'react';
import { inviteMember } from '@/lib/org';
import { toast } from 'sonner';

interface InviteDialogProps {
  orgId: string;
}

export function InviteDialog({ orgId }: InviteDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [submitting, setSubmitting] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSubmitting(true);
    try {
      const result = await inviteMember({ orgId, email, role });

      toast.success(`Invite sent to ${email}`);

      // Store invite token for copy link feature
      setInviteToken(result.inviteId);

      console.log('Invite created:', {
        inviteId: result.inviteId,
        expiresAt: new Date(result.expiresAt).toISOString(),
      });

      // Reset email but keep dialog open to show invite link
      setEmail('');
    } catch (error: any) {
      console.error('Invite error:', error);

      if (error.code === 'resource-exhausted') {
        toast.error('No available seats. Please upgrade your plan.');
      } else if (error.code === 'already-exists') {
        toast.error('An invite is already pending for this email');
      } else {
        toast.error(error.message || 'Failed to send invite');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyInviteLink = () => {
    if (!inviteToken) return;

    const inviteUrl = `${window.location.origin}/org/accept-invite?token=${inviteToken}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      toast.success('Invite link copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  };

  const resetAndClose = () => {
    setOpen(false);
    setEmail('');
    setRole('member');
    setInviteToken(null);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-2xl bg-black text-white font-medium hover:bg-gray-800 transition-colors"
      >
        Invite Member
      </button>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-white shadow border border-gray-200 space-y-3">
      {/* Invite Form */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            disabled={submitting || !!inviteToken}
          />
        </div>

        <div className="w-32">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            disabled={submitting || !!inviteToken}
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || !!inviteToken}
          className="px-4 py-2 rounded-2xl bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Sending...' : 'Send'}
        </button>

        <button
          onClick={resetAndClose}
          disabled={submitting}
          className="px-3 py-2 rounded-2xl text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      {/* Copy Invite Link (shown after successful invite) */}
      {inviteToken && (
        <div className="p-3 rounded-xl bg-green-50 border border-green-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="text-xs font-medium text-green-900 mb-1">
                ✓ Invite Created Successfully
              </div>
              <div className="text-xs text-green-700">
                Share this link with your teammate (valid for 7 days)
              </div>
            </div>
            <button
              onClick={copyInviteLink}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
