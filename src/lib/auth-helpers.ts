export function verifySessionCookie(_req?: any) { return { uid: 'dev-user', claims: { admin: true, sub_tier: 'pro', sub_active: true } }; }
export function getCurrentUser() { return null; }
export function ensureAuthenticated(){ return { uid: 'dev-user' }; }
export function requireAdmin(){ return { uid: 'dev-admin', role:'admin' }; }
