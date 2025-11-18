/**
 * PII Redaction Utilities
 * Redacts sensitive information from logs and error messages
 */

export function redactPII(input: any): string {
  if (!input) return '';

  const s = typeof input === 'string' ? input : JSON.stringify(input);

  return s
    // Email addresses
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[redacted_email]')

    // API keys, tokens, authorization headers
    .replace(/(authorization|api[-_ ]?key|token|secret|password)"?\s*:\s*"[^"]+"/gi, '$1:"[redacted]"')

    // Credit card numbers (basic pattern)
    .replace(/\b(\d{4}[- ]?){3}\d{4}\b/g, '[redacted_card]')

    // Phone numbers (various formats)
    .replace(/\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[redacted_phone]')

    // IP addresses
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[redacted_ip]')

    // JWTs
    .replace(/eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, '[redacted_jwt]')

    // Bearer tokens
    .replace(/Bearer\s+[A-Za-z0-9\-._~+\/]+/gi, 'Bearer [redacted]');
}

export function redactObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const result: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    const lowerKey = key.toLowerCase();

    // Redact sensitive keys entirely
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('apikey') ||
      lowerKey.includes('api_key') ||
      lowerKey.includes('authorization')
    ) {
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

export function sanitizeMessage(message: string, maxLength = 2000): string {
  if (!message) return '';

  const sanitized = message
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim();

  return sanitized.slice(0, maxLength);
}

export function sanitizeStack(stack: string, maxLength = 4000): string {
  if (!stack) return '';

  return redactPII(stack).slice(0, maxLength);
}
