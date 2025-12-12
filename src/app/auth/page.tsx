'use client';

/**
 * Legacy Auth Page - Redirects to new auth location
 * This page redirects to /[locale]/auth
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyAuthPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to new auth location
    router.replace('/en/auth');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center neon-shell">
      <div className="text-white text-lg animate-pulse">
        Redirecting to login...
      </div>
    </div>
  );
}
