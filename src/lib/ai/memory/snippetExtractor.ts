// src/lib/ai/memory/snippetExtractor.ts
// Extract compact snippets from memory items for contextualization.
// Lightweight splitter → sentences or bullet lines; optional filters.

export type MemoryRecord = {
  id: string;
  text: string;
  createdAt?: number | Date;
  metadata?: Record<string, unknown>;
};

export type Snippet = {
  id: string; // Unique snippet ID: "memoryId#hash"
  src: string; // Source memory ID
  text: string; // Snippet text
  metadata?: {
    position?: number; // Position in source text
    type?: "sentence" | "bullet" | "paragraph";
    createdAt?: number;
  };
};

export type ExtractParams = {
  maxPerItem?: number; // Max snippets per memory item (default: 3)
  minLen?: number; // Min characters per snippet (default: 24)
  maxLen?: number; // Max characters per snippet (default: 320)
  dedupe?: boolean; // Remove duplicate snippets (default: true)
  preserveFormatting?: boolean; // Keep markdown formatting (default: false)
};

const DEFAULT_PARAMS: Required<Omit<ExtractParams, "preserveFormatting">> & {
  preserveFormatting: boolean;
} = {
  maxPerItem: 3,
  minLen: 24,
  maxLen: 320,
  dedupe: true,
  preserveFormatting: false,
};

/**
 * Extract snippets from memory records
 *
 * @param records - Array of memory records
 * @param params - Extraction parameters
 * @returns Array of snippets with metadata
 *
 * @example
 * ```typescript
 * const snippets = extractSnippets([
 *   { id: "m1", text: "Fixed deploy bug. Canary rollout succeeded." }
 * ], { maxPerItem: 2, maxLen: 200 });
 *
 * // Returns:
 * // [
 * //   { id: "m1#abc123", src: "m1", text: "Fixed deploy bug." },
 * //   { id: "m1#def456", src: "m1", text: "Canary rollout succeeded." }
 * // ]
 * ```
 */
export function extractSnippets(
  records: MemoryRecord[],
  params: ExtractParams = {}
): Snippet[] {
  const opt = { ...DEFAULT_PARAMS, ...params };
  const out: Snippet[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    if (!record.text) continue;

    const chunks = splitText(record.text, opt.preserveFormatting);
    const filtered = chunks
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length >= opt.minLen && chunk.length <= opt.maxLen)
      .slice(0, opt.maxPerItem);

    for (let i = 0; i < filtered.length; i++) {
      const text = filtered[i];
      const key = normalizeForDedup(text);

      if (opt.dedupe && seen.has(key)) continue;
      seen.add(key);

      const snippet: Snippet = {
        id: `${record.id}#${hashString(text)}`,
        src: record.id,
        text,
        metadata: {
          position: i,
          type: detectType(text),
          createdAt:
            typeof record.createdAt === "number"
              ? record.createdAt
              : record.createdAt instanceof Date
              ? record.createdAt.getTime()
              : Date.now(),
        },
      };

      out.push(snippet);
    }
  }

  return out;
}

/**
 * Split text into chunks (sentences, bullets, paragraphs)
 */
function splitText(text: string, preserveFormatting: boolean): string[] {
  if (!text) return [];

  // Handle bullet points and numbered lists
  const bulletPattern = /(?:^|\n)[\s]*(?:[•\-\*]|(?:\d+\.)|(?:[a-z]\)))\s+/g;
  const bullets = text.split(bulletPattern).filter(Boolean);

  const chunks: string[] = [];

  for (const bullet of bullets) {
    // Split by sentence boundaries
    // Handles both English and Arabic punctuation
    const sentences = bullet.split(/(?<=[.!؟?؛;])\s+/g);

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed) {
        chunks.push(
          preserveFormatting ? trimmed : stripMarkdown(trimmed)
        );
      }
    }
  }

  return chunks;
}

/**
 * Detect snippet type based on content
 */
function detectType(text: string): "sentence" | "bullet" | "paragraph" {
  if (/^[\s]*(?:[•\-\*]|(?:\d+\.)|(?:[a-z]\)))/.test(text)) {
    return "bullet";
  }
  if (text.length > 200 || text.split(/[.!؟?]/).length > 3) {
    return "paragraph";
  }
  return "sentence";
}

/**
 * Strip markdown formatting from text
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1") // Bold
    .replace(/\*(.+?)\*/g, "$1") // Italic
    .replace(/`(.+?)`/g, "$1") // Code
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // Links
    .replace(/^#+\s+/gm, "") // Headers
    .trim();
}

/**
 * Normalize text for deduplication
 */
function normalizeForDedup(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/[^\w\s\u0600-\u06FF]/g, "") // Keep alphanumeric + Arabic
    .trim();
}

/**
 * Simple hash function for generating snippet IDs
 */
function hashString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Group snippets by source memory
 */
export function groupBySource(snippets: Snippet[]): Map<string, Snippet[]> {
  const grouped = new Map<string, Snippet[]>();

  for (const snippet of snippets) {
    const existing = grouped.get(snippet.src) || [];
    existing.push(snippet);
    grouped.set(snippet.src, existing);
  }

  return grouped;
}

/**
 * Filter snippets by minimum relevance score
 */
export function filterByRelevance(
  snippets: Snippet[],
  scores: Map<string, number>,
  minScore: number
): Snippet[] {
  return snippets.filter((s) => (scores.get(s.id) || 0) >= minScore);
}

/**
 * Sort snippets by creation time (newest first)
 */
export function sortByRecency(snippets: Snippet[]): Snippet[] {
  return [...snippets].sort((a, b) => {
    const aTime = a.metadata?.createdAt || 0;
    const bTime = b.metadata?.createdAt || 0;
    return bTime - aTime;
  });
}

/**
 * Truncate snippet text to maximum length
 */
export function truncateSnippet(
  text: string,
  maxLen: number,
  ellipsis = "..."
): string {
  if (text.length <= maxLen) return text;

  // Try to break at sentence boundary
  const truncated = text.substring(0, maxLen - ellipsis.length);
  const lastPunct = Math.max(
    truncated.lastIndexOf("."),
    truncated.lastIndexOf("!"),
    truncated.lastIndexOf("؟"),
    truncated.lastIndexOf("?")
  );

  if (lastPunct > maxLen * 0.7) {
    return truncated.substring(0, lastPunct + 1);
  }

  // Break at word boundary
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.7) {
    return truncated.substring(0, lastSpace) + ellipsis;
  }

  return truncated + ellipsis;
}

/**
 * Batch extract snippets from multiple memory sets
 */
export async function batchExtractSnippets(
  recordSets: MemoryRecord[][],
  params: ExtractParams = {}
): Promise<Snippet[][]> {
  return recordSets.map((records) => extractSnippets(records, params));
}

/**
 * Extract snippets with token budgeting
 */
export function extractSnippetsWithBudget(
  records: MemoryRecord[],
  maxTokens: number,
  params: ExtractParams = {}
): { snippets: Snippet[]; tokensUsed: number } {
  const allSnippets = extractSnippets(records, params);
  const selected: Snippet[] = [];
  let tokensUsed = 0;

  for (const snippet of allSnippets) {
    // Simple token estimation: ~4 chars per token
    const tokens = Math.ceil(snippet.text.length / 4);

    if (tokensUsed + tokens <= maxTokens) {
      selected.push(snippet);
      tokensUsed += tokens;
    } else {
      break;
    }
  }

  return { snippets: selected, tokensUsed };
}
