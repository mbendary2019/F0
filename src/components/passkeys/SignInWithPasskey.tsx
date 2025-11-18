"use client";

import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

interface SignInWithPasskeyProps {
  onSuccess?: () => void;
}

export default function SignInWithPasskey({ onSuccess }: SignInWithPasskeyProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSignIn() {
    setStatus(null);
    setLoading(true);

    try {
      // 1. Get authentication options from server
      const optionsRes = await fetch("/api/webauthn/authentication/options", {
        method: "POST",
      });

      if (!optionsRes.ok) {
        const error = await optionsRes.json();
        throw new Error(error.error || "Failed to get authentication options");
      }

      const { challengeId, ...options } = await optionsRes.json();

      // 2. Start WebAuthn authentication ceremony
      let assertion;
      try {
        assertion = await startAuthentication(options);
      } catch (error: any) {
        // User cancelled or error during authentication
        if (error.name === "NotAllowedError") {
          throw new Error("Authentication cancelled");
        }
        throw error;
      }

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

      setStatus("✅ Signed in successfully!");

      // Notify parent component
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Passkey sign-in error:", error);
      setStatus(error.message || "Failed to sign in");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleSignIn}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg border-2 border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        {loading ? (
          <>
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Authenticating...
          </>
        ) : (
          <>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
            Sign in with a passkey
          </>
        )}
      </button>

      {status && (
        <div
          className={`rounded-lg p-3 text-sm ${
            status.includes("✅")
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}
