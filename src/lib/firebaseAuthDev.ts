/**
 * Development Authentication Helper
 * Auto sign-in anonymously in development environment
 */

import { getAuth, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { app } from './firebase';

let authInitialized = false;

/**
 * Ensure user is authenticated in development environment
 * Auto signs in anonymously if no user exists
 */
export async function ensureDevAuth(): Promise<void> {
  // Skip if already initialized
  if (authInitialized) return;

  // Only run in browser
  if (typeof window === 'undefined') return;

  // Only run in development/emulator mode
  const useEmulators =
    process.env.NEXT_PUBLIC_USE_EMULATORS === '1' ||
    process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';

  if (!useEmulators && location.hostname !== 'localhost') return;

  const auth = getAuth(app);

  try {
    // Connect to Auth emulator if in localhost
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      try {
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        console.log('✅ [devAuth] Connected to Auth emulator');
      } catch (e: any) {
        // Ignore if already connected
        if (!e.message?.includes('already been called')) {
          console.warn('⚠️ [devAuth] Failed to connect to Auth emulator:', e.message);
        }
      }
    }

    // Sign in anonymously if no user
    if (!auth.currentUser) {
      await signInAnonymously(auth);
      console.log('✅ [devAuth] Signed in anonymously');
    }

    authInitialized = true;
  } catch (e: any) {
    console.warn('⚠️ [devAuth] Failed to ensure auth:', e.message);
  }
}

/**
 * Initialize development auth on import (side effect)
 * This ensures auth is ready before any Firebase calls
 */
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ensureDevAuth());
  } else {
    ensureDevAuth();
  }
}
