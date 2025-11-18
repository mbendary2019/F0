/**
 * Hashing Utilities
 * For anonymizing IP addresses and other PII
 */

import crypto from 'crypto';

export function sha1(value: string): string {
  return crypto
    .createHash('sha1')
    .update(value)
    .digest('hex');
}

export function sha256(value: string): string {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

export function md5(value: string): string {
  return crypto
    .createHash('md5')
    .update(value)
    .digest('hex');
}

/**
 * Hash an IP address with optional salt for privacy
 */
export function hashIP(ip: string, salt?: string): string {
  const value = salt ? `${ip}:${salt}` : ip;
  return `sha1:${sha1(value)}`;
}

/**
 * Create a fingerprint from multiple values
 */
export function createFingerprint(...values: string[]): string {
  return sha256(values.join(':'));
}
