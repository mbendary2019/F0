import { callCallable } from "@/lib/functionsClient";

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const out = await callCallable<{ url: string }>("createBillingPortalLink", {
      data: { return_url: process.env.PORTAL_RETURN_URL }
    });
    return Response.json({ url: out.url }, { status: 200 });
  } catch (err: any) {
    console.error("Billing portal error:", err);
    // Fallback to demo URL if function not available
    return Response.json({ url: "https://billing.stripe.com/session/demo" }, { status: 200 });
  }
}
