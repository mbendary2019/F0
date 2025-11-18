"use client";
import { useState } from "react";

export default function F0QuickActions({ orchUrl }: { orchUrl: string }) {
  const [ping, setPing] = useState<string>("");

  const test = async () => {
    setPing("جارٍ الاختبار…");
    const t0 = performance.now();
    try {
      const res = await fetch(`${orchUrl}/health`, { cache: "no-store" });
      const ok = res.ok;
      const t1 = performance.now();
      setPing(ok ? `OK (${Math.round(t1 - t0)}ms)` : `HTTP ${res.status}`);
    } catch (e: any) {
      setPing(`فشل: ${e?.message || "Unknown"}`);
    }
  };

  return (
    <div className="mt-4 flex items-center gap-3">
      <button onClick={test} className="rounded-lg border px-4 py-2 hover:shadow">
        اختبار اتصال
      </button>
      {ping && <span className="text-sm text-muted-foreground">{ping}</span>}
    </div>
  );
}
