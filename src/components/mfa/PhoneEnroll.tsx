"use client";

import { useRef, useState } from "react";
import { auth } from "@/lib/firebaseClient";
import {
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
} from "firebase/auth";

interface PhoneEnrollProps {
  onEnrolled?: () => void;
}

export default function PhoneEnroll({ onEnrolled }: PhoneEnrollProps) {
  const [step, setStep] = useState<"idle" | "phone" | "verify">("idle");
  const [phoneNumber, setPhoneNumber] = useState("+1");
  const [verificationCode, setVerificationCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState("Phone");

  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const verificationIdRef = useRef<string | null>(null);

  function startEnrollment() {
    setStep("phone");
    setStatus(null);
  }

  async function sendVerificationCode() {
    if (!phoneNumber || phoneNumber.length < 10) {
      setStatus("Please enter a valid phone number");
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
      const session = await mfaUser.getSession();

      // Initialize reCAPTCHA verifier if not already done
      if (!verifierRef.current) {
        verifierRef.current = new RecaptchaVerifier(
          auth,
          "recaptcha-container-phone",
          {
            size: "invisible",
          }
        );
      }

      const provider = new PhoneAuthProvider(auth);

      // Send verification code
      const verificationId = await provider.verifyPhoneNumber(
        {
          phoneNumber,
          session,
        },
        verifierRef.current
      );

      verificationIdRef.current = verificationId;
      setStep("verify");
      setStatus("✉️ Verification code sent to your phone");
    } catch (error: any) {
      console.error("SMS enrollment error:", error);
      setStatus(error.message || "Failed to send verification code");

      // Reset reCAPTCHA on error
      if (verifierRef.current) {
        verifierRef.current.clear();
        verifierRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndEnroll() {
    if (!verificationCode || verificationCode.length !== 6) {
      setStatus("Please enter the 6-digit code");
      return;
    }

    if (!verificationIdRef.current) {
      setStatus("No verification ID. Please try again.");
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

      // Create phone credential
      const credential = PhoneAuthProvider.credential(
        verificationIdRef.current,
        verificationCode
      );

      // Create assertion
      const assertion = PhoneMultiFactorGenerator.assertion(credential);

      // Enroll the phone factor
      await mfaUser.enroll(assertion, displayName || "Phone");

      setStatus("✅ Phone number enrolled successfully!");
      setStep("idle");
      setPhoneNumber("+1");
      setVerificationCode("");
      verificationIdRef.current = null;

      // Notify parent
      if (onEnrolled) {
        onEnrolled();
      }

      // Reset after 3 seconds
      setTimeout(() => {
        setStatus(null);
      }, 3000);
    } catch (error: any) {
      console.error("SMS verification error:", error);
      setStatus(error.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function cancel() {
    setStep("idle");
    setPhoneNumber("+1");
    setVerificationCode("");
    setStatus(null);
    verificationIdRef.current = null;

    // Clear reCAPTCHA
    if (verifierRef.current) {
      verifierRef.current.clear();
      verifierRef.current = null;
    }
  }

  function resendCode() {
    setVerificationCode("");
    sendVerificationCode();
  }

  return (
    <div className="space-y-4">
      {/* reCAPTCHA container */}
      <div id="recaptcha-container-phone" />

      {step === "idle" && (
        <div>
          <button
            onClick={startEnrollment}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Enable SMS Authentication
          </button>
        </div>
      )}

      {step === "phone" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Include country code (e.g., +1 for US)
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Device Name (optional)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Personal Phone"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={sendVerificationCode}
              disabled={loading || phoneNumber.length < 10}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400"
            >
              {loading ? "Sending..." : "Send Code"}
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

      {step === "verify" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-sm text-blue-800">
              We sent a verification code to{" "}
              <span className="font-medium">{phoneNumber}</span>
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Verification Code
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) =>
                setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              maxLength={6}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg font-mono tracking-widest focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Enter the 6-digit code sent to your phone
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={verifyAndEnroll}
              disabled={loading || verificationCode.length !== 6}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400"
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

          <button
            onClick={resendCode}
            disabled={loading}
            className="w-full text-center text-sm text-blue-600 hover:text-blue-700 disabled:text-blue-400"
          >
            Didn't receive the code? Resend
          </button>
        </div>
      )}

      {/* Status Message */}
      {status && (
        <div
          className={`rounded-lg p-3 text-sm ${
            status.includes("✅") || status.includes("✉️")
              ? "bg-blue-50 text-blue-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}
