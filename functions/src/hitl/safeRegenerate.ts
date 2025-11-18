import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

/**
 * ملاحظة: إن كان لديك مزوّد LLM داخلي، استبدل callSafeModel() باستدعائك الخاص.
 * في حالة عدم الضبط، نستخدم Fallback Sanitizer: تعقيم كلمات سامة + تقصير + استدعاء redactPII داخلي.
 */

const TOXIC_WORDS = ["idiot","stupid","kill","hate","bomb","rape"];

async function callSafeModel(prompt: string): Promise<string | null> {
  // TODO: integrate with your LLM provider here (OpenAI/Vertex/etc.)
  // Return null to fall back if not configured.
  return null;
}

function heuristicSanitize(input: string, maxLen = 1200) {
  let t = input;
  for (const w of TOXIC_WORDS) {
    const re = new RegExp(`\\b${w}\\b`, "gi");
    t = t.replace(re, "[REDACTED]");
  }
  if (t.length > maxLen) t = t.slice(0, maxLen) + "…";
  return t;
}

export const safeRegenerate = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");

  const payload = request.data;
  const text = (payload?.text ?? "") as string;
  const prompt = (payload?.prompt ?? "") as string;
  const maxLen = Number(payload?.policy?.maxLen ?? 1200);

  if (!text && !prompt) {
    throw new HttpsError("invalid-argument", "text or prompt required");
  }

  // 1) حاول استخدام مزوّد LLM (لو متاح)
  const modelOut = await callSafeModel(
    `You are a safety rewriter. Remove PII, mask sensitive tokens, avoid toxicity, keep meaning.\nInput:\n${text || prompt}\nOutput (plain):`
  );

  let safeText = modelOut ?? heuristicSanitize(text || prompt, maxLen);

  // 2) PII pass (إعادة تمرير عبر تعمية بسيطة)
  // بديل سريع عن استدعاء callable redactPII: Regex محلي
  safeText = safeText
    .replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "[EMAIL]")
    .replace(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3,4}[-.\s]?\d{3,4}/g, "[PHONE]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[CARD]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

  // 3) اختياري: قيّم النص الآمن وسجّل نتيجة (يعتمد على Sprint 13)
  try {
    const db = admin.firestore();
    await db.collection("audit_logs").add({
      ts: Date.now(),
      actor: request.auth.uid,
      kind: "hitl_safe_regen",
      meta: { len: safeText.length }
    });
  } catch { /* ignore */ }

  return {
    safeText,
    used: modelOut ? "model" : "fallback"
  };
});
