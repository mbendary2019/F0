export async function rateLimit(_key:string, _limit=100){ return { success:true }; }
export async function rateLimitGuard(){ return true; }
export function limitOrNull(_key:string){ return null; } // مستخدم في workspaces/create
