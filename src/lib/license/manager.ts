// F0 License Keys - License Manager

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { generateLicenseKey, validateLicenseKeyFormat, extractPlanFromKey } from './generator';
import type { License, Activation, LicenseValidationResult, Plan } from './types';

const db = getFirestore();

export class LicenseManager {
  /**
   * Issue a new license key
   */
  async issue(params: {
    plan: Plan;
    seats: number;
    issuedTo: string; // uid or orgId
    expiresAt?: number;
    createdBy: string; // admin uid
    metadata?: Record<string, any>;
  }): Promise<License> {
    const key = generateLicenseKey(params.plan);

    const license: License = {
      key,
      plan: params.plan,
      seats: params.seats,
      issuedTo: params.issuedTo,
      status: 'active',
      activations: [],
      maxActivations: params.seats * 2, // Allow 2 activations per seat (e.g., desktop + mobile)
      expiresAt: params.expiresAt,
      createdAt: Date.now(),
      createdBy: params.createdBy,
      metadata: params.metadata,
    };

    await db.collection('licenses').doc(key).set(license);

    return license;
  }

  /**
   * Activate a license on a device/domain
   */
  async activate(params: {
    key: string;
    uid: string;
    deviceId?: string;
    domain?: string;
  }): Promise<{ success: boolean; license?: License; error?: string }> {
    if (!validateLicenseKeyFormat(params.key)) {
      return { success: false, error: 'Invalid license key format' };
    }

    return db.runTransaction(async (tx) => {
      const licenseRef = db.collection('licenses').doc(params.key);
      const licenseDoc = await tx.get(licenseRef);

      if (!licenseDoc.exists) {
        return { success: false, error: 'License key not found' };
      }

      const license = licenseDoc.data() as License;

      // Check status
      if (license.status !== 'active') {
        return { success: false, error: `License is ${license.status}` };
      }

      // Check expiration
      if (license.expiresAt && license.expiresAt < Date.now()) {
        tx.update(licenseRef, { status: 'expired' });
        return { success: false, error: 'License has expired' };
      }

      // Check if already activated
      const existingActivation = license.activations.find(
        (a) =>
          (params.deviceId && a.deviceId === params.deviceId) ||
          (params.domain && a.domain === params.domain)
      );

      if (existingActivation) {
        // Update last validated
        const updatedActivations = license.activations.map((a) =>
          a === existingActivation ? { ...a, lastValidatedAt: Date.now() } : a
        );
        tx.update(licenseRef, { activations: updatedActivations });
        return { success: true, license: { ...license, activations: updatedActivations } };
      }

      // Check activation limit
      if (license.activations.length >= license.maxActivations) {
        return { success: false, error: 'Maximum activations reached' };
      }

      // Add new activation
      const activation: Activation = {
        deviceId: params.deviceId,
        domain: params.domain,
        uid: params.uid,
        activatedAt: Date.now(),
        lastValidatedAt: Date.now(),
      };

      tx.update(licenseRef, {
        activations: FieldValue.arrayUnion(activation),
      });

      return { success: true, license: { ...license, activations: [...license.activations, activation] } };
    });
  }

  /**
   * Validate a license key
   */
  async validate(key: string): Promise<LicenseValidationResult> {
    if (!validateLicenseKeyFormat(key)) {
      return { valid: false, error: 'Invalid license key format' };
    }

    const licenseDoc = await db.collection('licenses').doc(key).get();

    if (!licenseDoc.exists) {
      return { valid: false, error: 'License key not found' };
    }

    const license = licenseDoc.data() as License;

    // Check status
    if (license.status !== 'active') {
      return { valid: false, error: `License is ${license.status}`, license };
    }

    // Check expiration
    if (license.expiresAt && license.expiresAt < Date.now()) {
      await db.collection('licenses').doc(key).update({ status: 'expired' });
      return { valid: false, error: 'License has expired', license };
    }

    return { valid: true, license };
  }

  /**
   * Revoke a license
   */
  async revoke(key: string, reason?: string): Promise<void> {
    await db.collection('licenses').doc(key).update({
      status: 'revoked',
      revokedAt: FieldValue.serverTimestamp(),
      revocationReason: reason,
    });
  }

  /**
   * Get all licenses for a user/org
   */
  async getByOwner(issuedTo: string): Promise<License[]> {
    const snapshot = await db
      .collection('licenses')
      .where('issuedTo', '==', issuedTo)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => doc.data() as License);
  }

  /**
   * Deactivate a specific activation
   */
  async deactivate(params: {
    key: string;
    deviceId?: string;
    domain?: string;
  }): Promise<boolean> {
    return db.runTransaction(async (tx) => {
      const licenseRef = db.collection('licenses').doc(params.key);
      const licenseDoc = await tx.get(licenseRef);

      if (!licenseDoc.exists) {
        return false;
      }

      const license = licenseDoc.data() as License;

      const updatedActivations = license.activations.filter(
        (a) =>
          !(
            (params.deviceId && a.deviceId === params.deviceId) ||
            (params.domain && a.domain === params.domain)
          )
      );

      tx.update(licenseRef, { activations: updatedActivations });

      return true;
    });
  }
}

export const licenseManager = new LicenseManager();


