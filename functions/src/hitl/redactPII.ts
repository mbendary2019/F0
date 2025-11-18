import { onCall, HttpsError } from "firebase-functions/v2/https";

type Strategy = "mask" | "remove";

function mask(str: string, visible = 2) {
  if (!str) return str;
  if (str.length <= visible) return "*".repeat(str.length);
  return str.slice(0, visible) + "*".repeat(Math.max(0, str.length - visible));
}

export const redactPII = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");

  const { text = "", strategies = {} } = (request.data ?? {}) as {
    text?: string;
    strategies?: Partial<Record<"email" | "phone" | "cc" | "ssn", Strategy>>;
  };

  if (!text) throw new HttpsError("invalid-argument", "text required");

  let out = text;
  let emails = 0, phones = 0, cards = 0, ssns = 0;

  // Email
  out = out.replace(
    /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    (_, u: string, d: string) => { emails++; return strategies.email === "remove" ? "[EMAIL]" : `${mask(u)}@${d}`; }
  );

  // Phone (basic INTL/US)
  out = out.replace(
    /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3,4}[-.\s]?\d{3,4}/g,
    (m: string) => { phones++; return strategies.phone === "remove" ? "[PHONE]" : mask(m, 0); }
  );

  // Credit card (13-19 digits)
  out = out.replace(
    /\b(?:\d[ -]*?){13,19}\b/g,
    (m: string) => { cards++; return strategies.cc === "remove" ? "[CARD]" : mask(m.replace(/\s|-/g, "")); }
  );

  // SSN-like (US style)
  out = out.replace(
    /\b\d{3}-\d{2}-\d{4}\b/g,
    (m: string) => { ssns++; return strategies.ssn === "remove" ? "[SSN]" : mask(m, 0); }
  );

  return {
    redactedText: out,
    stats: { emails, phones, cards, ssns }
  };
});
