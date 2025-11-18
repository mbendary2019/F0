/**
 * Apple Sign-In Provider
 * مزوّد تسجيل الدخول عبر Apple مع Nonce security
 */

import {
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type Auth,
  type UserCredential,
} from 'firebase/auth';

/**
 * توليد نص عشوائي آمن
 */
function randomString(length: number = 32): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }

  return result;
}

/**
 * تشفير SHA-256
 */
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource);
  const hashArray = Array.from(new Uint8Array(digest));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex;
}

/**
 * تسجيل الدخول عبر Apple
 * @param auth - Firebase Auth instance
 * @param useRedirect - استخدام redirect بدلاً من popup (للأجهزة المحمولة)
 */
export async function signInWithApple(
  auth: Auth,
  useRedirect: boolean = false
): Promise<UserCredential | null> {
  const provider = new OAuthProvider('apple.com');

  // توليد nonce لحماية إضافية
  const rawNonce = randomString(32);
  const hashedNonce = await sha256(rawNonce);

  provider.setCustomParameters({
    nonce: hashedNonce,
  });

  // إضافة scopes اختيارية
  provider.addScope('email');
  provider.addScope('name');

  try {
    if (useRedirect) {
      // طريقة Redirect (أفضل للأجهزة المحمولة)
      await signInWithRedirect(auth, provider);
      return null; // النتيجة ستأتي عبر handleAppleRedirect
    } else {
      // طريقة Popup (أفضل لسطح المكتب)
      const credential = await signInWithPopup(auth, provider);
      console.log('[Apple Auth] Sign-in successful:', credential.user.uid);
      return credential;
    }
  } catch (error: any) {
    console.error('[Apple Auth] Error:', error.code, error.message);

    // Fallback تلقائي للـ redirect في حالة فشل popup
    if (
      !useRedirect &&
      (error.code === 'auth/popup-blocked' ||
        error.code === 'auth/popup-closed-by-user')
    ) {
      console.log('[Apple Auth] Popup blocked, falling back to redirect...');
      await signInWithRedirect(auth, provider);
      return null;
    }

    throw error;
  }
}

/**
 * معالجة نتيجة Redirect بعد العودة من Apple
 */
export async function handleAppleRedirect(
  auth: Auth
): Promise<UserCredential | null> {
  try {
    const result = await getRedirectResult(auth);

    if (result) {
      console.log('[Apple Auth] Redirect sign-in successful:', result.user.uid);
      return result;
    }

    return null;
  } catch (error: any) {
    console.error('[Apple Auth] Redirect error:', error.code, error.message);
    throw error;
  }
}

/**
 * الحصول على Apple credential من OAuthCredential
 */
export function getAppleCredential(userCredential: UserCredential) {
  const credential = OAuthProvider.credentialFromResult(userCredential);
  return credential;
}

/**
 * التحقق من جهاز iOS/Safari (يفضل استخدام redirect)
 */
export function shouldUseRedirect(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);

  return isIOS || isSafari;
}

/**
 * تسجيل الدخول عبر Apple مع اكتشاف تلقائي للطريقة المناسبة
 */
export async function signInWithAppleAuto(
  auth: Auth
): Promise<UserCredential | null> {
  const useRedirect = shouldUseRedirect();
  return signInWithApple(auth, useRedirect);
}
