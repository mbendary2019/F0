"use client";
import { httpsCallable, getFunctions } from "firebase/functions";
import { useState } from "react";

export default function CreatorApplyPage() {
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const f = getFunctions();
      await httpsCallable(f, "createConnectAccount")({});
      const link: any = await httpsCallable(f, "createAccountLink")({});
      if (link?.data?.url) window.location.href = link.data.url;
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold mb-3">Join the Creator Program</h1>
      <p className="opacity-80 mb-4 text-sm">Connect your Stripe Express account to receive payouts.</p>
      <button onClick={start} disabled={busy} className="rounded-md bg-black px-4 py-2 text-white hover:opacity-90">
        {busy ? "Preparing…" : "Start Onboarding"}
      </button>
    </div>
  );
}
