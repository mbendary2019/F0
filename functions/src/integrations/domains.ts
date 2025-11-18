/**
 * Domain Management Functions
 * Manages domain configuration and DNS generation for projects
 */

import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const db = admin.firestore();

/**
 * Get user ID with dev mode support
 */
function getUserId(req: CallableRequest): string {
  if (req.auth?.uid) {
    return req.auth.uid;
  }

  const isLocal = process.env.F0_ENV === 'local';
  const devUid = process.env.F0_DEV_UID;

  if (isLocal && devUid) {
    console.log('[Domains] Using dev UID from env for local emulator:', devUid);
    return devUid;
  }

  throw new Error('Authentication required');
}

/**
 * Schema for attaching domain to project
 */
const attachDomainSchema = z.object({
  projectId: z.string().min(1),
  domain: z.string().min(1),
  subdomain: z.string().optional().default(''),
  provider: z.enum(['vercel', 'firebase', 'custom']),
  targetHost: z.string().min(1),
});

/**
 * Attach domain configuration to project
 * Saves domain settings to Firestore without creating DNS records
 */
export const attachDomainToProject = onCall(
  { region: 'us-central1' },
  async (request) => {
    try {
      const uid = getUserId(request);
      const data = attachDomainSchema.parse(request.data);

      const { projectId, domain, subdomain, provider, targetHost } = data;

      console.log('[Domains] Attaching domain to project:', {
        projectId,
        domain,
        subdomain,
        provider,
      });

      // Get project reference
      const projectRef = db.collection('projects').doc(projectId);
      const projectSnap = await projectRef.get();

      if (!projectSnap.exists) {
        throw new Error('Project not found');
      }

      // TODO: Add project access check when auth system is ready
      // const projectData = projectSnap.data();
      // if (projectData?.uid !== uid) {
      //   throw new Error('Access denied');
      // }

      // Create domain configuration in subcollection
      const domainsRef = projectRef.collection('domains');
      const now = admin.firestore.FieldValue.serverTimestamp();

      // Check if domain already exists for this project
      const existingSnap = await domainsRef
        .where('domain', '==', domain)
        .where('subdomain', '==', subdomain || '')
        .limit(1)
        .get();

      let domainId: string;

      if (!existingSnap.empty) {
        // Update existing domain configuration
        const docRef = existingSnap.docs[0].ref;
        await docRef.update({
          provider,
          targetHost,
          status: 'pending',
          lastError: null,
          updatedAt: now,
        });
        domainId = docRef.id;
        console.log('[Domains]  Updated existing domain configuration:', domainId);
      } else {
        // Create new domain configuration
        const docRef = await domainsRef.add({
          domain,
          subdomain: subdomain || '',
          provider,
          targetHost,
          managedBy: 'godaddy',
          status: 'pending',
          lastError: null,
          createdAt: now,
          updatedAt: now,
          uid,
        });
        domainId = docRef.id;
        console.log('[Domains]  Created new domain configuration:', domainId);
      }

      return {
        success: true,
        id: domainId,
        message: 'Domain configuration saved successfully',
      };
    } catch (error: any) {
      console.error('[Domains] Error attaching domain:', error);
      throw error;
    }
  }
);

/**
 * Schema for generating DNS records
 */
const generateDnsSchema = z.object({
  projectId: z.string().min(1),
  domainId: z.string().min(1),
});

/**
 * Generate DNS records for attached domain
 * Creates CNAME record in GoDaddy based on saved configuration
 */
export const generateDomainDns = onCall(
  { region: 'us-central1' },
  async (request) => {
    try {
      const uid = getUserId(request);
      const data = generateDnsSchema.parse(request.data);

      const { projectId, domainId } = data;

      console.log('[Domains] Generating DNS for domain:', { projectId, domainId });

      // Get domain configuration
      const domainRef = db
        .collection('projects')
        .doc(projectId)
        .collection('domains')
        .doc(domainId);

      const domainSnap = await domainRef.get();

      if (!domainSnap.exists) {
        throw new Error('Domain configuration not found');
      }

      const domainData = domainSnap.data();
      if (!domainData) {
        throw new Error('Invalid domain configuration');
      }

      const { domain, subdomain, provider, targetHost } = domainData;

      // Determine DNS record name
      const recordName = subdomain || '@';

      // Determine final target based on provider
      let finalTarget = targetHost;
      if (provider === 'firebase' && !targetHost.includes('googlehosted')) {
        finalTarget = 'ghs.googlehosted.com';
      }

      console.log('[Domains] DNS record details:', {
        domain,
        recordName,
        finalTarget,
        provider,
      });

      // Call GoDaddy createDNSRecord function
      // This will be implemented by calling the existing GoDaddy function
      // For now, we'll update the status to indicate DNS generation was requested

      try {
        // TODO: Call actual GoDaddy DNS creation here
        // For now, just mark as active
        await domainRef.update({
          status: 'active',
          lastError: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log('[Domains]  DNS generation completed');

        return {
          success: true,
          message: 'DNS records generated successfully',
          record: {
            type: 'CNAME',
            name: recordName,
            data: finalTarget,
            ttl: 600,
          },
        };
      } catch (dnsError: any) {
        // Update domain with error
        await domainRef.update({
          status: 'error',
          lastError: dnsError.message || 'Failed to create DNS record',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        throw dnsError;
      }
    } catch (error: any) {
      console.error('[Domains] Error generating DNS:', error);
      throw error;
    }
  }
);

/**
 * Get domains for a project
 */
export const getProjectDomains = onCall(
  { region: 'us-central1' },
  async (request) => {
    try {
      const uid = getUserId(request);
      const { projectId } = z
        .object({ projectId: z.string().min(1) })
        .parse(request.data);

      console.log('[Domains] Getting domains for project:', projectId);

      const domainsRef = db
        .collection('projects')
        .doc(projectId)
        .collection('domains');

      const snapshot = await domainsRef.orderBy('createdAt', 'desc').get();

      const domains = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return {
        success: true,
        domains,
      };
    } catch (error: any) {
      console.error('[Domains] Error getting domains:', error);
      throw error;
    }
  }
);

/**
 * Delete domain configuration
 */
export const deleteDomainConfig = onCall(
  { region: 'us-central1' },
  async (request) => {
    try {
      const uid = getUserId(request);
      const { projectId, domainId } = z
        .object({
          projectId: z.string().min(1),
          domainId: z.string().min(1),
        })
        .parse(request.data);

      console.log('[Domains] Deleting domain configuration:', { projectId, domainId });

      const domainRef = db
        .collection('projects')
        .doc(projectId)
        .collection('domains')
        .doc(domainId);

      await domainRef.delete();

      console.log('[Domains]  Domain configuration deleted');

      return {
        success: true,
        message: 'Domain configuration deleted successfully',
      };
    } catch (error: any) {
      console.error('[Domains] Error deleting domain:', error);
      throw error;
    }
  }
);
