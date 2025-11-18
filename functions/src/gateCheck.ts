import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { enforceGate } from './limits'; // عندك بالفعل
export const gateCheck = onCall<{ uid: string }>(async (req) => {
  const uid = req.data?.uid || req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated','UID required');
  const out = await enforceGate(uid);
  return out; // { decision: { allow, reason, hard }, subscription }
});
