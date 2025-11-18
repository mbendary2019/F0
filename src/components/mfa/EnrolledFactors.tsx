"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebaseClient";
import {
  multiFactor,
  MultiFactorInfo,
  TotpMultiFactorGenerator,
  PhoneMultiFactorGenerator,
} from "firebase/auth";

interface EnrolledFactorsProps {
  onUpdate?: () => void;
}

export default function EnrolledFactors({ onUpdate }: EnrolledFactorsProps) {
  const [factors, setFactors] = useState<MultiFactorInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    loadFactors();
  }, []);

  function loadFactors() {
    const user = auth.currentUser;
    if (!user) return;

    const mfaUser = multiFactor(user);
    setFactors(mfaUser.enrolledFactors);
  }

  async function unenrollFactor(factor: MultiFactorInfo) {
    if (
      !confirm(
        `Are you sure you want to remove "${factor.displayName || "this factor"}"? You may lose access to your account if you don't have another authentication method.`
      )
    ) {
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
      await mfaUser.unenroll(factor);

      setStatus(`✅ Removed "${factor.displayName || "factor"}"`);
      loadFactors();

      if (onUpdate) {
        onUpdate();
      }

      setTimeout(() => setStatus(null), 3000);
    } catch (error: any) {
      console.error("Unenroll error:", error);
      setStatus(error.message || "Failed to remove factor");
    } finally {
      setLoading(false);
    }
  }

  if (factors.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Active Authentication Methods
      </h2>

      <div className="space-y-3">
        {factors.map((factor) => {
          const isTOTP = factor.factorId === TotpMultiFactorGenerator.FACTOR_ID;
          const isSMS = factor.factorId === PhoneMultiFactorGenerator.FACTOR_ID;

          return (
            <div
              key={factor.uid}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex-shrink-0 rounded-lg p-2 ${
                    isTOTP
                      ? "bg-indigo-100"
                      : isSMS
                      ? "bg-blue-100"
                      : "bg-slate-100"
                  }`}
                >
                  {isTOTP ? (
                    <svg
                      className="h-5 w-5 text-indigo-600"
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
                  ) : isSMS ? (
                    <svg
                      className="h-5 w-5 text-blue-600"
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
                  ) : (
                    <svg
                      className="h-5 w-5 text-slate-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">
                    {factor.displayName || "Unnamed Method"}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {isTOTP && "Authenticator App"}
                    {isSMS && `SMS • ${(factor as any).phoneNumber || "Phone"}`}
                    {!isTOTP && !isSMS && factor.factorId}
                  </p>
                  <p className="text-xs text-slate-500">
                    Enrolled:{" "}
                    {new Date(
                      factor.enrollmentTime
                    ).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => unenrollFactor(factor)}
                disabled={loading}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      {status && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm ${
            status.includes("✅")
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {status}
        </div>
      )}
    </section>
  );
}
