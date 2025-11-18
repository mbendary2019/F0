// F0 License Keys - Type Definitions

export type Plan = 'pro' | 'team' | 'enterprise';
export type LicenseStatus = 'active' | 'revoked' | 'expired';

export interface License {
  key: string;
  plan: Plan;
  seats: number;
  issuedTo: string; // uid or orgId
  status: LicenseStatus;
  activations: Activation[];
  maxActivations: number;
  expiresAt?: number; // timestamp (optional for lifetime licenses)
  createdAt: number;
  createdBy: string; // admin uid
  metadata?: Record<string, any>;
}

export interface Activation {
  deviceId?: string;
  domain?: string;
  uid: string;
  activatedAt: number;
  lastValidatedAt?: number;
}

export interface LicenseValidationResult {
  valid: boolean;
  license?: License;
  error?: string;
  gracePeriod?: boolean; // true if offline validation within grace period
}

export interface ActivationReceipt {
  licenseKey: string;
  deviceId?: string;
  domain?: string;
  uid: string;
  activatedAt: number;
  expiresAt?: number;
  signature: string; // Ed25519 signature
}


