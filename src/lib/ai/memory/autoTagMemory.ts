// src/lib/ai/memory/autoTagMemory.ts
// LLM-powered auto-tagging + concise title/summary generation for clusters.
// - Deterministic JSON schema output
// - Language-aware (falls back to English)
// - Retries + temperature controls per function

import OpenAI from "openai";

export type ClusterContent = {
  clusterId: string;
  samples: string[]; // representative texts from the cluster (1–10 items)
  locale?: "ar" | "en" | string;
};

export type AutoTagResult = {
  clusterId: string;
  title: string; // short, human-readable
  summary: string; // 1–2 sentences explaining the cluster
  tags: string[]; // 3–7 tags
  confidence: number; // 0..1 self-estimated
};

export type AutoTagParams = {
  model?: string; // e.g. "gpt-4o" or "gpt-4o-mini"
  temperature?: number;
  maxRetries?: number;
  maxTokens?: number;
};

const DEFAULTS: Required<AutoTagParams> = {
  model: "gpt-4o-mini",
  temperature: 0.2,
  maxRetries: 3,
  maxTokens: 600,
};

export class AutoTagger {
  private client: OpenAI;
  private params: Required<AutoTagParams>;

  constructor(client?: OpenAI, params?: AutoTagParams) {
    this.client = client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.params = { ...DEFAULTS, ...(params ?? {}) };
  }

  async run(input: ClusterContent): Promise<AutoTagResult> {
    const { clusterId, samples, locale } = input;
    if (!samples?.length) {
      return {
        clusterId,
        title: "Untitled",
        summary: "No content provided.",
        tags: ["uncategorized"],
        confidence: 0.1,
      };
    }

    const isArabic = locale === "ar" || samples.some((s) => /[\u0600-\u06FF]/.test(s));

    const sys =
      "You are a world-class knowledge organizer. Given a set of related notes/messages, " +
      "produce a compact title, a crisp summary (max 2 sentences), and 3–7 topical tags. " +
      "Return strict JSON only matching the provided schema. Avoid private data or PII. " +
      "Prefer domain-terms like DevOps, Firebase, UI/UX, Marketing, Crypto, Security, Pricing, Roadmap, Analytics, Compliance." +
      (isArabic ? " Respond in Arabic." : "");

    const user = [
      "Notes (<=10):",
      ...samples.map((s, i) => `#${i + 1}: ${s}`),
      "\nOutput schema (JSON):",
      JSON.stringify(
        {
          title: "string",
          summary: "string",
          tags: ["string"],
          confidence: 0.0,
        },
        null,
        2
      ),
      "\nRules:",
      "- Title <= 8 words.",
      "- Summary <= 2 sentences.",
      "- 3–7 tags (lowercase kebab or plain words).",
      isArabic
        ? "- Language: Arabic"
        : "- Language: follow input language if clear; otherwise English.",
    ].join("\n");

    const json = await this.withRetries(async () => {
      const chat = await this.client.chat.completions.create({
        model: this.params.model,
        temperature: this.params.temperature,
        max_tokens: this.params.maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
      });
      return chat.choices?.[0]?.message?.content ?? "{}";
    }, this.params.maxRetries);

    let parsed: {
      title?: string;
      summary?: string;
      tags?: string[];
      confidence?: number;
    } = {};
    try {
      parsed = JSON.parse(json);
    } catch {}

    const title = sanitizeStr(parsed.title, "Untitled Cluster");
    const summary = sanitizeStr(
      parsed.summary,
      "Auto-generated cluster summary."
    );
    const tags = sanitizeTags(parsed.tags ?? ["general"]);
    const confidence = clamp(
      typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
      0,
      1
    );

    return { clusterId, title, summary, tags, confidence };
  }

  // ===== utils =====
  private async withRetries<T>(
    fn: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        const delay = Math.min(2000 * (i + 1), 8000);
        await wait(delay);
      }
    }
    throw lastErr;
  }
}

// ===== helpers =====
function sanitizeStr(s: unknown, fallback: string): string {
  if (typeof s !== "string") return fallback;
  return s.trim().slice(0, 240) || fallback;
}
function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return ["general"];
  const out = tags
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean)
    .slice(0, 7);
  // normalize basic kebab-case (keep simple words too)
  return out.map((t) =>
    /[A-Z]/.test(t) ? t : t.replace(/\s+/g, "-").toLowerCase()
  );
}
function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default AutoTagger;
