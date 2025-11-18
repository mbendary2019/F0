/**
 * Phase 49: PII Redaction Utilities
 * Sanitize logs and error messages to remove sensitive data
 */

/**
 * Redact PII from any input (string or object)
 */
export function redactPII(input: any): string {
  const s = typeof input === 'string' ? input : JSON.stringify(input);

  return s
    // Email addresses
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[redacted_email]')

    // API keys, tokens, secrets in JSON
    .replace(/(authorization|api[-_ ]?key|token|secret|password)"?\s*:\s*"[^"]+"/gi, '$1:"[redacted]"')

    // Bearer tokens
    .replace(/Bearer\s+[\w-]+\.[\w-]+\.[\w-]+/gi, 'Bearer [redacted_jwt]')

    // Credit card numbers (simple pattern)
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[redacted_cc]')

    // Phone numbers (international format)
    .replace(/\+?\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g, '[redacted_phone]')

    // IP addresses
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[redacted_ip]')

    // JWTs (full pattern)
    .replace(/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g, '[redacted_jwt]');
}

/**
 * Redact sensitive fields from objects
 */
export function redactObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const sensitiveKeys = [
    'password', 'token', 'secret', 'apiKey', 'api_key',
    'authorization', 'auth', 'creditCard', 'ssn', 'privateKey'
  ];

  const result: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      result[key] = '[redacted]';
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      result[key] = redactObject(obj[key]);
    } else if (typeof obj[key] === 'string') {
      result[key] = redactPII(obj[key]);
    } else {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * Sanitize error message
 */
export function sanitizeMessage(message: string): string {
  return redactPII(message);
}

/**
 * Sanitize stack trace
 */
export function sanitizeStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  return redactPII(stack);
}
