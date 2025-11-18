'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type S = {
  rollup?: { ok: boolean; at: any; tookMs?: number; counters?: any };
  pushUsage?: { ok: boolean; at: any; tookMs?: number; pushed?: number };
  quotaWarn?: { ok: boolean; at: any; tookMs?: number; warned?: number };
  closePeriod?: { ok: boolean; at: any; tookMs?: number; closed?: number };
};

export default function AdminOpsPage(){
  const [status, setStatus] = useState<S>({});
  const [loading, setLoading] = useState(false);

  async function run(action: 'rollup'|'push-usage'|'quota-warn'|'close-period'|'status'){
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/scheduler/${action}`, { method:'POST' });
      const json = await res.json();
      if (action === 'status') setStatus(json);
      else await refresh();
    } finally { setLoading(false); }
  }

  async function refresh(){ await run('status'); }
  useEffect(()=>{ refresh(); },[]);

  function ts(x?: any){ return x ? new Date(x._seconds ? x._seconds*1000 : x).toLocaleString() : '—'; }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader><CardTitle>Admin Ops — Schedulers</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={()=>run('rollup')} disabled={loading}>Run Rollup (Daily→Monthly)</Button>
          <Button onClick={()=>run('push-usage')} disabled={loading}>Push Usage to Stripe</Button>
          <Button onClick={()=>run('quota-warn')} disabled={loading}>Send Quota Warnings</Button>
          <Button variant="destructive" onClick={()=>run('close-period')} disabled={loading}>Close Period</Button>
          <Button variant="secondary" onClick={()=>run('status')} disabled={loading}>Refresh Status</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Last Runs</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>Rollup:       <b>{ts(status.rollup?.at)}</b>   {status.rollup?.tookMs ? `• ${status.rollup.tookMs} ms` : ''}</div>
          <div>Push Usage:   <b>{ts(status.pushUsage?.at)}</b> {status.pushUsage?.pushed ? `• +${status.pushUsage.pushed}` : ''}</div>
          <div>Quota Warn:   <b>{ts(status.quotaWarn?.at)}</b> {status.quotaWarn?.warned ? `• ${status.quotaWarn.warned} users` : ''}</div>
          <div>Close Period: <b>{ts(status.closePeriod?.at)}</b> {status.closePeriod?.closed ? `• ${status.closePeriod.closed} users` : ''}</div>
        </CardContent>
      </Card>
    </div>
  );
}
