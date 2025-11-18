"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function AdminCouponsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({
    code: "",
    percentOff: 20,
    amountOff: "",
    currency: "",
    duration: "once",
    durationInMonths: "",
    maxRedemptions: "",
    redeemBy: "",
    stripeCouponId: "",
  });

  const token = async () => await getAuth().currentUser?.getIdToken();

  const load = async () => {
    const t = await token();
    const r = await fetch("/api/admin/coupons", {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const j = await r.json();
    setItems(j.items || []);
  };

  useEffect(() => {
    load();
  }, []);

  const createStripe = async () => {
    setBusy(true);
    try {
      const f = getFunctions();
      const payload: any = {
        code: form.code?.trim() || undefined,
        percentOff: form.percentOff ? Number(form.percentOff) : undefined,
        amountOff: form.amountOff ? Number(form.amountOff) : undefined,
        currency: form.amountOff ? form.currency || "usd" : undefined,
        duration: form.duration || "once",
        durationInMonths:
          form.duration === "repeating" ? Number(form.durationInMonths || 1) : undefined,
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : undefined,
        redeemBy: form.redeemBy ? new Date(form.redeemBy).getTime() : undefined,
      };
      await httpsCallable(f, "createStripeCoupon")(payload);
      await load();
      setForm({ ...form, code: "" });
    } finally {
      setBusy(false);
    }
  };

  const upsertMapping = async () => {
    setBusy(true);
    try {
      const f = getFunctions();
      await httpsCallable(f, "upsertCouponCode")({
        code: form.code,
        stripeCouponId: form.stripeCouponId,
        active: true,
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (code: string) => {
    const t = await token();
    await fetch(`/api/admin/coupons/${code}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${t}` },
    });
    await load();
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Admin — Coupons</h1>

      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="font-medium">Create Stripe coupon & (optional) promo code</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            placeholder="CODE (optional)"
            className="rounded-md border p-2"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          />
          <select
            className="rounded-md border p-2"
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: e.target.value })}
          >
            <option value="once">once</option>
            <option value="forever">forever</option>
            <option value="repeating">repeating</option>
          </select>
          <input
            placeholder="percentOff (e.g., 25)"
            type="number"
            className="rounded-md border p-2"
            value={form.percentOff}
            onChange={(e) => setForm({ ...form, percentOff: e.target.value })}
          />
          <input
            placeholder="amountOff (e.g., 10)"
            type="number"
            className="rounded-md border p-2"
            value={form.amountOff}
            onChange={(e) => setForm({ ...form, amountOff: e.target.value })}
          />
          <input
            placeholder="currency (usd)"
            className="rounded-md border p-2"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          />
          <input
            placeholder="durationInMonths"
            type="number"
            className="rounded-md border p-2"
            value={form.durationInMonths}
            onChange={(e) => setForm({ ...form, durationInMonths: e.target.value })}
          />
          <input
            placeholder="maxRedemptions"
            type="number"
            className="rounded-md border p-2"
            value={form.maxRedemptions}
            onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
          />
          <input
            placeholder="redeemBy (YYYY-MM-DD)"
            type="date"
            className="rounded-md border p-2"
            value={form.redeemBy}
            onChange={(e) => setForm({ ...form, redeemBy: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={createStripe}
            disabled={busy}
            className="rounded-md bg-black px-4 py-2 text-white hover:opacity-90"
          >
            {busy ? "Working…" : "Create in Stripe"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="font-medium">Or: Upsert existing Stripe coupon mapping</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            placeholder="CODE"
            className="rounded-md border p-2"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          />
          <input
            placeholder="Stripe Coupon ID"
            className="rounded-md border p-2"
            value={form.stripeCouponId}
            onChange={(e) => setForm({ ...form, stripeCouponId: e.target.value })}
          />
        </div>
        <button
          onClick={upsertMapping}
          disabled={busy}
          className="rounded-md border px-4 py-2 hover:bg-gray-50"
        >
          Upsert Mapping Only
        </button>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-medium mb-2">All Coupons</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Percent</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Stripe</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c: any) => (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2">{c.code}</td>
                  <td className="px-3 py-2 text-center">{String(c.active)}</td>
                  <td className="px-3 py-2 text-center">{c.percentOff ?? "-"}</td>
                  <td className="px-3 py-2 text-center">
                    {c.amountOff ? `$${c.amountOff}` : "-"}
                  </td>
                  <td className="px-3 py-2 text-center">{c.duration || "-"}</td>
                  <td className="px-3 py-2 text-xs">{c.stripeCouponId || "-"}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => remove(c.id)}
                      className="rounded-md border px-3 py-1 hover:bg-gray-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center opacity-70">
                    No coupons.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
