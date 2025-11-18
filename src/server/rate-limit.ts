export async function rateLimit(_key:string, _limit=100){ return { success:true }; }
export async function withRateLimit<T>(_k:string, fn:()=>Promise<T>){ return fn(); }
export async function rateLimitGuard(_req?: any, _options?: any){ return { ok: true, error: undefined, status: 200 }; }
