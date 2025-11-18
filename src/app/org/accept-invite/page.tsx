/**
 * Phase 47 - Accept Invite Page
 * Page for accepting organization invitations
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { acceptInvite } from '@/lib/org';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'sonner';

function AcceptInviteContent() {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAccept = async () => {
    if (!uid || !token) return;

    setAccepting(true);
    try {
      const result = await acceptInvite({ inviteId: token });

      toast.success(`Joined ${result.orgName}!`);

      // Redirect to org page
      setTimeout(() => {
        router.push('/org');
      }, 1500);
    } catch (error: any) {
      console.error('Accept invite error:', error);

      if (error.code === 'not-found') {
        toast.error('Invite not found or expired');
      } else if (error.code === 'already-exists') {
        toast.error('You are already a member of this organization');
      } else {
        toast.error(error.message || 'Failed to accept invite');
      }
    } finally {
      setAccepting(false);
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
        <div className="max-w-md w-full p-8 rounded-2xl bg-white shadow text-center space-y-4">
          <div className="text-4xl mb-2">📧</div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Organization Invitation
          </h1>
          <p className="text-gray-600">
            You've been invited to join an organization.
            Please sign in to accept this invitation.
          </p>
          <button
            onClick={() => router.push(`/login?redirect=/org/accept-invite?token=${token}`)}
            className="w-full px-6 py-3 rounded-2xl bg-black text-white font-medium hover:bg-gray-800 transition-colors"
          >
            Sign In to Accept
          </button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white shadow text-center space-y-4">
          <div className="text-4xl mb-2">❌</div>
          <h1 className="text-2xl font-semibold text-gray-900">Invalid Invite</h1>
          <p className="text-gray-600">
            This invitation link is invalid or incomplete.
          </p>
          <button
            onClick={() => router.push('/org')}
            className="w-full px-6 py-3 rounded-2xl bg-black text-white font-medium hover:bg-gray-800 transition-colors"
          >
            Go to Organizations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full p-8 rounded-2xl bg-white shadow text-center space-y-6">
        <div className="text-5xl mb-2">🎉</div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            You're Invited!
          </h1>
          <p className="text-gray-600">
            You've been invited to join an organization.
            Click below to accept and become a team member.
          </p>
        </div>

        <div className="pt-4">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full px-6 py-3 rounded-2xl bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {accepting ? 'Accepting...' : '✓ Accept Invitation'}
          </button>
        </div>

        <div className="pt-2">
          <button
            onClick={() => router.push('/org')}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Go back to organizations
          </button>
        </div>

        <div className="text-xs text-gray-400 pt-4 border-t border-gray-100">
          Invitation token: {token.substring(0, 12)}...
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}
