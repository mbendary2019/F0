/**
 * PII (Personally Identifiable Information) Mapping
 * Defines which collections and fields contain user data for GDPR/DSAR compliance
 */

export interface PIICollection {
  name: string;
  fields: string[];
  description?: string;
  uidField?: string; // Field name that contains the user ID (default: 'uid')
  subcollections?: PIICollection[];
}

/**
 * Complete map of all collections containing PII
 * Used for data export and deletion
 */
export const PII_MAP: PIICollection[] = [
  {
    name: 'users',
    fields: [
      'uid',
      'email',
      'displayName',
      'phoneNumber',
      'photoURL',
      'createdAt',
      'updatedAt',
      'lastLoginAt',
      'emailVerified',
      'mfaEnabled',
      'mfaMethods',
    ],
    description: 'User account data',
    uidField: 'uid',
    subcollections: [
      {
        name: 'mfa_devices',
        fields: ['deviceId', 'deviceName', 'createdAt', 'lastUsedAt'],
        description: 'MFA device registrations',
      },
      {
        name: 'backup_codes',
        fields: ['code', 'usedAt', 'createdAt'],
        description: 'Backup authentication codes',
      },
      {
        name: 'passkeys',
        fields: ['credentialId', 'publicKey', 'createdAt', 'lastUsedAt', 'deviceName'],
        description: 'WebAuthn passkey credentials',
      },
    ],
  },
  {
    name: 'entitlements',
    fields: [
      'uid',
      'stripeCustomerId',
      'stripeSubscriptionId',
      'planTier',
      'status',
      'currentPeriodStart',
      'currentPeriodEnd',
      'cancelAt',
      'createdAt',
      'updatedAt',
    ],
    description: 'Subscription and billing data',
    uidField: 'uid',
  },
  {
    name: 'workspaces',
    fields: [
      'name',
      'ownerUid',
      'planTier',
      'createdAt',
      'updatedAt',
    ],
    description: 'Workspace data',
    uidField: 'ownerUid',
    subcollections: [
      {
        name: 'members',
        fields: ['uid', 'email', 'role', 'joinedAt', 'invitedBy'],
        description: 'Workspace members',
      },
      {
        name: 'invites',
        fields: ['email', 'role', 'createdBy', 'createdAt', 'expiresAt'],
        description: 'Pending workspace invitations',
      },
    ],
  },
  {
    name: 'audit_logs',
    fields: [
      'uid',
      'action',
      'resourceType',
      'resourceId',
      'ip_hash',
      'userAgent',
      'ts',
      'status',
      'metadata',
    ],
    description: 'Audit trail of user actions',
    uidField: 'uid',
  },
  {
    name: 'usage_events',
    fields: [
      'uid',
      'wsId',
      'kind',
      'amount',
      'ts',
    ],
    description: 'Usage tracking events',
    uidField: 'uid',
  },
  {
    name: 'user_quotas',
    fields: [
      'uid',
      'planTier',
      'limit',
      'used',
      'dateKey',
      'resetAt',
      'updatedAt',
    ],
    description: 'Daily usage quotas',
    uidField: 'uid',
  },
  {
    name: 'dsar_requests',
    fields: [
      'uid',
      'type',
      'status',
      'reason',
      'adminNotes',
      'createdAt',
      'updatedAt',
      'approvedBy',
      'deniedBy',
    ],
    description: 'DSAR requests (export/delete)',
    uidField: 'uid',
  },
  {
    name: 'dsar_exports',
    fields: [
      'uid',
      'reqId',
      'location',
      'sizeBytes',
      'parts',
      'createdAt',
      'readyAt',
      'expiresAt',
    ],
    description: 'Data export packages',
    uidField: 'uid',
  },
];

/**
 * Get all collection names that contain PII
 */
export function getPIICollections(): string[] {
  return PII_MAP.map((c) => c.name);
}

/**
 * Get PII collection config by name
 */
export function getPIICollection(name: string): PIICollection | undefined {
  return PII_MAP.find((c) => c.name === name);
}

/**
 * Get all fields for a collection (including subcollections)
 */
export function getAllFields(collection: PIICollection): string[] {
  const fields = [...collection.fields];

  if (collection.subcollections) {
    collection.subcollections.forEach((sub) => {
      fields.push(...sub.fields.map((f) => `${sub.name}.${f}`));
    });
  }

  return fields;
}
