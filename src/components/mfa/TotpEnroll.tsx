"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebaseClient";
import {
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
} from "firebase/auth";
import QRCode from "qrcode";

interface TotpEnrollProps {
  onEnrolled?: () => void;
}

export default function TotpEnroll({ onEnrolled }: TotpEnrollProps) {
  const [step, setStep] = useState<"idle" | "setup" | "verify">("idle");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState("Authenticator");

  async function startEnrollment() {
    setStatus(null);
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setStatus("Please sign in first");
        setLoading(false);
        return;
      }

      const mfaUser = multiFactor(user);
      const session = await mfaUser.getSession();

      // Generate TOTP secret
      const totpSecret = await TotpMultiFactorGenerator.generateSecret(session);

      setSecret(totpSecret);

      // Generate QR code
      const qrDataUrl = await QRCode.toDataURL(totpSecret.generateQrCodeUrl(
        user.email || "user@f0agent.com",
        "F0 Agent"
      ));

      setQrCodeDataUrl(qrDataUrl);
      setStep("verify");
    } catch (error: any) {
      console.error("TOTP enrollment error:", error);
      setStatus(error.message || "Failed to generate TOTP secret");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndEnroll() {
    if (!secret || !verificationCode) {
      setStatus("Please enter the verification code");
      return;
    }

    setStatus(null);
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setStatus("Please sign in first");
        setLoading(false);
        return;
      }

      const mfaUser = multiFactor(user);

      // Create assertion with the code
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        secret,
        verificationCode
      );

      // Enroll the TOTP factor
      await mfaUser.enroll(assertion, displayName || "Authenticator");

      setStatus("✅ Authenticator app enrolled successfully!");
      setStep("idle");
      setVerificationCode("");
      setSecret(null);
      setQrCodeDataUrl("");

      // Notify parent
      if (onEnrolled) {
        onEnrolled();
      }

      // Reset after 3 seconds
      setTimeout(() => {
        setStatus(null);
      }, 3000);
    } catch (error: any) {
      console.error("TOTP verification error:", error);
      setStatus(error.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function cancel() {
    setStep("idle");
    setVerificationCode("");
    setSecret(null);
    setQrCodeDataUrl("");
    setStatus(null);
  }

  return (
    <div className="space-y-4">
      {step === "idle" && (
        <div>
          <button
            onClick={startEnrollment}
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
                Setting up...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Enable Authenticator App
              </>
            )}
          </button>
        </div>
      )}

      {step === "verify" && (
        <div className="space-y-4">
          {/* QR Code */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 font-medium text-slate-900">
              Step 1: Scan QR Code
            </h3>
            <div className="flex justify-center">
              {qrCodeDataUrl && (
                <img
                  src={qrCodeDataUrl}
                  alt="TOTP QR Code"
                  className="h-48 w-48 rounded-lg border border-slate-200"
                />
              )}
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Scan this code with your authenticator app
            </p>
          </div>

          {/* Manual Entry */}
          {secret && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-2 text-sm font-medium text-slate-900">
                Can't scan? Enter manually:
              </h3>
              <code className="block rounded bg-slate-100 p-2 text-xs text-slate-700">
                {secret.secretKey}
              </code>
            </div>
          )}

          {/* Display Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Device Name (optional)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., My iPhone"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Verification Code */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Step 2: Enter Verification Code
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg font-mono tracking-widest focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={verifyAndEnroll}
              disabled={loading || verificationCode.length !== 6}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:bg-indigo-400"
            >
              {loading ? "Verifying..." : "Verify & Enable"}
            </button>
            <button
              onClick={cancel}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status Message */}
      {status && (
        <div className={`rounded-lg p-3 text-sm ${
          status.includes("✅")
            ? "bg-emerald-50 text-emerald-700"
            : "bg-red-50 text-red-700"
        }`}>
          {status}
        </div>
      )}
    </div>
  );
}
