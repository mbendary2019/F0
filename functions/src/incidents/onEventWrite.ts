/**
 * Phase 49: Incident Detection
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const onEventWrite = functions.firestore
  .document('ops_events/{id}')
  .onCreate(async (snap, context) => {
    const event = snap.data();
    const { level, code, fingerprint, service, message } = event;

    if (level !== 'error' && level !== 'fatal' && code < 500) {
      return;
    }

    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentEvents = await db.collection('ops_events')
      .where('fingerprint', '==', fingerprint)
      .where('ts', '>=', fiveMinutesAgo)
      .get();

    const eventCount = recentEvents.size;
    let severity: 'low' | 'medium' | 'high' | 'critical';
    
    if (eventCount >= 100) severity = 'critical';
    else if (eventCount >= 30) severity = 'high';
    else if (eventCount >= 10) severity = 'medium';
    else severity = 'low';

    const incidentId = fingerprint;
    const incidentRef = db.collection('ops_incidents').doc(incidentId);
    const incidentSnap = await incidentRef.get();
    const now = Date.now();

    if (!incidentSnap.exists) {
      await incidentRef.set({
        fingerprint, service, message, severity,
        status: 'open',
        eventCount: 1,
        firstSeen: now,
        lastSeen: now,
        updatedAt: now,
      });

      await db.collection('ops_incident_updates').add({
        incidentId,
        type: 'created',
        message: 'Incident created with severity ' + severity,
        createdAt: now,
      });

      if (severity === 'high' || severity === 'critical') {
        await db.collection('_alerts_queue').add({
          incidentId, severity,
          message: severity.toUpperCase() + ': ' + service + ' - ' + message,
          processed: false,
          createdAt: now,
        });
      }
    } else {
      const oldSeverity = incidentSnap.data()?.severity;
      await incidentRef.update({
        severity,
        eventCount: admin.firestore.FieldValue.increment(1),
        lastSeen: now,
        updatedAt: now,
      });

      if (oldSeverity !== severity) {
        await db.collection('ops_incident_updates').add({
          incidentId,
          type: 'severity_change',
          message: 'Severity changed from ' + oldSeverity + ' to ' + severity,
          createdAt: now,
        });

        if (severity === 'high' || severity === 'critical') {
          await db.collection('_alerts_queue').add({
            incidentId, severity,
            message: 'ESCALATED to ' + severity.toUpperCase() + ': ' + service + ' - ' + message,
            processed: false,
            createdAt: now,
          });
        }
      }
    }
  });
