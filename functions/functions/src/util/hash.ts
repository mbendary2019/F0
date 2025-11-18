/**
 * Phase 49: Hashing Utilities
 * For privacy-preserving identifiers (IP addresses, etc.)
 */

import * as crypto from 'crypto';

export function sha1(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex');
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function md5(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex');
}

export function hashIP(ip: string, salt?: string): string {
  const value = salt ? `${ip}:${salt}` : ip;
  return 'sha1:' + sha1(value);
}

export function createFingerprint(service: string, code: number, route: string): string {
  return service + ':' + code + ':' + route;
}
