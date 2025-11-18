/**
 * Phase 40 - AI-to-AI Collaboration Bus - Message Handlers
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { publish } from './publish';

export const onBusMessage = onDocumentCreated(
  'ops_bus_messages/{id}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const m: any = snap.data();

    // Example: Router proposes a policy tweak → Governance acknowledges or asks for evidence
    if (m.type === 'proposal' && m.to === 'governance') {
      await publish('governance', m.from, 'ack', {
        received: true,
        ticket: `GOV-${snap.id}`,
      });

      console.log(
        `[onBusMessage] Governance acknowledged proposal from ${m.from}`
      );
    }

    // Add more handlers as needed
    if (m.type === 'intent' && m.to === 'auto-deploy') {
      console.log(
        `[onBusMessage] Auto-deploy received intent from ${m.from}:`,
        m.payload
      );
      // Could trigger deployment based on intent
    }
  }
);
