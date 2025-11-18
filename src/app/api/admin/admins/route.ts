export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { listAdmins } from '@/lib/userProfile';

export async function GET() {
  await assertAdminReq();
  const admins = await listAdmins(); // [{uid, email, roles:[...]}]
  return new Response(JSON.stringify({ admins }), { status: 200 });
}

