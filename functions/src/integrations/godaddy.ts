/**
 * GoDaddy DNS Management Functions
 * Provides domain and DNS record management via GoDaddy API
 */

import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { getIntegrationTokens } from './vault';

const GODADDY_API_BASE = 'https://api.godaddy.com/v1';

/**
 * Get user ID with dev mode support (same as vault.ts)
 */
function getUserId(req: CallableRequest): string {
  if (req.auth?.uid) {
    return req.auth.uid;
  }

  const isLocal = process.env.F0_ENV === 'local';
  const devUid = process.env.F0_DEV_UID;

  if (isLocal && devUid) {
    console.log('[GoDaddy] 🔧 Using dev UID from env for local emulator:', devUid);
    return devUid;
  }

  throw new Error('Authentication required');
}

/**
 * Get GoDaddy API credentials for user
 */
async function getGoDaddyCredentials(uid: string) {
  const integration = await getIntegrationTokens(uid, 'godaddy');

  if (!integration?.credentials?.apiKey || !integration?.credentials?.apiSecret) {
    throw new Error('GoDaddy not connected. Please connect your GoDaddy account first.');
  }

  return {
    apiKey: integration.credentials.apiKey,
    apiSecret: integration.credentials.apiSecret,
  };
}

/**
 * Get authorization header for GoDaddy API
 */
function getAuthHeader(apiKey: string, apiSecret: string): string {
  return `sso-key ${apiKey}:${apiSecret}`;
}

/**
 * Get list of domains from GoDaddy account
 */
export const getGoDaddyDomains = onCall(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
  },
  async (req) => {
    const uid = getUserId(req);
    console.log(`[GoDaddy] Getting domains for user ${uid}`);

    try {
      const { apiKey, apiSecret } = await getGoDaddyCredentials(uid);

      const response = await fetch(`${GODADDY_API_BASE}/domains`, {
        headers: {
          Authorization: getAuthHeader(apiKey, apiSecret),
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GoDaddy] API Error:', response.status, errorText);
        throw new Error(`Failed to fetch domains: ${response.statusText}`);
      }

      const domains = await response.json();
      console.log(`[GoDaddy] ✅ Found ${domains.length} domains`);

      return {
        ok: true,
        domains,
      };
    } catch (error: any) {
      console.error('[GoDaddy] Error fetching domains:', error);
      return {
        ok: false,
        error: error.message,
        domains: [],
      };
    }
  }
);

/**
 * Get DNS records for a specific domain
 */
export const getDNSRecords = onCall<{ domain: string }>(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
  },
  async (req) => {
    const uid = getUserId(req);
    const { domain } = req.data;

    if (!domain) {
      throw new Error('Domain is required');
    }

    console.log(`[GoDaddy] Getting DNS records for ${domain}`);

    try {
      const { apiKey, apiSecret } = await getGoDaddyCredentials(uid);

      const response = await fetch(`${GODADDY_API_BASE}/domains/${domain}/records`, {
        headers: {
          Authorization: getAuthHeader(apiKey, apiSecret),
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GoDaddy] API Error:', response.status, errorText);
        throw new Error(`Failed to fetch DNS records: ${response.statusText}`);
      }

      const records = await response.json();
      console.log(`[GoDaddy] ✅ Found ${records.length} DNS records for ${domain}`);

      return {
        ok: true,
        records,
      };
    } catch (error: any) {
      console.error('[GoDaddy] Error fetching DNS records:', error);
      return {
        ok: false,
        error: error.message,
        records: [],
      };
    }
  }
);

/**
 * Create or update a DNS record
 */
export const createDNSRecord = onCall<{
  domain: string;
  type: string;
  name: string;
  value: string;
  ttl?: number;
}>(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
  },
  async (req) => {
    const uid = getUserId(req);
    const { domain, type, name, value, ttl = 600 } = req.data;

    if (!domain || !type || !name || !value) {
      throw new Error('Missing required fields: domain, type, name, value');
    }

    console.log(`[GoDaddy] Creating DNS record: ${type} ${name} -> ${value} on ${domain}`);

    try {
      const { apiKey, apiSecret } = await getGoDaddyCredentials(uid);

      const recordData = [
        {
          type,
          name,
          data: value,
          ttl,
        },
      ];

      const response = await fetch(
        `${GODADDY_API_BASE}/domains/${domain}/records/${type}/${name}`,
        {
          method: 'PUT',
          headers: {
            Authorization: getAuthHeader(apiKey, apiSecret),
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(recordData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GoDaddy] API Error:', response.status, errorText);
        throw new Error(`Failed to create DNS record: ${response.statusText}`);
      }

      console.log(`[GoDaddy] ✅ DNS record created successfully`);

      return {
        ok: true,
      };
    } catch (error: any) {
      console.error('[GoDaddy] Error creating DNS record:', error);
      return {
        ok: false,
        error: error.message,
      };
    }
  }
);

/**
 * Delete a DNS record
 */
export const deleteDNSRecord = onCall<{
  domain: string;
  type: string;
  name: string;
}>(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
  },
  async (req) => {
    const uid = getUserId(req);
    const { domain, type, name } = req.data;

    if (!domain || !type || !name) {
      throw new Error('Missing required fields: domain, type, name');
    }

    console.log(`[GoDaddy] Deleting DNS record: ${type} ${name} from ${domain}`);

    try {
      const { apiKey, apiSecret } = await getGoDaddyCredentials(uid);

      const response = await fetch(
        `${GODADDY_API_BASE}/domains/${domain}/records/${type}/${name}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: getAuthHeader(apiKey, apiSecret),
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GoDaddy] API Error:', response.status, errorText);
        throw new Error(`Failed to delete DNS record: ${response.statusText}`);
      }

      console.log(`[GoDaddy] ✅ DNS record deleted successfully`);

      return {
        ok: true,
      };
    } catch (error: any) {
      console.error('[GoDaddy] Error deleting DNS record:', error);
      return {
        ok: false,
        error: error.message,
      };
    }
  }
);
