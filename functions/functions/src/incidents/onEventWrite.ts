/**
 * Phase 49: Incident Detection
 * Firestore trigger that analyzes error spikes and creates incidents
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const onEventWrite = functions.firestore
  .document('ops_events/{id}')
  .onCreate(async (snap, context) => {
    const event = snap.data();
    const { level, code, fingerprint, service, message } = event;

    // Only track errors
    if (level !== 'error' && level !== 'fatal' && code < 500) {
      return;
    }

    // Count recent events with same fingerprint (last 5 minutes)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentEvents = await db.collection('ops_events')
      .where('fingerprint', '==', fingerprint)
      .where('ts', '>=', fiveMinutesAgo)
      .get();

    const eventCount = recentEvents.size;

    // Determine severity based on count
    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (eventCount >= 100) {
      severity = 'critical';
    } else if (eventCount >= 30) {
      severity = 'high';
    } else if (eventCount >= 10) {
      severity = 'medium';
    } else {
      severity = 'low';
    }

    // Create or update incident
    const incidentId = fingerprint;
    const incidentRef = db.collection('ops_incidents').doc(incidentId);
    const incidentSnap = await incidentRef.get();

    const now = Date.now();

    if (!incidentSnap.exists) {
      // Create new incident
      await incidentRef.set({
        fingerprint,
        service,
        message,
        severity,
        status: 'open',
        eventCount: 1,
        firstSeen: now,
        lastSeen: now,
        updatedAt: now,
      });

      // Log to timeline
      await db.collection('ops_incident_updates').add({
        incidentId,
        type: 'created',
        message: `Incident created with severity ${severity}`,
        createdAt: now,
      });

      // Create alert if high or critical
      if (severity === 'high' || severity === 'critical') {
        await db.collection('_alerts_queue').add({
          incidentId,
          severity,
          message: `${severity.toUpperCase()}: ${service} - ${message}`,
          processed: false,
          createdAt: now,
        });
      }
    } else {
      // Update existing incident
      const oldSeverity = incidentSnap.data()?.severity;
      await incidentRef.update({
        severity,
        eventCount: admin.firestore.FieldValue.increment(1),
        lastSeen: now,
        updatedAt: now,
      });

      // Log if severity changed
      if (oldSeverity !== severity) {
        await db.collection('ops_incident_updates').add({
          incidentId,
          type: 'severity_change',
          message: `Severity changed from ${oldSeverity} to ${severity}`,
          createdAt: now,
        });

        // Alert if escalated to high/critical
        if (severity === 'high' || severity === 'critical') {
          await db.collection('_alerts_queue').add({
            incidentId,
            severity,
            message: `ESCALATED to ${severity.toUpperCase()}: ${service} - ${message}`,
            processed: false,
            createdAt: now,
          });
        }
      }
    }
  });
