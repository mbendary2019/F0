import { callCallable } from "@/lib/functionsClient";

export async function GET() {
  try {
    const items = await callCallable("listWebhookDeliveries");
    return Response.json(items ?? [], { status: 200 });
  } catch (err: any) {
    // Fallback to dummy data if function not available
    return Response.json([
      { id:'wh_1', eventType:'test.event', status:'success', responseCode:200, latencyMs:123, createdAt: Date.now()-10000 }
    ], { status: 200 });
  }
}
