export type Chunk = {
  id: string;
  text: string;
  index: number;
  meta?: Record<string, unknown>;
};

/**
 * Splits text into chunks for processing
 * TODO: implement smart chunking (sentence boundaries, semantic units, etc.)
 */
export function chunkText(
  text: string,
  options: {
    maxChunkSize?: number;
    overlap?: number;
  } = {}
): Chunk[] {
  const maxSize = options.maxChunkSize ?? 512;
  const overlap = options.overlap ?? 50;

  const chunks: Chunk[] = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + maxSize, text.length);
    const chunkText = text.slice(startIndex, endIndex);

    chunks.push({
      id: `chunk_${chunkIndex}`,
      text: chunkText,
      index: chunkIndex,
      meta: {
        startChar: startIndex,
        endChar: endIndex,
      },
    });

    chunkIndex++;
    startIndex += maxSize - overlap;
  }

  console.log(`[chunker] split text (${text.length} chars) into ${chunks.length} chunks`);
  return chunks;
}

/**
 * Merges chunks back into a single text
 */
export function mergeChunks(chunks: Chunk[]): string {
  return chunks
    .sort((a, b) => a.index - b.index)
    .map((c) => c.text)
    .join(" ");
}
