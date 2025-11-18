import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try { admin.initializeApp(); } catch {}
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();

export async function verifyIdToken(_token?: string){
  // TODO: استبدلها بتنفيذ حقيقي لاحقًا
  return { uid: 'dev-user', admin: true, sub_tier: 'pro', sub_active: true };
}
export async function verifySessionCookie(_cookie?: any){
  return { uid: 'dev-user', admin: true, claims: { admin: true, sub_tier: 'pro', sub_active: true } };
}
