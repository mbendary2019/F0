import { callCallable } from '@/lib/functionsClient';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || "5");
  const events = Array.from({ length: limit }).map((_, i) => ({
    id: `ev_${i + 1}`,
    type: "demo",
    ts: Date.now() - i * 1000
  }));
  return Response.json(events, { status: 200 });
}

export async function POST(req: Request) {
  const body = await req.json().catch(()=> ({}));

  // 1) Gate check (جيب uid من جلستك/توكنك — هنا افتراض مؤقت)
  const uid = (body.uid as string) || 'demo'; // TODO: استخرجه من auth الفعلي
  const gate = await callCallable('gateCheck', { data: { uid } });

  if (!gate?.decision?.allow) {
    const code = gate?.decision?.reason === 'quota_exceeded' ? 429 : 403;
    return Response.json(
      { code: gate?.decision?.reason || 'blocked', message: 'Request blocked by plan gate' },
      { status: code }
    );
  }

  // 2) نفّذ لوجيك إنشاء الحدث الفعلي (هنا placeholder)
  const created = { id:'ev_demo', ok:true, type: body?.type || 'demo' };

  // 3) (اختياري) سجل الاستخدام — لو عندك callable trackUsage
  // await callCallable('trackUsage', { data: { uid, endpoint: 'POST_/api/v1/events', success: true, costCents: 0, durationMs: 12 } });

  return Response.json(created, { status: 201 });
}
