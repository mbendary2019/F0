"use client";
import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function TaxReports() {
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const fn = httpsCallable(getFunctions(), "exportTaxReport");
      const s = start ? Date.parse(start) : 0;
      const e = end ? Date.parse(end) : 0;
      const res: any = await fn({ start: s, end: e });
      const url = res?.data?.url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        alert("No URL returned");
      }
    } catch (err: any) {
      alert(err.message || "Failed to generate report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Tax Reports</h1>
      <p className="text-sm opacity-70">
        Generate a CSV report of all taxes collected in a date range, with jurisdiction breakdown.
      </p>
      <div className="grid grid-cols-1 gap-3">
        <label className="text-sm">
          Start date
          <input
            type="date"
            className="w-full rounded-md border p-2 mt-1"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="text-sm">
          End date
          <input
            type="date"
            className="w-full rounded-md border p-2 mt-1"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      <button
        onClick={run}
        disabled={busy || !start || !end}
        className="rounded-md bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Generating…" : "Generate CSV"}
      </button>
    </div>
  );
}
