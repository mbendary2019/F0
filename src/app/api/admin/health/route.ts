/**
 * GET /api/admin/health
 * System health check endpoint (admin only)
 */

import { NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';
import { db } from '@/server/firebase-admin';
import { rateLimitGuard } from '@/server/rate-limit';

export async function GET(req: Request) {
  // Rate limiting
  const rateLimitResult = await rateLimitGuard(req);
  if (!rateLimitResult.ok) {
    return NextResponse.json(
      { error: rateLimitResult.error },
      { status: rateLimitResult.status }
    );
  }

  // Authentication with admin check
  const auth = await assertAuth(req, { requireActive: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Check if user has admin claim
  if (!auth.claims.admin) {
    return NextResponse.json(
      { error: 'Forbidden. Admin access required.' },
      { status: 403 }
    );
  }

  try {
    // Check environment configuration
    const config = {
      sentry: Boolean(process.env.SENTRY_DSN),
      slack: Boolean(process.env.SLACK_WEBHOOK_URL),
      email: Boolean(process.env.SENDGRID_API_KEY && process.env.ALERT_EMAIL_TO),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      redis: Boolean(
        process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ),
    };

    // Check Firestore connectivity
    let firestoreOk = false;
    try {
      await db.collection('_health_check').limit(1).get();
      firestoreOk = true;
    } catch (error) {
      console.error('[Health Check] Firestore error:', error);
    }

    // Get recent alerts count
    let openAlerts = 0;
    let criticalAlerts = 0;
    try {
      const alertsSnapshot = await db
        .collection('alerts')
        .where('status', '==', 'open')
        .get();

      openAlerts = alertsSnapshot.size;

      alertsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.severity === 'critical') {
          criticalAlerts++;
        }
      });
    } catch (error) {
      console.error('[Health Check] Alerts query error:', error);
    }

    // Overall health status
    const healthy = firestoreOk && criticalAlerts === 0;

    return NextResponse.json({
      healthy,
      timestamp: new Date().toISOString(),
      services: {
        firestore: firestoreOk,
      },
      config,
      alerts: {
        open: openAlerts,
        critical: criticalAlerts,
      },
      environment: process.env.NODE_ENV,
    });
  } catch (error: any) {
    console.error('[GET /api/admin/health] Error:', error);
    return NextResponse.json(
      {
        healthy: false,
        error: error.message || 'Health check failed',
      },
      { status: 500 }
    );
  }
}
