"use client";

import { useState, useRef } from "react";
import {
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
  PhoneMultiFactorGenerator,
  PhoneAuthProvider,
  RecaptchaVerifier,
  MultiFactorResolver,
} from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

interface MfaResolverProps {
  error: any; // FirebaseError with code 'auth/multi-factor-auth-required'
  onResolved: () => void;
  onCancel?: () => void;
}

export default function MfaResolver({
  error,
  onResolved,
  onCancel,
}: MfaResolverProps) {
  const [selectedMethod, setSelectedMethod] = useState<"totp" | "sms" | null>(
    null
  );
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resolverRef = useRef<MultiFactorResolver | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const verificationIdRef = useRef<string | null>(null);

  // Initialize resolver
  if (!resolverRef.current && error) {
    try {
      resolverRef.current = getMultiFactorResolver(auth, error);
    } catch (e) {
      console.error("Failed to get MFA resolver:", e);
    }
  }

  const resolver = resolverRef.current;
  if (!resolver) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">
          Unable to resolve MFA challenge. Please try signing in again.
        </p>
      </div>
    );
  }

  // Get available methods
  const totpHint = resolver.hints.find(
    (h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID
  );
  const smsHint = resolver.hints.find(
    (h) => h.factorId === PhoneMultiFactorGenerator.FACTOR_ID
  );

  async function resolveWithTOTP() {
    if (!code || code.length !== 6) {
      setStatus("Please enter the 6-digit code");
      return;
    }

    if (!totpHint) {
      setStatus("TOTP not available");
      return;
    }

    setStatus(null);
    setLoading(true);

    try {
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(
        totpHint.uid,
        code
      );
      await resolver.resolveSignIn(assertion);
      onResolved();
    } catch (error: any) {
      console.error("TOTP resolution error:", error);
      setStatus(error.message || "Verification failed. Please try again.");
      setLoading(false);
    }
  }

  async function sendSmsCode() {
    if (!smsHint) {
      setStatus("SMS not available");
      return;
    }

    setStatus(null);
    setLoading(true);

    try {
      // Initialize reCAPTCHA
      if (!verifierRef.current) {
        verifierRef.current = new RecaptchaVerifier(
          auth,
          "recaptcha-container-resolver",
          {
            size: "invisible",
          }
        );
      }

      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(
        {
          multiFactorHint: smsHint,
          session: resolver.session,
        },
        verifierRef.current
      );

      verificationIdRef.current = verificationId;
      setStatus("✉️ Verification code sent to your phone");
    } catch (error: any) {
      console.error("SMS send error:", error);
      setStatus(error.message || "Failed to send code");

      // Reset reCAPTCHA
      if (verifierRef.current) {
        verifierRef.current.clear();
        verifierRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  }

  async function resolveWithSMS() {
    if (!code || code.length !== 6) {
      setStatus("Please enter the 6-digit code");
      return;
    }

    if (!verificationIdRef.current) {
      setStatus("Please request a code first");
      return;
    }

    setStatus(null);
    setLoading(true);

    try {
      const credential = PhoneAuthProvider.credential(
        verificationIdRef.current,
        code
      );
      const assertion = PhoneMultiFactorGenerator.assertion(credential);
      await resolver.resolveSignIn(assertion);
      onResolved();
    } catch (error: any) {
      console.error("SMS resolution error:", error);
      setStatus(error.message || "Verification failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
      {/* reCAPTCHA container */}
      <div id="recaptcha-container-resolver" />

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">
          Two-Factor Authentication Required
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Please verify your identity to continue
        </p>
      </div>

      {/* Method Selection */}
      {!selectedMethod && (
        <div className="space-y-3">
          {totpHint && (
            <button
              onClick={() => setSelectedMethod("totp")}
              className="flex w-full items-center gap-4 rounded-lg border border-slate-200 p-4 text-left transition-colors hover:border-indigo-500 hover:bg-indigo-50"
            >
              <div className="flex-shrink-0 rounded-lg bg-indigo-100 p-3">
                <svg
                  className="h-6 w-6 text-indigo-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-slate-900">Authenticator App</h3>
                <p className="text-sm text-slate-600">
                  Use your authenticator app
                </p>
              </div>
              <svg
                className="h-5 w-5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}

          {smsHint && (
            <button
              onClick={() => {
                setSelectedMethod("sms");
                sendSmsCode();
              }}
              disabled={loading}
              className="flex w-full items-center gap-4 rounded-lg border border-slate-200 p-4 text-left transition-colors hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50"
            >
              <div className="flex-shrink-0 rounded-lg bg-blue-100 p-3">
                <svg
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-slate-900">SMS</h3>
                <p className="text-sm text-slate-600">
                  Send code to {(smsHint as any)?.phoneNumber || "your phone"}
                </p>
              </div>
              <svg
                className="h-5 w-5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* TOTP Verification */}
      {selectedMethod === "totp" && (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedMethod(null)}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to methods
          </button>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Enter code from your authenticator app
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              maxLength={6}
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg font-mono tracking-widest focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={resolveWithTOTP}
            disabled={loading || code.length !== 6}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:bg-indigo-400"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </div>
      )}

      {/* SMS Verification */}
      {selectedMethod === "sms" && (
        <div className="space-y-4">
          <button
            onClick={() => {
              setSelectedMethod(null);
              setCode("");
              verificationIdRef.current = null;
            }}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to methods
          </button>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Enter code from SMS
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              maxLength={6}
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg font-mono tracking-widest focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={resolveWithSMS}
            disabled={loading || code.length !== 6}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>

          <button
            onClick={sendSmsCode}
            disabled={loading}
            className="w-full text-center text-sm text-blue-600 hover:text-blue-700 disabled:text-blue-400"
          >
            Resend code
          </button>
        </div>
      )}

      {/* Status Message */}
      {status && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm ${
            status.includes("✉️")
              ? "bg-blue-50 text-blue-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {status}
        </div>
      )}

      {/* Cancel */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-4 w-full text-center text-sm text-slate-600 hover:text-slate-900"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
