"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { useParams } from "next/navigation";

export default function DisputeDetail() {
  const params = useParams() as { id: string };
  const id = params.id;
  const [row, setRow] = useState<any>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await getAuth().currentUser?.getIdToken();
      const r = await fetch("/api/admin/disputes", {
        headers: { Authorization: `Bearer ${t}` },
        cache: "no-store",
      });
      const j = await r.json();
      setRow((j.items || []).find((d: any) => d.id === id) || null);
    })();
  }, [id]);

  const submit = async () => {
    setBusy(true);
    try {
      const paths: string[] = [];

      // Upload files to Storage first
      if (files?.length) {
        const storage = getStorage();
        for (const f of Array.from(files)) {
          const p = `disputes_evidence/${id}/${Date.now()}_${f.name}`;
          await uploadBytes(ref(storage, p), f);
          paths.push(p);
        }
      }

      // Call function to submit evidence
      const res: any = await httpsCallable(
        getFunctions(),
        "submitDisputeEvidence"
      )({ disputeId: id, text, filePaths: paths });

      alert(
        `Evidence submitted successfully!\nFiles uploaded: ${res?.data?.uploadedCount || 0}`
      );
      setText("");
      setFiles(null);
    } catch (err: any) {
      alert(err.message || "Failed to submit evidence");
    } finally {
      setBusy(false);
    }
  };

  if (!row) return <div className="p-6">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Dispute {id}</h1>

      <div className="rounded-xl border p-4 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="opacity-70">Payment Intent:</span>{" "}
            <span className="font-mono">{row.paymentIntentId || "-"}</span>
          </div>
          <div>
            <span className="opacity-70">Amount:</span> $
            {row.amountUsd?.toFixed(2) || "0.00"}
          </div>
          <div>
            <span className="opacity-70">Status:</span>{" "}
            <span
              className={`inline-block px-2 py-1 rounded text-xs ${
                row.status === "needs_response"
                  ? "bg-yellow-100 text-yellow-800"
                  : row.status === "won"
                  ? "bg-green-100 text-green-800"
                  : row.status === "lost"
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {row.status}
            </span>
          </div>
          <div>
            <span className="opacity-70">Reason:</span> {row.reason || "-"}
          </div>
          <div>
            <span className="opacity-70">Order:</span>{" "}
            <span className="font-mono">{row.orderId || "-"}</span>
          </div>
          <div>
            <span className="opacity-70">Evidence Due:</span>{" "}
            {row.evidenceDueBy
              ? new Date(row.evidenceDueBy).toLocaleString()
              : "-"}
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <div className="font-medium text-lg">Submit Evidence</div>

        <div className="space-y-2">
          <label className="block text-sm opacity-70">
            Communication / Delivery Proof:
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-md border p-3 text-sm"
            rows={6}
            placeholder="Describe the customer communication, delivery proof, terms of service, or other evidence..."
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm opacity-70">
            Attachments (optional):
          </label>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(e.target.files)}
            className="w-full px-3 py-2 border rounded"
          />
          {files && files.length > 0 && (
            <div className="text-xs opacity-70">
              {files.length} file(s) selected
            </div>
          )}
        </div>

        <button
          onClick={submit}
          disabled={busy || (!text && !files)}
          className="rounded-md bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Submitting…" : "Submit Evidence"}
        </button>
      </div>
    </div>
  );
}
