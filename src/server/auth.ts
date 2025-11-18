export function assertAuth(req?: any, options?: any){
  return { ok: true, uid: 'dev-user', error: undefined, status: 200, claims: { admin: true, sub_tier: 'pro', sub_active: true } }; // TODO: حقيقي لاحقًا
}
export async function getSession(){ return { user: null }; }
export function requireAuth(){ return null; }
