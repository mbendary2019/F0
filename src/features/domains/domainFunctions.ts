/**
 * Domain Management - Cloud Functions Helpers
 * Client-side wrappers for domain management callable functions
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';

const functions = getFunctions(app);

/**
 * Domain configuration type
 */
export type DomainConfig = {
  id?: string;
  domain: string;
  subdomain: string;
  provider: 'vercel' | 'firebase' | 'custom';
  targetHost: string;
  managedBy?: string;
  status?: 'pending' | 'active' | 'error';
  lastError?: string | null;
  createdAt?: any;
  updatedAt?: any;
  uid?: string;
};

/**
 * Attach domain configuration to project
 * Saves configuration to Firestore without creating DNS records
 */
export async function attachDomainToProject(params: {
  projectId: string;
  domain: string;
  subdomain?: string;
  provider: 'vercel' | 'firebase' | 'custom';
  targetHost: string;
}) {
  const fn = httpsCallable<
    typeof params,
    { success: boolean; id: string; message: string }
  >(functions, 'attachDomainToProject');

  const result = await fn(params);
  return result.data;
}

/**
 * Generate DNS records for attached domain
 * Creates CNAME record in GoDaddy based on saved configuration
 */
export async function generateDomainDns(params: {
  projectId: string;
  domainId: string;
}) {
  const fn = httpsCallable<
    typeof params,
    {
      success: boolean;
      message: string;
      record: {
        type: string;
        name: string;
        data: string;
        ttl: number;
      };
    }
  >(functions, 'generateDomainDns');

  const result = await fn(params);
  return result.data;
}

/**
 * Get all domains attached to a project
 */
export async function getProjectDomains(projectId: string) {
  const fn = httpsCallable<
    { projectId: string },
    { success: boolean; domains: DomainConfig[] }
  >(functions, 'getProjectDomains');

  const result = await fn({ projectId });
  return result.data;
}

/**
 * Delete domain configuration
 */
export async function deleteDomainConfig(params: {
  projectId: string;
  domainId: string;
}) {
  const fn = httpsCallable<
    typeof params,
    { success: boolean; message: string }
  >(functions, 'deleteDomainConfig');

  const result = await fn(params);
  return result.data;
}
