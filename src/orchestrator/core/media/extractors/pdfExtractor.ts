// orchestrator/core/media/extractors/pdfExtractor.ts
// Phase 171: PDF Content Extractor

import type { MediaInput, ExtractedContent } from '../mediaTypes';

/**
 * PDF validation result
 */
export interface PDFValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * PDF extraction options
 */
export interface PDFExtractionOptions {
  /** Maximum pages to extract */
  maxPages?: number;
  /** Whether to extract images (not implemented yet) */
  extractImages?: boolean;
  /** Page range to extract */
  pageRange?: { start: number; end: number };
}

/**
 * Maximum PDF size (50MB)
 */
export const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Validate PDF input
 */
export function validatePDF(input: MediaInput): PDFValidationResult {
  const warnings: string[] = [];

  // Check MIME type
  if (input.mimeType !== 'application/pdf') {
    return {
      valid: false,
      error: `Expected PDF file, got: ${input.mimeType}`,
    };
  }

  // Check size
  if (input.sizeBytes && input.sizeBytes > MAX_PDF_SIZE_BYTES) {
    return {
      valid: false,
      error: `PDF too large: ${(input.sizeBytes / 1024 / 1024).toFixed(2)}MB. Maximum: 50MB`,
    };
  }

  // Warnings for large PDFs
  if (input.sizeBytes && input.sizeBytes > 10 * 1024 * 1024) {
    warnings.push('Large PDF may take longer to process');
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Extract text content from PDF using pdf-parse
 */
export async function extractPDFContent(
  input: MediaInput,
  options: PDFExtractionOptions = {}
): Promise<ExtractedContent> {
  // Validate
  const validation = validatePDF(input);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Convert base64 to buffer
  let pdfBuffer: Buffer;
  if (input.contentType === 'base64') {
    let base64 = input.content;
    // Strip data URL prefix if present
    if (base64.startsWith('data:')) {
      const commaIndex = base64.indexOf(',');
      if (commaIndex !== -1) {
        base64 = base64.slice(commaIndex + 1);
      }
    }
    pdfBuffer = Buffer.from(base64, 'base64');
  } else if (input.contentType === 'url') {
    const response = await fetch(input.content);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF from URL: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    pdfBuffer = Buffer.from(arrayBuffer);
  } else {
    throw new Error(`Unsupported content type for PDF: ${input.contentType}`);
  }

  try {
    // Phase 170.4: Use pdfjs-dist directly (works with Next.js without canvas dependency)
    // Phase 171.3: Fix "Object.defineProperty called on non-object" error in Next.js
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // Convert Buffer to Uint8Array for pdfjs-dist
    const uint8Array = new Uint8Array(pdfBuffer);

    // Load the PDF document with minimal configuration
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      // Disable all features that might cause issues in Next.js
      disableFontFace: true,
      disableRange: true,
      disableStream: true,
    });

    const pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;

    console.log('[PDFExtractor] PDF loaded with', pageCount, 'pages');

    // Combine all text from pages
    const textParts: string[] = [];

    // Apply maxPages limit if specified
    const maxPages = options.maxPages && options.maxPages > 0
      ? Math.min(options.maxPages, pageCount)
      : pageCount;

    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();

        // Extract text items and join them
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .filter((str: string) => str.trim())
          .join(' ');

        if (pageText.trim()) {
          textParts.push(pageText);
        }
      } catch (pageError: any) {
        console.warn(`[PDFExtractor] Error extracting page ${i}:`, pageError.message);
        // Continue with other pages
      }
    }

    const fullText = textParts.join('\n\n');
    const language = detectLanguage(fullText);

    console.log('[PDFExtractor] Extracted:', {
      pageCount,
      pagesProcessed: maxPages,
      textLength: fullText.length,
      language,
    });

    return {
      text: fullText,
      language,
      pageCount,
      metadata: {
        extractionMethod: 'pdfjs-dist',
        filename: input.filename,
        sizeBytes: input.sizeBytes || pdfBuffer.length,
        validationWarnings: validation.warnings,
      },
    };
  } catch (error: any) {
    // Try fallback extraction if pdfjs-dist fails
    console.warn('[PDFExtractor] pdfjs-dist failed, trying fallback:', error.message);
    const text = extractTextFromPDFBuffer(pdfBuffer);
    if (text && text.length > 50) {
      return {
        text,
        language: detectLanguage(text),
        pageCount: undefined,
        metadata: {
          extractionMethod: 'fallback',
          filename: input.filename,
          sizeBytes: input.sizeBytes || pdfBuffer.length,
        },
      };
    }

    console.error('[PDFExtractor] Error:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

/**
 * Phase 170.3: Basic PDF text extraction fallback
 * Extracts raw text from PDF buffer using simple pattern matching
 * This is a fallback when pdf-parse doesn't work in Next.js environment
 */
function extractTextFromPDFBuffer(buffer: Buffer): string | null {
  try {
    const content = buffer.toString('binary');

    // Look for text streams in PDF
    const textMatches: string[] = [];

    // Pattern 1: BT...ET blocks (text objects)
    const btEtPattern = /BT\s*([\s\S]*?)\s*ET/g;
    let match;
    while ((match = btEtPattern.exec(content)) !== null) {
      const textBlock = match[1];
      // Extract text from Tj and TJ operators
      const tjPattern = /\(([^)]*)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjPattern.exec(textBlock)) !== null) {
        const text = tjMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');
        if (text.trim()) {
          textMatches.push(text);
        }
      }
    }

    // Pattern 2: Look for readable ASCII text sequences
    const asciiPattern = /[\x20-\x7E]{20,}/g;
    const asciiMatches = content.match(asciiPattern) || [];
    for (const ascii of asciiMatches) {
      if (!ascii.includes('obj') && !ascii.includes('stream') &&
          !ascii.includes('endobj') && !ascii.includes('xref')) {
        textMatches.push(ascii);
      }
    }

    if (textMatches.length > 0) {
      return textMatches.join(' ').trim();
    }

    return null;
  } catch (e) {
    console.warn('[PDFExtractor] Fallback extraction failed:', e);
    return null;
  }
}

/**
 * Simple language detection based on character patterns
 */
function detectLanguage(text: string): string {
  if (!text || text.length < 10) return 'unknown';

  // Arabic characters
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';

  // Chinese characters
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';

  // Japanese (Hiragana, Katakana)
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja';

  // Korean
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';

  // Hebrew
  if (/[\u0590-\u05FF]/.test(text)) return 'he';

  // Russian/Cyrillic
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';

  // Default to English for Latin scripts
  return 'en';
}

/**
 * Extract specific page range from PDF
 */
export async function extractPDFPages(
  input: MediaInput,
  startPage: number,
  endPage: number
): Promise<ExtractedContent> {
  return extractPDFContent(input, {
    pageRange: { start: startPage, end: endPage },
    maxPages: endPage - startPage + 1,
  });
}

/**
 * Get PDF metadata without full text extraction
 */
export async function getPDFMetadata(input: MediaInput): Promise<{
  pageCount: number;
  info: Record<string, unknown>;
  sizeBytes: number;
}> {
  const validation = validatePDF(input);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  let pdfBuffer: Buffer;
  if (input.contentType === 'base64') {
    let base64 = input.content;
    if (base64.startsWith('data:')) {
      base64 = base64.slice(base64.indexOf(',') + 1);
    }
    pdfBuffer = Buffer.from(base64, 'base64');
  } else {
    throw new Error('URL-based metadata extraction not implemented');
  }

  try {
    const pdfParse = await import('pdf-parse');
    const pdf = pdfParse.default || pdfParse;

    // Parse just first page for metadata
    const data = await pdf(pdfBuffer, { max: 1 });

    return {
      pageCount: data.numpages,
      info: data.info || {},
      sizeBytes: pdfBuffer.length,
    };
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND') {
      return {
        pageCount: 0,
        info: { error: 'pdf-parse not installed' },
        sizeBytes: pdfBuffer.length,
      };
    }
    throw error;
  }
}

/**
 * Check if PDF contains mostly images (scanned document)
 * This is a heuristic - may not be 100% accurate
 */
export async function isScannedPDF(input: MediaInput): Promise<boolean> {
  try {
    const content = await extractPDFContent(input, { maxPages: 3 });

    if (!content.text) return true;

    // If text is very sparse relative to page count, likely scanned
    const textLength = content.text.replace(/\s+/g, '').length;
    const pageCount = content.pageCount || 1;
    const avgCharsPerPage = textLength / pageCount;

    // Less than 100 chars per page suggests scanned/image-based
    return avgCharsPerPage < 100;
  } catch {
    return false;
  }
}

/**
 * Chunk PDF text for processing large documents
 */
export function chunkPDFText(
  text: string,
  maxChunkSize: number = 4000,
  overlap: number = 200
): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChunkSize;

    // Try to break at paragraph or sentence boundary
    if (end < text.length) {
      // Look for paragraph break
      const paragraphBreak = text.lastIndexOf('\n\n', end);
      if (paragraphBreak > start + maxChunkSize / 2) {
        end = paragraphBreak;
      } else {
        // Look for sentence break
        const sentenceBreak = text.lastIndexOf('. ', end);
        if (sentenceBreak > start + maxChunkSize / 2) {
          end = sentenceBreak + 1;
        }
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
  }

  return chunks;
}
