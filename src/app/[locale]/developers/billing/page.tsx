'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Sub = {
  plan: 'free'|'pro'|'enterprise';
  status: string;
  periodEnd?: string | number;
  limits?: { monthlyQuota?: number; ratePerMin?: number; overage?: { enabled?: boolean; pricePer1k?: number } };
};

export default function BillingPage(){
  const [sub, setSub]   = useState<Sub | null>(null);
  const [used, setUsed] = useState<number>(0);
  const [quota, setQuota] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{ (async()=>{
    try {
      const s = await fetch('/api/devportal/subscription').then(r=>r.json());
      const u = await fetch('/api/devportal/usage-month').then(r=>r.json());
      setSub(s);
      setUsed(u.used || 0);
      setQuota(u.quota || (s?.limits?.monthlyQuota ?? 10000));
    } finally { setLoading(false); }
  })(); },[]);

  async function openPortal(){
    const r = await fetch('/api/billing/portal', { method:'POST' });
    const { url } = await r.json();
    window.location.href = url;
  }

  const pct = quota ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const warn = pct >= 80;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader><CardTitle>Plan & Billing</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? 'Loading…' : (
            <>
              <div>Plan: <b>{sub?.plan || 'free'}</b> • Status: <b>{sub?.status || 'active'}</b></div>
              <div>Period ends: {sub?.periodEnd ? new Date(sub.periodEnd).toLocaleString() : '—'}</div>
              <div>Limits: {sub?.limits?.monthlyQuota ?? 10000} req/mo • {sub?.limits?.ratePerMin ?? 60} req/min</div>
              {sub?.limits?.overage?.enabled
                ? <div>Overage: enabled • {sub.limits.overage.pricePer1k ?? 0}$/1k</div>
                : <div>Overage: disabled (hard cap)</div>}
              <Button onClick={openPortal} className="mt-2">Open Billing Portal</Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Monthly Usage</CardTitle></CardHeader>
        <CardContent>
          {loading ? 'Loading…' : (
            <div>
              <div className="mb-2">{used} / {quota} ({pct}%)</div>
              <div className="w-full h-3 bg-muted rounded">
                <div
                  className={`h-3 rounded ${warn ? 'bg-red-500' : 'bg-primary'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {warn && <div className="text-sm mt-2">Heads-up: you've reached {pct}% of your monthly quota.</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
