// orchestrator/core/media/formatters/chatFormatter.ts
// =============================================================================
// Phase 160.3 – Chat Formatter for Media Analysis
// Separates raw extraction from formatted chat display
// =============================================================================

import type {
  MediaAnalysisType,
  AnalysisTypeRecord,
  AttachmentMediaAnalysis,
} from '../types';

/**
 * Phase 160.3: Formatted chat message result
 */
export interface FormattedChatMessage {
  locale: 'ar' | 'en';
  message: string;
  ts: string;
  /** Source analysis types used */
  sources: MediaAnalysisType[];
  /** Extraction strength classification */
  strength: 'STRONG' | 'WEAK' | 'EMPTY';
  /** Raw text length used for classification */
  rawTextLen: number;
}

/**
 * Phase 160.3: Extraction strength thresholds
 */
const EXTRACTION_THRESHOLDS = {
  STRONG: 1200,  // >= 1200 chars = reliable extraction
  WEAK: 250,     // 250-1199 chars = partial extraction
  // < 250 chars = EMPTY
};

/**
 * Classify extraction strength based on raw text length
 */
export function classifyExtractionStrength(
  rawTextLen: number
): 'STRONG' | 'WEAK' | 'EMPTY' {
  if (rawTextLen >= EXTRACTION_THRESHOLDS.STRONG) return 'STRONG';
  if (rawTextLen >= EXTRACTION_THRESHOLDS.WEAK) return 'WEAK';
  return 'EMPTY';
}

/**
 * Phase 160.3: Format analysis for chat display
 *
 * Key principle: Raw extraction data stays in AnalysisTypeRecord,
 * this function creates a SEPARATE formatted message for chat UI.
 */
export function formatAnalysisForChat(
  analysis: AttachmentMediaAnalysis,
  filename: string,
  locale: 'ar' | 'en' = 'ar'
): FormattedChatMessage {
  const sources: MediaAnalysisType[] = [];
  let rawText = '';

  // Collect raw text from all available analysis types
  if (analysis.extract_text?.status === 'READY' && analysis.extract_text.text) {
    sources.push('extract_text');
    rawText += analysis.extract_text.text;
  }
  if (analysis.ocr?.status === 'READY' && analysis.ocr.text) {
    sources.push('ocr');
    if (!rawText) rawText = analysis.ocr.text;
  }
  if (analysis.describe?.status === 'READY' && analysis.describe.description) {
    sources.push('describe');
  }
  if (analysis.summarize?.status === 'READY' && analysis.summarize.summary) {
    sources.push('summarize');
  }

  const rawTextLen = rawText.trim().length;
  const strength = classifyExtractionStrength(rawTextLen);

  // Format message based on locale and strength
  const message = locale === 'ar'
    ? formatChatMessageAr(analysis, filename, strength, rawTextLen)
    : formatChatMessageEn(analysis, filename, strength, rawTextLen);

  return {
    locale,
    message,
    ts: new Date().toISOString(),
    sources,
    strength,
    rawTextLen,
  };
}

/**
 * Arabic chat message formatter
 */
function formatChatMessageAr(
  analysis: AttachmentMediaAnalysis,
  filename: string,
  strength: 'STRONG' | 'WEAK' | 'EMPTY',
  rawTextLen: number
): string {
  const lines: string[] = [];

  lines.push(`📄 **تحليل الملف: \`${filename}\`**`);
  lines.push('');

  // Show extraction strength warning if not STRONG
  if (strength === 'EMPTY') {
    lines.push('⚠️ **تنبيه:** لم يتم استخراج نص كافٍ من هذا الملف.');
    lines.push('قد يكون الملف صورة ممسوحة ضوئياً أو محمياً.');
    lines.push('');
  } else if (strength === 'WEAK') {
    lines.push(`⚠️ **تنبيه:** استخراج جزئي فقط (${rawTextLen} حرف).`);
    lines.push('');
  }

  // Page count
  const pageCount = analysis.extract_text?.pageCount || analysis.ocr?.pageCount;
  if (pageCount) {
    lines.push(`📑 عدد الصفحات: ${pageCount}`);
  }

  // Summary (if available and strong enough)
  if (strength !== 'EMPTY' && analysis.summarize?.status === 'READY' && analysis.summarize.summary) {
    lines.push('');
    lines.push('**📝 الملخص:**');
    lines.push('');
    lines.push(analysis.summarize.summary);
  }

  // Description (for images)
  if (analysis.describe?.status === 'READY' && analysis.describe.description) {
    lines.push('');
    lines.push('**🖼️ وصف الصورة:**');
    lines.push('');
    lines.push(analysis.describe.description);
  }

  // Extracted text preview (only if STRONG)
  if (strength === 'STRONG') {
    const text = analysis.extract_text?.text || analysis.ocr?.text || '';
    if (text.length > 500) {
      lines.push('');
      lines.push('**📄 معاينة النص المستخرج:**');
      lines.push('');
      lines.push('```');
      lines.push(text.slice(0, 500) + '...');
      lines.push('```');
    }
  }

  return lines.join('\n');
}

/**
 * English chat message formatter
 */
function formatChatMessageEn(
  analysis: AttachmentMediaAnalysis,
  filename: string,
  strength: 'STRONG' | 'WEAK' | 'EMPTY',
  rawTextLen: number
): string {
  const lines: string[] = [];

  lines.push(`📄 **File Analysis: \`${filename}\`**`);
  lines.push('');

  // Show extraction strength warning if not STRONG
  if (strength === 'EMPTY') {
    lines.push('⚠️ **Warning:** Insufficient text extracted from this file.');
    lines.push('The file may be a scanned image or protected.');
    lines.push('');
  } else if (strength === 'WEAK') {
    lines.push(`⚠️ **Warning:** Partial extraction only (${rawTextLen} chars).`);
    lines.push('');
  }

  // Page count
  const pageCount = analysis.extract_text?.pageCount || analysis.ocr?.pageCount;
  if (pageCount) {
    lines.push(`📑 Pages: ${pageCount}`);
  }

  // Summary (if available and strong enough)
  if (strength !== 'EMPTY' && analysis.summarize?.status === 'READY' && analysis.summarize.summary) {
    lines.push('');
    lines.push('**📝 Summary:**');
    lines.push('');
    lines.push(analysis.summarize.summary);
  }

  // Description (for images)
  if (analysis.describe?.status === 'READY' && analysis.describe.description) {
    lines.push('');
    lines.push('**🖼️ Image Description:**');
    lines.push('');
    lines.push(analysis.describe.description);
  }

  // Extracted text preview (only if STRONG)
  if (strength === 'STRONG') {
    const text = analysis.extract_text?.text || analysis.ocr?.text || '';
    if (text.length > 500) {
      lines.push('');
      lines.push('**📄 Extracted Text Preview:**');
      lines.push('');
      lines.push('```');
      lines.push(text.slice(0, 500) + '...');
      lines.push('```');
    }
  }

  return lines.join('\n');
}

/**
 * Phase 160.3: Build AttachmentMediaAnalysis from individual results
 */
export function buildMediaAnalysisRecord(
  results: Array<{
    type: MediaAnalysisType;
    success: boolean;
    data?: {
      text?: string;
      description?: string;
      summary?: string;
      embeddingsRef?: string;
      pageCount?: number;
      language?: string;
    };
    error?: string;
    provider?: string;
  }>
): AttachmentMediaAnalysis {
  const analysis: AttachmentMediaAnalysis = {};

  for (const result of results) {
    const record: AnalysisTypeRecord = {
      status: result.success ? 'READY' : 'FAILED',
      ts: new Date().toISOString(),
      provider: result.provider,
      error: result.error,
    };

    if (result.success && result.data) {
      record.text = result.data.text;
      record.description = result.data.description;
      record.summary = result.data.summary;
      record.embeddingsRef = result.data.embeddingsRef;
      record.pageCount = result.data.pageCount;
    }

    switch (result.type) {
      case 'describe':
        analysis.describe = record;
        break;
      case 'ocr':
        analysis.ocr = record;
        break;
      case 'extract_text':
        analysis.extract_text = record;
        break;
      case 'summarize':
        analysis.summarize = record;
        break;
      case 'embed':
        analysis.embed = {
          ...record,
          // Could add model/dims here if available
        };
        break;
    }
  }

  return analysis;
}

/**
 * Phase 160.3: Update formattedForChat on AttachmentMediaAnalysis
 */
export function updateFormattedForChat(
  analysis: AttachmentMediaAnalysis,
  filename: string,
  locale: 'ar' | 'en' = 'ar'
): AttachmentMediaAnalysis {
  const formatted = formatAnalysisForChat(analysis, filename, locale);

  return {
    ...analysis,
    formattedForChat: {
      locale: formatted.locale,
      message: formatted.message,
      ts: formatted.ts,
    },
  };
}

console.log('[160.3][FORMATTER] Chat formatter module loaded');
