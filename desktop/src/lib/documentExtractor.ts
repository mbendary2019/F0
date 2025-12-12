/**
 * Phase 168.5: Document Content Extraction
 * Extract text content from PDF, Word, and Excel files
 * for use with the AI Agent (since GPT-4o Vision only supports images)
 */

// PDF.js will be loaded dynamically in Electron
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const pdfjsLib: any;

/**
 * Extracted document content
 */
export interface ExtractedDocument {
  name: string;
  type: 'pdf' | 'word' | 'excel' | 'audio' | 'unknown';
  text: string;
  metadata?: {
    pageCount?: number;
    author?: string;
    title?: string;
    sheetCount?: number;
    duration?: string;
  };
}

/**
 * Check if file type is supported for text extraction
 */
export function isExtractableDocument(fileName: string, mimeType: string): boolean {
  const ext = fileName.toLowerCase().split('.').pop() || '';

  // PDF
  if (mimeType === 'application/pdf' || ext === 'pdf') return true;

  // Word
  if (mimeType.includes('word') || ext === 'doc' || ext === 'docx') return true;

  // Excel
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') ||
      ext === 'xls' || ext === 'xlsx') return true;

  // Audio - can't extract text, but can describe
  if (mimeType.startsWith('audio/') ||
      ['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) return true;

  return false;
}

/**
 * Get document type from file
 */
export function getDocumentType(fileName: string, mimeType: string): ExtractedDocument['type'] {
  const ext = fileName.toLowerCase().split('.').pop() || '';

  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mimeType.includes('word') || ext === 'doc' || ext === 'docx') return 'word';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') ||
      ext === 'xls' || ext === 'xlsx') return 'excel';
  if (mimeType.startsWith('audio/') ||
      ['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) return 'audio';

  return 'unknown';
}

/**
 * Extract text from PDF using PDF.js
 * Note: PDF.js needs to be loaded in the Electron renderer
 */
export async function extractPdfText(base64Data: string): Promise<{ text: string; pageCount: number }> {
  try {
    // Check if PDF.js is available
    if (typeof pdfjsLib === 'undefined') {
      console.warn('[DocumentExtractor] PDF.js not loaded, using fallback');
      return {
        text: '[PDF content - text extraction not available in this environment]',
        pageCount: 0,
      };
    }

    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Load PDF document
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const pageCount = pdf.numPages;

    // Extract text from all pages
    const textParts: string[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      textParts.push(`--- Page ${i} ---\n${pageText}`);
    }

    return {
      text: textParts.join('\n\n'),
      pageCount,
    };
  } catch (error) {
    console.error('[DocumentExtractor] PDF extraction error:', error);
    return {
      text: '[Error extracting PDF text]',
      pageCount: 0,
    };
  }
}

/**
 * Extract text from Word document (.docx)
 * Uses mammoth.js for DOCX parsing
 */
export async function extractWordText(base64Data: string): Promise<string> {
  try {
    // For DOCX files, we can use mammoth.js
    // Check if mammoth is available (needs to be loaded)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mammoth = (window as any).mammoth;

    if (!mammoth) {
      console.warn('[DocumentExtractor] mammoth.js not loaded, using fallback');
      return '[Word document content - text extraction requires mammoth.js]';
    }

    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
    return result.value || '[No text content found in Word document]';
  } catch (error) {
    console.error('[DocumentExtractor] Word extraction error:', error);
    return '[Error extracting Word document text]';
  }
}

/**
 * Extract text from Excel file (.xlsx)
 * Uses SheetJS (xlsx) for parsing
 */
export async function extractExcelText(base64Data: string): Promise<{ text: string; sheetCount: number }> {
  try {
    // Check if XLSX is available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const XLSX = (window as any).XLSX;

    if (!XLSX) {
      console.warn('[DocumentExtractor] SheetJS not loaded, using fallback');
      return {
        text: '[Excel spreadsheet content - text extraction requires SheetJS]',
        sheetCount: 0,
      };
    }

    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Parse workbook
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheetCount = workbook.SheetNames.length;

    // Extract text from all sheets
    const textParts: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      textParts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
    }

    return {
      text: textParts.join('\n\n'),
      sheetCount,
    };
  } catch (error) {
    console.error('[DocumentExtractor] Excel extraction error:', error);
    return {
      text: '[Error extracting Excel spreadsheet text]',
      sheetCount: 0,
    };
  }
}

/**
 * Get audio file description (can't extract text from audio)
 */
export function describeAudioFile(fileName: string, mimeType: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  const format = ext.toUpperCase() || mimeType.split('/')[1]?.toUpperCase() || 'Unknown';

  return `[Audio file: ${fileName}]\nFormat: ${format}\n\nNote: Audio transcription is not currently supported. To discuss this audio file, please describe what you'd like to know about it.`;
}

/**
 * Main function: Extract document content based on file type
 */
export async function extractDocumentContent(
  fileName: string,
  base64Data: string,
  mimeType: string
): Promise<ExtractedDocument> {
  const docType = getDocumentType(fileName, mimeType);

  switch (docType) {
    case 'pdf': {
      const { text, pageCount } = await extractPdfText(base64Data);
      return {
        name: fileName,
        type: 'pdf',
        text,
        metadata: { pageCount },
      };
    }

    case 'word': {
      const text = await extractWordText(base64Data);
      return {
        name: fileName,
        type: 'word',
        text,
      };
    }

    case 'excel': {
      const { text, sheetCount } = await extractExcelText(base64Data);
      return {
        name: fileName,
        type: 'excel',
        text,
        metadata: { sheetCount },
      };
    }

    case 'audio': {
      return {
        name: fileName,
        type: 'audio',
        text: describeAudioFile(fileName, mimeType),
      };
    }

    default:
      return {
        name: fileName,
        type: 'unknown',
        text: `[Unsupported file type: ${fileName}]`,
      };
  }
}

/**
 * Format extracted document for Agent context
 */
export function formatDocumentForAgent(doc: ExtractedDocument, locale: 'ar' | 'en'): string {
  const typeLabels = {
    ar: { pdf: 'ملف PDF', word: 'مستند Word', excel: 'جدول Excel', audio: 'ملف صوتي', unknown: 'ملف' },
    en: { pdf: 'PDF Document', word: 'Word Document', excel: 'Excel Spreadsheet', audio: 'Audio File', unknown: 'File' },
  };

  const label = typeLabels[locale][doc.type];

  let header = locale === 'ar'
    ? `📎 **${label}:** \`${doc.name}\``
    : `📎 **${label}:** \`${doc.name}\``;

  // Add metadata
  if (doc.metadata?.pageCount) {
    header += locale === 'ar'
      ? ` (${doc.metadata.pageCount} صفحات)`
      : ` (${doc.metadata.pageCount} pages)`;
  }
  if (doc.metadata?.sheetCount) {
    header += locale === 'ar'
      ? ` (${doc.metadata.sheetCount} أوراق)`
      : ` (${doc.metadata.sheetCount} sheets)`;
  }

  // Truncate very long text
  const maxLength = 15000;
  let content = doc.text;
  if (content.length > maxLength) {
    content = content.slice(0, maxLength) + '\n\n... [Truncated for brevity]';
  }

  return `${header}\n\n\`\`\`\n${content}\n\`\`\``;
}
