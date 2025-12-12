import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try { admin.initializeApp(); } catch {}
}

// Export the app instance for use in other modules
export const adminApp = admin.apps[0] || admin.app();
export const adminDb = admin.firestore();
export const adminAuth = admin.auth();

export async function verifyIdToken(_token?: string){
  // TODO: استبدلها بتنفيذ حقيقي لاحقًا
  return { uid: 'dev-user', admin: true, sub_tier: 'pro', sub_active: true };
}
export async function verifySessionCookie(_cookie?: any){
  return { uid: 'dev-user', admin: true, claims: { admin: true, sub_tier: 'pro', sub_active: true } };
}
