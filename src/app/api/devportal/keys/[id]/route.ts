import { callCallable } from "@/lib/functionsClient";

export const dynamic = 'force-dynamic';

export async function DELETE(_: Request, { params }: { params: { id: string }}) {
  try {
    const res = await callCallable("revokeApiKey", { data: { keyId: params.id } });
    return Response.json(res ?? { ok: true }, { status: 200 });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
