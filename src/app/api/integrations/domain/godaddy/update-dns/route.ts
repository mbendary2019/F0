/**
 * Phase 70.2: GoDaddy DNS Management
 * POST /api/integrations/domain/godaddy/update-dns
 * Updates GoDaddy DNS A record for custom domain
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { requireProjectOwner } from '@/lib/api/requireProjectOwner';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import type {

export const dynamic = 'force-dynamic';
  UpdateGoDaddyDNSRequest,
  UpdateGoDaddyDNSResponse,
  DomainIntegrationData,
} from '@/types/integrations';

const db = getFirestore(adminApp);

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const user = await requireUser(req);

    // Parse request body
    const body: UpdateGoDaddyDNSRequest = await req.json();
    const { projectId, domain, subdomain, target } = body;

    if (!projectId || !domain || !target) {
      return NextResponse.json(
        { error: 'projectId, domain, and target are required' },
        { status: 400 }
      );
    }

    // Verify project ownership
    await requireProjectOwner(user, projectId);

    // Get GoDaddy API credentials from environment
    const key = process.env.GODADDY_API_KEY;
    const secret = process.env.GODADDY_API_SECRET;

    if (!key || !secret) {
      return NextResponse.json(
        { error: 'GoDaddy not configured. Please set GODADDY_API_KEY and GODADDY_API_SECRET.' },
        { status: 500 }
      );
    }

    // Determine DNS record name (@ for root domain, subdomain for subdomain)
    const recordName = subdomain || '@';

    // Update GoDaddy DNS A record
    const res = await fetch(
      `https://api.godaddy.com/v1/domains/${domain}/records/A/${recordName}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `sso-key ${key}:${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            data: target,
            ttl: 600, // 10 minutes
          },
        ]),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[GoDaddy] DNS update failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to update DNS record', details: errorText },
        { status: res.status }
      );
    }

    // Save integration data to Firestore
    const integrationData: DomainIntegrationData = {
      provider: 'godaddy',
      domain,
      subdomain: subdomain || '',
      attached: true,
      dnsVerified: false, // Will be verified separately
      lastCheck: new Date().toISOString(),
    };

    await db
      .collection('projects')
      .doc(projectId)
      .collection('integrations')
      .doc('domain')
      .set(integrationData);

    const result: UpdateGoDaddyDNSResponse = {
      ok: true,
    };

    console.log(
      `[GoDaddy] DNS updated: ${recordName}.${domain} → ${target} for project ${projectId}`
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('[GoDaddy] Update DNS endpoint error:', error);

    // Handle authentication errors
    if (error.message === 'NO_TOKEN' || error.message === 'INVALID_TOKEN') {
      return NextResponse.json(
        { error: 'Unauthorized', details: error.message },
        { status: 401 }
      );
    }

    // Handle ownership errors
    if (error.message?.includes('FORBIDDEN')) {
      return NextResponse.json(
        { error: 'You do not own this project' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
