'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminAuditsRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to /audits
    router.replace('/audits');
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
        <p className="text-neutral-400">Redirecting to Audit Dashboard...</p>
      </div>
    </div>
  );
}


