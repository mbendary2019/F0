"use client";

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

type Policy = {
  id?: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: any;
  actions: any;
};

export default function PoliciesPage() {
  const [items, setItems] = useState<Policy[]>([]);
  const [form, setForm] = useState<Policy>({
    name: "",
    enabled: true,
    priority: 100,
    conditions: {
      piiLeak: true,
      minToxicity: 50
    },
    actions: {
      escalateSeverity: "high",
      addLabels: ["policy"],
      setSlaHours: 12
    }
  });
  const [ctx, setCtx] = useState({ toxicity: 70, bias: 10, piiLeak: true, model: "gpt-4o", labels: ["toxicity"], uid: "u1" });
  const [validation, setValidation] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const token = async () => await getAuth().currentUser?.getIdToken();

  const load = async () => {
    const t = await token();
    const res = await fetch("/api/admin/policies", { headers:{ Authorization:`Bearer ${t}` }, cache:"no-store" });
    const j = await res.json();
    setItems(j.items || []);
  };

  useEffect(()=>{ load(); }, []);

  const save = async () => {
    setBusy(true);
    const t = await token();
    await fetch("/api/admin/policies", {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${t}` },
      body: JSON.stringify(form)
    });
    setBusy(false);
    setForm(prev => ({ ...prev, name: "" })); // reset name
    await load();
  };

  const del = async (id: string) => {
    const t = await token();
    await fetch(`/api/admin/policies/${id}`, { method:"DELETE", headers:{ Authorization:`Bearer ${t}` } });
    await load();
  };

  const validate = async () => {
    const fn = httpsCallable(getFunctions(), "policyValidate");
    const r: any = await fn({ policy: form, ctx });
    setValidation(r?.data);
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      <h1 className="text-2xl font-semibold">AI Policies</h1>

      <section className="rounded-xl border p-4 space-y-4">
        <h2 className="font-medium">Create / Update Policy</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs opacity-70">Name</label>
            <input className="w-full rounded-md border p-2" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs opacity-70">Enabled</label>
            <input type="checkbox" checked={form.enabled} onChange={e=>setForm({...form, enabled:e.target.checked})} />
            <label className="text-xs opacity-70 ml-4">Priority</label>
            <input type="number" className="w-28 rounded-md border p-2" value={form.priority} onChange={e=>setForm({...form, priority:Number(e.target.value)})}/>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs opacity-70 mb-1">Conditions (JSON)</div>
            <textarea className="h-40 w-full rounded-md border p-2 text-sm"
              value={JSON.stringify(form.conditions, null, 2)}
              onChange={e=>{ try { setForm({...form, conditions: JSON.parse(e.target.value)});} catch {} }} />
          </div>
          <div>
            <div className="text-xs opacity-70 mb-1">Actions (JSON)</div>
            <textarea className="h-40 w-full rounded-md border p-2 text-sm"
              value={JSON.stringify(form.actions, null, 2)}
              onChange={e=>{ try { setForm({...form, actions: JSON.parse(e.target.value)});} catch {} }} />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={save} disabled={busy} className="rounded-md bg-black px-4 py-2 text-white hover:opacity-90">{busy ? "Saving…" : "Save Policy"}</button>
          <button onClick={validate} className="rounded-md border px-4 py-2 hover:bg-gray-50">Validate (with sample ctx)</button>
        </div>

        {validation && (
          <div className="rounded-md border p-3 text-sm mt-3">
            <div className="text-xs opacity-70 mb-1">Applied:</div>
            <pre className="whitespace-pre-wrap">{JSON.stringify(validation, null, 2)}</pre>
          </div>
        )}
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-medium mb-2">Existing Policies</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2">Enabled</th><th className="px-3 py-2">Priority</th><th className="px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {items.map(p=>(
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2 text-center">{p.enabled ? "Yes" : "No"}</td>
                <td className="px-3 py-2 text-center">{p.priority}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={()=>del(p.id!)} className="rounded-md border px-3 py-1 hover:bg-gray-50">Delete</button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan={4} className="px-3 py-6 text-center opacity-70">No policies yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border p-4 space-y-2">
        <h2 className="font-medium">Sample Context (for Validate)</h2>
        <div className="grid grid-cols-3 gap-4">
          <label className="text-sm">toxicity
            <input type="number" className="mt-1 w-full rounded-md border p-2" value={ctx.toxicity}
                   onChange={e=>setCtx({...ctx, toxicity:Number(e.target.value)})}/>
          </label>
          <label className="text-sm">bias
            <input type="number" className="mt-1 w-full rounded-md border p-2" value={ctx.bias}
                   onChange={e=>setCtx({...ctx, bias:Number(e.target.value)})}/>
          </label>
          <label className="text-sm">piiLeak
            <select className="mt-1 w-full rounded-md border p-2"
                    value={String(ctx.piiLeak)} onChange={e=>setCtx({...ctx, piiLeak: e.target.value==="true"})}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">model
            <input className="mt-1 w-full rounded-md border p-2" value={ctx.model}
                   onChange={e=>setCtx({...ctx, model: e.target.value})}/>
          </label>
          <label className="text-sm">labels (comma)
            <input className="mt-1 w-full rounded-md border p-2" value={ctx.labels.join(",")}
                   onChange={e=>setCtx({...ctx, labels: e.target.value.split(",").map(s=>s.trim()).filter(Boolean)})}/>
          </label>
        </div>
      </section>
    </div>
  );
}
