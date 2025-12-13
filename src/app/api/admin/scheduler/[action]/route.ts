import { headers } from "next/headers";
import { callCallable } from "@/lib/functionsClient";

export const dynamic = 'force-dynamic';

export async function POST(_: Request, { params }: { params: { action: string }}) {
  const map: Record<string, string> = {
    "rollup": "debugRollup",
    "push-usage": "debugPushUsage",
    "quota-warn": "debugQuotaWarn",
    "close-period": "debugClosePeriod",
    "status": "debugStatus",
  };
  const fn = map[params.action];
  if (!fn) return Response.json({ error: "unknown_action" }, { status: 400 });

  const authz = headers().get("authorization") || "";
  const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : undefined;
  if (!idToken) return Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  const out = await callCallable(fn, { idToken, data: {} });
  return Response.json(out ?? {}, { status: 200 });
}
