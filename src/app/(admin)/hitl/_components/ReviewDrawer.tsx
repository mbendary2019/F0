"use client";

import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function ReviewDrawer({
  open, onClose, review, onResolved
}: {
  open: boolean;
  onClose: () => void;
  review: any | null;
  onResolved: () => Promise<void> | void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [redacted, setRedacted] = useState<string | null>(null);
  const [safe, setSafe] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  if (!open || !review) return null;

  const doRedact = async () => {
    setBusy(true);
    try {
      const fn = httpsCallable(getFunctions(), "redactPII");
      const res: any = await fn({ text: input, strategies: { email: "mask", phone: "mask", cc: "mask", ssn: "mask" } });
      setRedacted(res?.data?.redactedText ?? "");
    } finally { setBusy(false); }
  };

  const doSafeRegen = async () => {
    setBusy(true);
    try {
      const fn = httpsCallable(getFunctions(), "safeRegenerate");
      const res: any = await fn({ text: input, policy: { maxLen: 1200 } });
      setSafe(res?.data?.safeText ?? "");
    } finally { setBusy(false); }
  };

  const resolve = async (action: "approve"|"reject") => {
    setBusy(true);
    try {
      const fn = httpsCallable(getFunctions(), "hitlResolve");
      const mergedNotes = [
        notes && `notes: ${notes}`,
        redacted && `redacted: ${redacted.slice(0,120)}${redacted.length>120?"…":""}`,
        safe && `safe: ${safe.slice(0,120)}${safe.length>120?"…":""}`
      ].filter(Boolean).join(" | ");
      await fn({ reviewId: review.id, action, notes: mergedNotes });
      await onResolved();
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="ml-auto h-full w-full max-w-2xl bg-white shadow-2xl dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b p-4">
          <div className="font-semibold">Review: {review.id}</div>
          <button onClick={onClose} className="rounded-md border px-3 py-1 hover:bg-gray-50">Close</button>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs opacity-70 mb-1">Input to remediate</div>
              <textarea value={input} onChange={(e)=>setInput(e.target.value)}
                        className="h-40 w-full rounded-md border p-2" placeholder="Paste sensitive/flagged content here…" />
              <div className="mt-2 flex gap-2">
                <button onClick={doRedact} disabled={busy||!input} className="rounded-md border px-3 py-1 hover:bg-gray-50">Redact PII</button>
                <button onClick={doSafeRegen} disabled={busy||!input} className="rounded-md border px-3 py-1 hover:bg-gray-50">Safe Regenerate</button>
              </div>
            </div>

            <div>
              <div className="text-xs opacity-70 mb-1">Redacted (preview)</div>
              <div className="h-40 w-full overflow-auto rounded-md border p-2 text-sm whitespace-pre-wrap">{redacted ?? "—"}</div>
              <div className="mt-3 text-xs opacity-70 mb-1">Safe (preview)</div>
              <div className="h-40 w-full overflow-auto rounded-md border p-2 text-sm whitespace-pre-wrap">{safe ?? "—"}</div>
            </div>
          </div>

          <div>
            <div className="text-xs opacity-70 mb-1">Notes</div>
            <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} className="h-20 w-full rounded-md border p-2" />
          </div>

          <div className="flex gap-2">
            <button onClick={()=>resolve("approve")} disabled={busy} className="rounded-md border px-3 py-2 hover:bg-gray-50">Approve & Resolve</button>
            <button onClick={()=>resolve("reject")} disabled={busy} className="rounded-md border px-3 py-2 hover:bg-gray-50">Reject & Resolve</button>
          </div>
        </div>
      </div>
      <div className="flex-1 bg-black/30" onClick={onClose} />
    </div>
  );
}
