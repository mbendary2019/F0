// src/lib/ai/context/queryOptimizer.ts
// Intent classification, language detection, keyword expansion, and normalized query string

import OpenAI from "openai";

export type OptimizeInput = {
  text: string;
  preferLang?: "ar" | "en" | string;
  model?: string;
};

export type OptimizeResult = {
  language: string;
  intent: string;
  entities: string[];
  keywords: string[];
  normalizedQuery: string;
};

const SYS = `You classify user queries for better retrieval and routing.\nExplain nothing; output strict JSON.`;

export async function optimizeQuery({
  text,
  preferLang = "en",
  model = "gpt-4o-mini",
}: OptimizeInput): Promise<OptimizeResult> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const user = [
    `Text: ${text}`,
    `PreferredLanguage: ${preferLang}`,
    `JSON schema: {"language":"string","intent":"string","entities":["string"],"keywords":["string"],"normalizedQuery":"string"}`,
  ].join("\n");

  const res = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYS },
      { role: "user", content: user },
    ],
  });

  const raw = res.choices?.[0]?.message?.content || "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {}

  return {
    language: typeof parsed.language === "string" ? parsed.language : preferLang,
    intent: typeof parsed.intent === "string" ? parsed.intent : "general",
    entities: Array.isArray(parsed.entities)
      ? parsed.entities.filter(Boolean)
      : [],
    keywords: Array.isArray(parsed.keywords)
      ? parsed.keywords.filter(Boolean)
      : [],
    normalizedQuery:
      typeof parsed.normalizedQuery === "string" && parsed.normalizedQuery.trim()
        ? parsed.normalizedQuery.trim()
        : text.trim(),
  };
}
