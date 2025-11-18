/**
 * Phase 49: Cloud Functions Entry Point
 * Error Tracking & Incident Center
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

// Export Phase 49 functions
export { log } from './src/http/log';
export { onEventWrite } from './src/incidents/onEventWrite';
export { processAlerts } from './src/alerts/notify';
