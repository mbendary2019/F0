// F0 License Keys - Key Generator

import { randomBytes } from 'crypto';
import type { Plan } from './types';

/**
 * Generate a license key in the format: F0-{PLAN}-{6CHUNK}-{6CHUNK}-{6CHUNK}
 * Example: F0-PRO-8K2D9X-PR7Q1N-4VY6TB
 */
export function generateLicenseKey(plan: Plan): string {
  const planCode = plan.toUpperCase();
  const chunks = [
    generateChunk(6),
    generateChunk(6),
    generateChunk(6),
  ];

  return `F0-${planCode}-${chunks.join('-')}`;
}

/**
 * Generate a random alphanumeric chunk
 */
function generateChunk(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous: 0, O, 1, I
  const bytes = randomBytes(length);
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }

  return result;
}

/**
 * Validate license key format
 */
export function validateLicenseKeyFormat(key: string): boolean {
  const pattern = /^F0-(PRO|TEAM|ENTERPRISE)-[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{6}$/;
  return pattern.test(key);
}

/**
 * Extract plan from license key
 */
export function extractPlanFromKey(key: string): Plan | null {
  const match = key.match(/^F0-(PRO|TEAM|ENTERPRISE)-/);
  if (!match) return null;

  return match[1].toLowerCase() as Plan;
}


