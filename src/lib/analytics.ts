/**
 * Phase 48 - Analytics & Audit Client SDK
 * Client-side functions for recording events and viewing analytics
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

// ============================================================
// Types
// ============================================================

export interface RecordEventPayload {
  type: 'api' | 'tokens' | 'auth' | 'billing' | 'org';
  key: string;
  n?: number;
  orgId?: string;
  meta?: Record<string, any>;
}

export interface LogAuditPayload {
  action: string;
  orgId?: string;
  object?: string;
  diff?: any;
}

export interface GetAnalyticsPayload {
  days?: number;
  orgId?: string;
}

export interface ExportAuditCsvPayload {
  from?: string;
  to?: string;
  orgId?: string;
  limit?: number;
}

export interface DailyMetrics {
  date: string;
  dau: number;
  tokens: number;
  requests: number;
  seatsUsed: number;
  orgsActive: number;
}

export interface KPIs {
  dau: number;
  tokens: number;
  requests: number;
  seatsUsed: number;
  orgsActive: number;
}

export interface AnalyticsResponse {
  kpis: KPIs;
  series: DailyMetrics[];
  period: {
    start: string | null;
    end: string | null;
    days: number;
  };
}

export interface AuditCsvResponse {
  csv: string;
  count: number;
  exportedAt: string;
}

// ============================================================
// Functions
// ============================================================

/**
 * Record an analytics event
 * @example
 * ```ts
 * await recordEvent({
 *   type: 'api',
 *   key: 'chat.request',
 *   n: 1,
 *   orgId: 'org-123'
 * });
 * ```
 */
export async function recordEvent(payload: RecordEventPayload): Promise<{ success: boolean }> {
  const fn = httpsCallable<RecordEventPayload, { success: boolean }>(
    functions,
    'recordEvent'
  );
  const result = await fn(payload);
  return result.data;
}

/**
 * Log an audit trail entry
 * @example
 * ```ts
 * await logAudit({
 *   action: 'role.update',
 *   orgId: 'org-123',
 *   object: 'user-456',
 *   diff: { from: 'member', to: 'admin' }
 * });
 * ```
 */
export async function logAudit(payload: LogAuditPayload): Promise<{ success: boolean }> {
  const fn = httpsCallable<LogAuditPayload, { success: boolean }>(functions, 'logAudit');
  const result = await fn(payload);
  return result.data;
}

/**
 * Get analytics data (KPIs + time series)
 * @example
 * ```ts
 * const { kpis, series } = await getAnalytics({ days: 30 });
 * ```
 */
export async function getAnalytics(
  payload?: GetAnalyticsPayload
): Promise<AnalyticsResponse> {
  const fn = httpsCallable<GetAnalyticsPayload, AnalyticsResponse>(
    functions,
    'getAnalytics'
  );
  const result = await fn(payload || {});
  return result.data;
}

/**
 * Export audit trail as CSV
 * @example
 * ```ts
 * const { csv } = await exportAuditCsv({ orgId: 'org-123' });
 * const blob = new Blob([csv], { type: 'text/csv' });
 * // Download the CSV
 * ```
 */
export async function exportAuditCsv(
  payload?: ExportAuditCsvPayload
): Promise<AuditCsvResponse> {
  const fn = httpsCallable<ExportAuditCsvPayload, AuditCsvResponse>(
    functions,
    'exportAuditCsv'
  );
  const result = await fn(payload || {});
  return result.data;
}

// ============================================================
// Helper Functions for Instrumentation
// ============================================================

/**
 * Record API request
 */
export async function recordApiRequest(orgId?: string, meta?: Record<string, any>) {
  return recordEvent({
    type: 'api',
    key: 'api.request',
    n: 1,
    orgId,
    meta,
  });
}

/**
 * Record token consumption
 */
export async function recordTokens(tokens: number, orgId?: string, meta?: Record<string, any>) {
  return recordEvent({
    type: 'tokens',
    key: 'tokens.consume',
    n: tokens,
    orgId,
    meta,
  });
}

/**
 * Record authentication event
 */
export async function recordAuth(key: string, meta?: Record<string, any>) {
  return recordEvent({
    type: 'auth',
    key: `auth.${key}`,
    meta,
  });
}

/**
 * Record billing event
 */
export async function recordBilling(key: string, orgId?: string, meta?: Record<string, any>) {
  return recordEvent({
    type: 'billing',
    key: `billing.${key}`,
    orgId,
    meta,
  });
}

/**
 * Record organization event
 */
export async function recordOrgEvent(key: string, orgId: string, meta?: Record<string, any>) {
  return recordEvent({
    type: 'org',
    key: `org.${key}`,
    orgId,
    meta,
  });
}
