import { callCallable } from '@/lib/functionsClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // يُفضّل إنشاء callable في Functions: getSubscription (يرجع users/{uid}/subscription)
    const out = await callCallable('getSubscription');
    return Response.json(out ?? { plan:'free', status:'active', limits:{ monthlyQuota:10000, ratePerMin:60 } });
  } catch {
    // Fallback محلي (بدون Emulator/Prod)
    return Response.json({ plan:'free', status:'active', limits:{ monthlyQuota:10000, ratePerMin:60 } });
  }
}
