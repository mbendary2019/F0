import { NextRequest } from 'next/server';
import { z } from 'zod';
import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { removeRole } from '@/lib/userProfile';
import { auditAdmin } from '@/lib/admin/audit';

export const dynamic = 'force-dynamic';

const Body = z.object({ role: z.string().min(2) }).strict();

export async function POST(
  req: NextRequest,
  { params }: { params: { uid: string } }
) {
  const { uid: actor } = await assertAdminReq();
  const { role } = Body.parse(await req.json());
  await removeRole(params.uid, role);
  await auditAdmin('revoke', actor, params.uid, { role }, req);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

