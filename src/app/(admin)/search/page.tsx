"use client";
import { httpsCallable, getFunctions } from "firebase/functions";
import { useState } from "react";

export default function AdminSearchPage() {
  const [out, setOut] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const reindex = async () => {
    setBusy(true);
    try {
      const fn = httpsCallable(getFunctions(), "reindexProducts");
      const res: any = await fn({});
      setOut(res?.data || {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Search — Reindex</h1>
      <p className="text-sm opacity-70">
        Reindex all active+published products to Algolia (if configured).
      </p>
      <button
        onClick={reindex}
        disabled={busy}
        className="rounded-md bg-black px-4 py-2 text-white hover:opacity-90"
      >
        {busy ? "Reindexing…" : "Reindex Products"}
      </button>
      {out && (
        <pre className="rounded-md border p-3 text-xs bg-gray-50">
          {JSON.stringify(out, null, 2)}
        </pre>
      )}
    </div>
  );
}
