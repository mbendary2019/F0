// src/lib/functionsClient.ts
// Use NEXT_PUBLIC_ prefix for client-side access
const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'from-zero-84253';
const REGION = process.env.NEXT_PUBLIC_FUNCTIONS_REGION || "us-central1";

// Check if we're in development/emulator mode
const isDev = typeof window !== 'undefined'
  ? window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  : process.env.NODE_ENV === 'development';

const USE_EMU = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" || isDev;
const EMU_ORIGIN = process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_ORIGIN || `http://127.0.0.1:5001`;

function baseUrl() {
  if (USE_EMU) return `${EMU_ORIGIN}/${PROJECT}/${REGION}`;
  return `https://${REGION}-${PROJECT}.cloudfunctions.net`;
}

type CallOpts = {
  idToken?: string;        // لو معاك جلسة مستخدم
  data?: any;              // payload
  timeoutMs?: number;
};

export async function callCallable<T = any>(name: string, opts: CallOpts = {}): Promise<T> {
  const url = `${baseUrl()}/${name}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(opts.idToken ? { Authorization: `Bearer ${opts.idToken}` } : {}),
      },
      // callable v2 يتوقع { data: {...} }
      body: JSON.stringify({ data: opts.data ?? {} }),
      signal: controller.signal,
    });

    // callable v2 بيرجع { result: {...} } أو { data: {...} } حسب SDK
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error?.message || `Callable ${name} failed (${res.status})`);
    }
    return (json?.result ?? json?.data ?? json) as T;
  } finally {
    clearTimeout(t);
  }
}
