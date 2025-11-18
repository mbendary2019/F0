"use client";

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

type Summary = {
  testsCount: number;
  lastRun: { id:string; passRate:number; total:number; finishedAt:number }|null;
  recent: Array<{ id:string; passRate:number; total:number; finishedAt:number }>;
};

export default function RedTeamPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tests, setTests] = useState<any[]>([]);
  const [form, setForm] = useState({ prompt:"", expected:"", category:"general", severity:"low", active:true });
  const [busy, setBusy] = useState(false);

  const authToken = async () => await getAuth().currentUser?.getIdToken();

  const fetchSummary = async () => {
    const token = await authToken();
    const r = await fetch("/api/admin/redteam/summary", { headers:{ Authorization:`Bearer ${token}` }, cache:"no-store" });
    setSummary(await r.json());
  };
  const fetchTests = async () => {
    const token = await authToken();
    const r = await fetch("/api/admin/redteam/tests?active=true", { headers:{ Authorization:`Bearer ${token}` }, cache:"no-store" });
    const j = await r.json();
    setTests(j.items || []);
  };

  useEffect(()=>{ fetchSummary(); fetchTests(); }, []);

  const runNow = async () => {
    setBusy(true);
    try {
      const fn = httpsCallable(getFunctions(), "redteamRun");
      await fn({});
      await fetchSummary();
    } finally { setBusy(false); }
  };

  const saveTest = async () => {
    if (!form.prompt.trim()) return;
    const token = await authToken();
    await fetch("/api/admin/redteam/tests", {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      body: JSON.stringify(form)
    });
    setForm({ prompt:"", expected:"", category:"general", severity:"low", active:true });
    await fetchTests(); await fetchSummary();
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Red-Teaming</h1>
        <button onClick={runNow} disabled={busy}
          className="rounded-md border px-4 py-2 hover:bg-gray-50">
          {busy ? "Running…" : "Run Red-Team Now"}
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <KPI title="Active Tests" value={summary.testsCount} />
          <KPI title="Last Run Pass-Rate" value={summary.lastRun ? `${summary.lastRun.passRate.toFixed(1)}%` : "—"} />
          <KPI title="Last Run Total" value={summary.lastRun ? summary.lastRun.total : 0} />
        </div>
      )}

      <section className="rounded-xl border p-4">
        <h2 className="mb-2 font-medium">Recent Runs</h2>
        {!summary?.recent?.length && <div className="text-sm opacity-70">No runs yet.</div>}
        {!!summary?.recent?.length && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr><th className="px-3 py-2 text-left">Finished</th><th className="px-3 py-2 text-left">Pass-Rate</th><th className="px-3 py-2 text-left">Total</th><th className="px-3 py-2 text-left">Run ID</th></tr>
            </thead>
            <tbody>
              {summary.recent.map(r=>(
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{new Date(r.finishedAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.passRate.toFixed(1)}%</td>
                  <td className="px-3 py-2">{r.total}</td>
                  <td className="px-3 py-2">{r.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="mb-3 font-medium">Add Test</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs opacity-70 mb-1">Prompt</div>
            <textarea value={form.prompt} onChange={e=>setForm({...form, prompt:e.target.value})}
              className="h-24 w-full rounded-md border p-2" placeholder="Adversarial prompt here…" />
          </div>
          <div>
            <div className="text-xs opacity-70 mb-1">Expected (optional: literal or /regex/i)</div>
            <input value={form.expected} onChange={e=>setForm({...form, expected:e.target.value})}
              className="w-full rounded-md border p-2" placeholder="e.g. /cannot assist/i or 'I can't assist'" />
          </div>
        </div>
        <div className="mt-3 flex gap-3">
          <select className="rounded-md border px-3 py-2" value={form.category} onChange={e=>setForm({...form, category:e.target.value})}>
            <option value="general">general</option>
            <option value="toxicity">toxicity</option>
            <option value="pii">pii</option>
            <option value="policy">policy</option>
          </select>
          <select className="rounded-md border px-3 py-2" value={form.severity} onChange={e=>setForm({...form, severity:e.target.value as any})}>
            <option value="low">low</option>
            <option value="med">med</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.active} onChange={e=>setForm({...form, active:e.target.checked})} />
            <span>Active</span>
          </label>
          <button onClick={saveTest} className="ml-auto rounded-md bg-black px-4 py-2 text-white hover:opacity-90">Save Test</button>
        </div>

        <div className="mt-6">
          <h3 className="mb-2 font-medium">Active Tests</h3>
          {!tests.length && <div className="text-sm opacity-70">No tests.</div>}
          {!!tests.length && (
            <ul className="space-y-2">
              {tests.map(t=>(
                <li key={t.id} className="rounded-md border p-3">
                  <div className="text-xs opacity-70">{t.category} • {t.severity}</div>
                  <div className="mt-1 text-sm whitespace-pre-wrap">{t.prompt}</div>
                  {t.expected && <div className="mt-1 text-xs opacity-70">Expected: {t.expected}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function KPI({ title, value }: { title: string; value: string|number }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs opacity-70">{title}</div>
      <div className="text-3xl font-semibold">{value}</div>
    </div>
  );
}
