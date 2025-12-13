import { callCallable } from '@/lib/functionsClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // callable مقترح: getUsageMonth → يرجع { used, quota, overageEnabled }
    const out = await callCallable('getUsageMonth');
    return Response.json(out ?? { used:0, quota:10000, overageEnabled:false });
  } catch {
    // Fallback محلي
    return Response.json({ used: 0, quota: 10000, overageEnabled: false });
  }
}
