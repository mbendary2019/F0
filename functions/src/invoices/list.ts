import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

const db = admin.firestore();

export const listInvoices = onCall({ cors: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'login required');

  logger.info('[invoices] Fetching invoices', { uid });

  const snap = await db
    .collection('ops_invoices')
    .where('uid', '==', uid)
    .orderBy('created', 'desc')
    .limit(50)
    .get();

  const invoices = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  logger.info('[invoices] Retrieved invoices', {
    uid,
    count: invoices.length,
  });

  return { invoices };
});
