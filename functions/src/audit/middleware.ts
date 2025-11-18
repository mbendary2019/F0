// F0 Phase 36 - Audit Middleware for HTTP Functions

import { writeAudit } from './writer';
import { Request, Response } from 'firebase-functions';
import { AuditEvent } from './types';

/**
 * Wrap HTTP function with audit logging
 * 
 * Automatically logs:
 * - Request path, method, headers
 * - Response status, latency
 * - Actor (from auth token if available)
 * - Success/failure status
 */
export function withAudit(
  handler: (req: Request, res: Response) => Promise<any>,
  action: string
) {
  return async (req: Request, res: Response) => {
    const start = Date.now();
    let ok = true;
    let code: string | undefined;
    let errorMessage: string | undefined;

    // Extract actor info
    const user = (req as any).user;
    const uid = user?.uid || 'anon';
    const email = user?.email;
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
    const deviceId = req.headers['x-device-id'] as string | undefined;
    const userAgent = req.headers['user-agent'];

    try {
      // Execute handler
      const result = await handler(req, res);
      return result;
    } catch (e: any) {
      ok = false;
      code = e?.code || 'ERR';
      errorMessage = e?.message || String(e);
      throw e;
    } finally {
      const latencyMs = Date.now() - start;

      // Write audit log
      await writeAudit({
        action,
        actor: {
          uid,
          email,
          ip,
          deviceId,
          userAgent,
        },
        payload: {
          path: req.path,
          method: req.method,
          query: req.query,
          // Don't log full body (may contain sensitive data)
          bodyKeys: req.body ? Object.keys(req.body) : [],
        },
        ok,
        code,
        latencyMs,
        errorMessage,
      }).catch(err => {
        // Don't let audit logging break the main request
        console.error('Failed to write audit log:', err);
      });
    }
  };
}

/**
 * Wrap callable function with audit logging
 */
export function withCallableAudit<T = any>(
  handler: (data: T, context: any) => Promise<any>,
  action: string
) {
  return async (data: T, context: any) => {
    const start = Date.now();
    let ok = true;
    let code: string | undefined;
    let errorMessage: string | undefined;

    const uid = context.auth?.uid || 'anon';
    const email = context.auth?.token?.email;
    const ip = context.rawRequest?.headers?.['x-forwarded-for'] || 'unknown';

    try {
      const result = await handler(data, context);
      return result;
    } catch (e: any) {
      ok = false;
      code = e?.code || 'ERR';
      errorMessage = e?.message || String(e);
      throw e;
    } finally {
      const latencyMs = Date.now() - start;

      await writeAudit({
        action,
        actor: { uid, email, ip: String(ip).split(',')[0].trim() },
        payload: { dataKeys: data ? Object.keys(data as any) : [] },
        ok,
        code,
        latencyMs,
        errorMessage,
      }).catch(err => {
        console.error('Failed to write audit log:', err);
      });
    }
  };
}

/**
 * Create audit event for administrative actions
 */
export async function auditAdminAction(
  action: string,
  actor: { uid: string; email?: string; ip?: string },
  target?: { type: string; id: string; name?: string },
  metadata?: Record<string, any>
): Promise<void> {
  await writeAudit({
    action,
    actor,
    target,
    ok: true,
    metadata,
  });
}


