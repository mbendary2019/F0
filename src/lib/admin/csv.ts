/**
 * CSV Export Helper
 * Convert audit logs to CSV format
 */

type AuditRecord = {
  id: string;
  ts: number;
  action: string;
  actorUid: string;
  targetUid?: string;
  ip?: string;
  ua?: string;
  meta?: Record<string, unknown>;
};

/**
 * Convert audit records to CSV string
 */
export function toCSV(rows: AuditRecord[]): string {
  if (!rows.length) {
    return 'id,timestamp,action,actorUid,targetUid,ip,userAgent,metadata\n';
  }

  const headers = ['id', 'timestamp', 'action', 'actorUid', 'targetUid', 'ip', 'userAgent', 'metadata'];

  // Escape CSV value
  const escape = (value: any): string => {
    if (value == null || value === undefined) return '';
    
    const str = String(value);
    
    // If contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    
    return str;
  };

  // Build CSV lines
  const lines = [headers.join(',')];

  for (const record of rows) {
    const row = [
      escape(record.id),
      escape(new Date(record.ts).toISOString()),
      escape(record.action),
      escape(record.actorUid),
      escape(record.targetUid),
      escape(record.ip),
      escape(record.ua),
      escape(record.meta ? JSON.stringify(record.meta) : ''),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

/**
 * Convert any array of objects to CSV
 * Generic version for other exports
 */
export function toCSVGeneric(rows: any[], headers?: string[]): string {
  if (!rows.length) {
    return headers ? headers.join(',') + '\n' : '';
  }

  // Auto-detect headers if not provided
  const csvHeaders = headers || Object.keys(rows[0]);

  const escape = (value: any): string => {
    if (value == null || value === undefined) return '';
    
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    
    return str;
  };

  const lines = [csvHeaders.join(',')];

  for (const record of rows) {
    const row = csvHeaders.map((header) => escape(record[header]));
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

