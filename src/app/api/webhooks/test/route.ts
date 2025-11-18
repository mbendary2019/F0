import { callCallable } from "@/lib/functionsClient";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const out = await callCallable("sendTestWebhook", { data: body });
    return Response.json(out, { status: 200 });
  } catch (err: any) {
    // Fallback to simple echo if function not available
    const body = await req.json().catch(() => ({}));
    return Response.json({
      ok: true,
      test: true,
      received: body,
      deliveredAt: new Date().toISOString(),
    }, { status: 200 });
  }
}
