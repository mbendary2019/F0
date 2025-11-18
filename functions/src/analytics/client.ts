/**
 * Phase 48 - Analytics Shared Client
 * Shared utilities for analytics functions
 */

import Stripe from 'stripe';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const auth = admin.auth();

// Initialize Stripe
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

// Timezone for Kuwait
export const tz = 'Asia/Kuwait';

/**
 * Get today's date in YYYY-MM-DD format (Kuwait timezone)
 */
export function today(): string {
  return new Date()
    .toLocaleString('en-CA', { timeZone: tz })
    .slice(0, 10);
}

/**
 * Get date N days ago in YYYY-MM-DD format
 */
export function daysAgo(n: number): string {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date.toLocaleString('en-CA', { timeZone: tz }).slice(0, 10);
}

/**
 * Parse date string to Date object (start of day)
 */
export function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

/**
 * Parse date string to Date object (end of day)
 */
export function parseDateEnd(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999`);
}
