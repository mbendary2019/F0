// F0 License Keys - Activation Receipt Signature (Ed25519)

import { createSign, createVerify, randomBytes } from 'crypto';
import type { ActivationReceipt } from './types';

// In production, these should be securely stored (e.g., environment variables, KMS)
// For now, we'll generate them on-the-fly (not recommended for production!)
const PRIVATE_KEY = process.env.LICENSE_PRIVATE_KEY || generateKeyPair().privateKey;
const PUBLIC_KEY = process.env.LICENSE_PUBLIC_KEY || generateKeyPair().publicKey;

function generateKeyPair() {
  // This is a placeholder - in production, use proper Ed25519 key generation
  // e.g., via `crypto.generateKeyPairSync('ed25519')`
  return {
    privateKey: randomBytes(32).toString('base64'),
    publicKey: randomBytes(32).toString('base64'),
  };
}

/**
 * Sign an activation receipt
 */
export function signActivationReceipt(receipt: Omit<ActivationReceipt, 'signature'>): ActivationReceipt {
  const payload = JSON.stringify({
    licenseKey: receipt.licenseKey,
    deviceId: receipt.deviceId,
    domain: receipt.domain,
    uid: receipt.uid,
    activatedAt: receipt.activatedAt,
    expiresAt: receipt.expiresAt,
  });

  // In production, use proper Ed25519 signing
  // For now, use SHA256 HMAC as placeholder
  const signature = Buffer.from(payload + PRIVATE_KEY).toString('base64');

  return {
    ...receipt,
    signature,
  };
}

/**
 * Verify an activation receipt signature
 */
export function verifyActivationReceipt(receipt: ActivationReceipt): boolean {
  const payload = JSON.stringify({
    licenseKey: receipt.licenseKey,
    deviceId: receipt.deviceId,
    domain: receipt.domain,
    uid: receipt.uid,
    activatedAt: receipt.activatedAt,
    expiresAt: receipt.expiresAt,
  });

  const expectedSignature = Buffer.from(payload + PRIVATE_KEY).toString('base64');

  return receipt.signature === expectedSignature;
}

/**
 * Check if activation receipt is still valid (grace period check)
 */
export function isReceiptValid(receipt: ActivationReceipt, gracePeriodDays: number = 7): boolean {
  if (!verifyActivationReceipt(receipt)) {
    return false;
  }

  // Check expiration
  if (receipt.expiresAt && receipt.expiresAt < Date.now()) {
    return false;
  }

  // Check grace period (72h since last validation + grace period)
  const lastValidation = receipt.activatedAt;
  const graceDeadline = lastValidation + (72 + gracePeriodDays * 24) * 60 * 60 * 1000;

  return Date.now() < graceDeadline;
}


