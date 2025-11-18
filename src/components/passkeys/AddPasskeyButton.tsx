"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { auth } from "@/lib/firebaseClient";

interface AddPasskeyButtonProps {
  onSuccess?: () => void;
}

export default function AddPasskeyButton({ onSuccess }: AddPasskeyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleAddPasskey() {
    setStatus(null);
    setLoading(true);

    try {
      // Get current user's ID token
      const user = auth.currentUser;
      if (!user) {
        setStatus("Please sign in first");
        setLoading(false);
        return;
      }

      const idToken = await user.getIdToken();

      // 1. Get registration options from server
      const optionsRes = await fetch("/api/webauthn/registration/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!optionsRes.ok) {
        const error = await optionsRes.json();
        throw new Error(error.error || "Failed to get registration options");
      }

      const options = await optionsRes.json();

      // 2. Start WebAuthn registration ceremony
      let attResp;
      try {
        attResp = await startRegistration(options);
      } catch (error: any) {
        // User cancelled or error during registration
        if (error.name === "NotAllowedError") {
          throw new Error("Registration cancelled");
        }
        throw error;
      }

      // 3. Send response to server for verification
      const verifyRes = await fetch("/api/webauthn/registration/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, attResp }),
      });

      if (!verifyRes.ok) {
        const error = await verifyRes.json();
        throw new Error(error.error || "Verification failed");
      }

      const result = await verifyRes.json();

      setStatus("✅ Passkey added successfully!");

      // Notify parent component
      if (onSuccess) {
        onSuccess();
      }

      // Clear status after 3 seconds
      setTimeout(() => setStatus(null), 3000);
    } catch (error: any) {
      console.error("Add passkey error:", error);
      setStatus(error.message || "Failed to add passkey");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleAddPasskey}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:bg-indigo-400"
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
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
            Adding passkey...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add a passkey
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

      <p className="text-xs text-slate-500">
        Use Face ID, Touch ID, Windows Hello, or a security key
      </p>
    </div>
  );
}
