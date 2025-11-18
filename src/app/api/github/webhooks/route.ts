/**
 * GitHub Webhook Handler
 *
 * Receives and processes GitHub webhook events (push, pull_request, etc.)
 * Verifies webhook signatures using HMAC SHA-256
 * Stores activity in Firestore
 *
 * Phase 52 - GitHub Integration
 */

import {NextRequest, NextResponse} from 'next/server';
import crypto from 'crypto';
import {headers} from 'next/headers';
import {adminDb} from '@/lib/firebaseAdmin';

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET!;

if (!WEBHOOK_SECRET) {
  console.warn('⚠️  GITHUB_WEBHOOK_SECRET not configured - webhook signature verification will fail');
}

/**
 * Verify GitHub webhook signature
 * GitHub signs webhooks with HMAC SHA-256
 */
function verifySignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.error('GITHUB_WEBHOOK_SECRET not configured');
    return false;
  }

  // Compute HMAC SHA-256
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(payload, 'utf8');
  const computed = `sha256=${hmac.digest('hex')}`;

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch (error) {
    // Length mismatch or invalid encoding
    return false;
  }
}

/**
 * Find userId from repository ID
 */
async function findUserIdForRepo(repoId: number): Promise<string | null> {
  const reposSnapshot = await adminDb
    .collection('ops_github_repos')
    .where('repoId', '==', repoId)
    .limit(1)
    .get();

  if (reposSnapshot.empty) {
    return null;
  }

  return reposSnapshot.docs[0].data().userId;
}

export async function POST(req: NextRequest) {
  try {
    // Read raw body
    const body = await req.text();

    // Get headers
    const headersList = headers();
    const signature = headersList.get('x-hub-signature-256') || '';
    const event = headersList.get('x-github-event') || 'unknown';
    const deliveryId = headersList.get('x-github-delivery') || 'unknown';

    // Verify signature
    if (!verifySignature(body, signature)) {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json(
        {ok: false, error: 'Invalid signature'},
        {status: 401}
      );
    }

    // Parse payload
    const payload = JSON.parse(body);

    // Extract repository info
    const repository = payload.repository;
    if (!repository) {
      console.warn('⚠️  Webhook missing repository info');
      return NextResponse.json({ok: true, message: 'No repository in payload'});
    }

    const repoId = repository.id;

    // Find userId from repository
    const userId = await findUserIdForRepo(repoId);
    if (!userId) {
      console.warn(`⚠️  Repository ${repoId} not found in ops_github_repos`);
      return NextResponse.json({ok: true, message: 'Repository not linked'});
    }

    // Extract event-specific data
    const branch = payload.ref ? payload.ref.split('/').pop() : null;
    const commit =
      payload.head_commit?.id ||
      payload.pull_request?.head?.sha ||
      payload.commits?.[0]?.id ||
      null;
    const by =
      payload.sender?.login ||
      payload.pusher?.name ||
      payload.head_commit?.author?.username ||
      null;

    // Store activity in Firestore
    await adminDb.collection('ops_github_activity').add({
      userId,
      repoId,
      type: event,
      branch,
      commit,
      by,
      payload: {
        action: payload.action || null,
        size: payload.size || payload.commits?.length || 0,
        deliveryId,
      },
      ts: new Date().toISOString(),
      signature: signature.replace('sha256=', ''),
    });

    console.log(`✅ GitHub webhook processed: ${event} for repo ${repoId}`);

    return NextResponse.json({
      ok: true,
      message: 'Webhook processed successfully',
      event,
      repoId,
    });
  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json(
      {ok: false, error: error.message || 'Internal server error'},
      {status: 500}
    );
  }
}

// Respond to webhook ping events
export async function GET(req: NextRequest) {
  return NextResponse.json({
    ok: true,
    message: 'GitHub webhook endpoint is ready',
    timestamp: new Date().toISOString(),
  });
}
