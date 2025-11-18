"use client";

import { useEffect, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

interface ConditionalPasskeyUIProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * Conditional UI Component for Passkey Autofill
 *
 * Displays "Sign in with a passkey" suggestion in browser's autofill UI
 * automatically when user focuses on input fields (Chrome/Android/Safari).
 *
 * Uses WebAuthn Conditional UI (modal authentication) which shows
 * available passkeys in the browser's native autofill dropdown.
 */
export default function ConditionalPasskeyUI({ onSuccess, onError }: ConditionalPasskeyUIProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    // Check if conditional mediation is available
    (async () => {
      if (
        "PublicKeyCredential" in window &&
        typeof PublicKeyCredential.isConditionalMediationAvailable === "function"
      ) {
        try {
          const available = await PublicKeyCredential.isConditionalMediationAvailable();
          setIsSupported(available);

          if (available) {
            // Start conditional authentication automatically
            startConditionalAuth();
          }
        } catch (error) {
          console.error("Conditional mediation check failed:", error);
        }
      }
    })();
  }, []);

  async function startConditionalAuth() {
    if (isAuthenticating) return;

    setIsAuthenticating(true);

    try {
      // 1. Get authentication options from server
      const optionsRes = await fetch("/api/webauthn/authentication/options", {
        method: "POST",
      });

      if (!optionsRes.ok) {
        throw new Error("Failed to get authentication options");
      }

      const { challengeId, ...options } = await optionsRes.json();

      // 2. Start WebAuthn authentication with conditional mediation
      // This will show passkeys in the autofill UI when user interacts with inputs
      const assertion = await startAuthentication({
        ...options,
        mediation: "conditional", // Enable conditional UI
      });

      // 3. Send assertion to server for verification
      const verifyRes = await fetch("/api/webauthn/authentication/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, assertion }),
      });

      if (!verifyRes.ok) {
        const error = await verifyRes.json();
        throw new Error(error.error || "Verification failed");
      }

      const result = await verifyRes.json();

      // 4. Sign in to Firebase with custom token
      await signInWithCustomToken(auth, result.customToken);

      // Notify parent component
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      // Ignore abort errors (user didn't select a passkey)
      if (error.name === "AbortError") {
        // Restart conditional auth
        setIsAuthenticating(false);
        setTimeout(() => startConditionalAuth(), 100);
        return;
      }

      console.error("Conditional passkey auth error:", error);

      if (onError) {
        onError(error.message || "Failed to sign in with passkey");
      }

      setIsAuthenticating(false);
    }
  }

  // This component doesn't render any UI
  // The autofill suggestion appears automatically in browser's native UI
  return null;
}
