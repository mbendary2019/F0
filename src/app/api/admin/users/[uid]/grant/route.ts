import { NextRequest } from 'next/server';
import { z } from 'zod';
import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { addRole } from '@/lib/userProfile';
import { auditAdmin } from '@/lib/admin/audit';

const Body = z.object({ role: z.string().min(2) }).strict();

export async function POST(
  req: NextRequest,
  { params }: { params: { uid: string } }
) {
  const { uid: actor } = await assertAdminReq();
  const { role } = Body.parse(await req.json());
  await addRole(params.uid, role);
  await auditAdmin('grant', actor, params.uid, { role }, req);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

