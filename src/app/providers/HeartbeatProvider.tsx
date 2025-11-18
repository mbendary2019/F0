// F0 Phase 35 - Heartbeat Provider (Web/Next.js)

'use client';

import { useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export interface HeartbeatProviderProps {
  deviceId: string;
  children: React.ReactNode;
}

/**
 * Heartbeat Provider
 * Sends periodic heartbeats to keep device presence updated
 */
export function HeartbeatProvider({ deviceId, children }: HeartbeatProviderProps) {
  useEffect(() => {
    const heartbeatFn = httpsCallable(functions, 'heartbeat');

    const sendHeartbeat = async () => {
      try {
        await heartbeatFn({
          deviceId,
          appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
          capabilities: {
            push: typeof window !== 'undefined' && 'Notification' in window,
            deeplink: false, // Browser doesn't support deep links by default
            clipboard: typeof navigator !== 'undefined' && !!navigator.clipboard,
            offline: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
          },
        });

        console.log(`✅ Heartbeat sent for device ${deviceId}`);
      } catch (error) {
        console.error('Heartbeat error:', error);
      }
    };

    // Send immediately
    sendHeartbeat();

    // Then every 30 seconds
    const intervalId = setInterval(sendHeartbeat, 30_000);

    return () => {
      clearInterval(intervalId);

      // Optionally mark as offline on unmount
      const markOfflineFn = httpsCallable(functions, 'markOffline');
      markOfflineFn({ deviceId }).catch((err) =>
        console.warn('Failed to mark offline:', err)
      );
    };
  }, [deviceId]);

  return <>{children}</>;
}


