import { callCallable } from "@/lib/functionsClient";

export const dynamic = 'force-dynamic';

// listApiKeys, createApiKey: موجودين في functions/src/apiKeys.ts كـ onCall
export async function GET() {
  try {
    const out = await callCallable("listApiKeys");
    return Response.json(out ?? [], { status: 200 });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const res = await callCallable("createApiKey", { data: { ...body } });
    // res يحتوي apiKey (one-time) و doc
    return Response.json(res, { status: 201 });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
