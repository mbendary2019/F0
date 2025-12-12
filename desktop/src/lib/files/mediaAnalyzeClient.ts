/**
 * Phase 171: Media Analyze Client
 * Client for calling /api/media/analyze endpoint
 */

export interface MediaAnalyzeRequest {
  kind: 'pdf' | 'image';
  mimeType: string;
  filename: string;
  bytesBase64: string;
  projectId?: string;
  userId?: string;
  locale?: 'ar' | 'en';
}

export interface MediaAnalyzeResult {
  kind: 'pdf' | 'image';
  filename: string;
  summary: string;
  summaryAr?: string;
  pageCount?: number;
  language?: string;
  // Extracted sections/features
  sections?: Array<{
    title: string;
    content: string;
  }>;
  // UI Components inferred from design images
  uiComponents?: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  // Security risks found
  risks?: string[];
  // Suggested next action
  recommendedNextAction?: string;
  // Raw extracted text (for PDFs)
  extractedText?: string;
  // Phase 171.12: Deep extraction fields
  phasesFound?: string[];
  milestones?: string[];
  technicalDetails?: string[];
}

export interface MediaAnalyzeResponse {
  ok: boolean;
  result?: MediaAnalyzeResult;
  error?: string;
}

/**
 * Call the media analyze API
 */
export async function analyzeDroppedMedia(
  apiBase: string,
  payload: MediaAnalyzeRequest
): Promise<MediaAnalyzeResult> {
  const res = await fetch(`${apiBase}/api/media/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Media analyze failed: ${res.status} ${text}`);
  }

  const json: MediaAnalyzeResponse = await res.json();
  if (!json?.ok || !json.result) {
    throw new Error(json.error || 'Media analyze returned ok=false');
  }

  return json.result;
}

/**
 * Format analysis result as a chat message (Arabic)
 * Phase 171.12: Enhanced to show deep extraction fields
 * Phase 171.14: Fixed spacing - use double newlines for proper paragraph separation
 */
export function formatMediaAnalysisAsChatMessageAr(result: MediaAnalyzeResult): string {
  const lines: string[] = [];

  lines.push(`📄 **تحليل تلقائي للملف: \`${result.filename}\`**`);

  if (result.kind === 'pdf' && result.pageCount) {
    lines.push(`📑 عدد الصفحات: ${result.pageCount}`);
  }

  if (result.language) {
    lines.push(`🌐 اللغة: ${result.language === 'ar' ? 'عربي' : result.language === 'en' ? 'إنجليزي' : result.language}`);
  }

  lines.push(''); // blank line before summary
  lines.push('**📝 الملخص:**');
  lines.push('');
  lines.push(result.summaryAr || result.summary);

  // Phase 171.12: Show phases found
  if (result.phasesFound && result.phasesFound.length > 0 && !result.phasesFound.includes('NO_PHASE_DATA_FOUND')) {
    lines.push('');
    lines.push('**🔢 المراحل المستخرجة:**');
    lines.push('');
    for (const phase of result.phasesFound.slice(0, 10)) {
      lines.push(`- ${phase}`);
      lines.push(''); // blank line after each phase
    }
  }

  // Phase 171.12: Show milestones
  if (result.milestones && result.milestones.length > 0) {
    lines.push('');
    lines.push('**🎯 الأهداف والمراحل المهمة:**');
    lines.push('');
    for (const milestone of result.milestones.slice(0, 8)) {
      lines.push(`- ${milestone}`);
      lines.push(''); // blank line after each milestone
    }
  }

  // Phase 171.12: Show technical details
  if (result.technicalDetails && result.technicalDetails.length > 0) {
    lines.push('');
    lines.push('**🔧 التقنيات والأدوات:**');
    lines.push('');
    lines.push(result.technicalDetails.slice(0, 10).join(' • '));
  }

  if (result.sections && result.sections.length > 0) {
    lines.push('');
    lines.push('**📋 الأقسام الرئيسية:**');
    lines.push('');
    for (const section of result.sections.slice(0, 8)) {
      // Phase 171.12: Show more content (300 chars instead of 100)
      lines.push(`- **${section.title}**: ${section.content.slice(0, 300)}${section.content.length > 300 ? '...' : ''}`);
      lines.push(''); // blank line after each section
    }
  }

  if (result.uiComponents && result.uiComponents.length > 0) {
    lines.push('');
    lines.push('**🧩 مكونات UI المستخرجة:**');
    lines.push('');
    for (const comp of result.uiComponents.slice(0, 5)) {
      lines.push(`- \`${comp.name}\` (${comp.type}): ${comp.description}`);
    }
  }

  if (result.risks && result.risks.length > 0) {
    lines.push('');
    lines.push('**⚠️ تحذيرات:**');
    lines.push('');
    for (const risk of result.risks) {
      lines.push(`- ${risk}`);
      lines.push(''); // blank line after each warning
    }
  }

  if (result.recommendedNextAction) {
    lines.push('');
    lines.push(`**➡️ الخطوة التالية المقترحة:**`);
    lines.push('');
    lines.push(result.recommendedNextAction);
  }

  return lines.join('\n');
}

/**
 * Format analysis result as a chat message (English)
 * Phase 171.12: Enhanced to show deep extraction fields
 */
export function formatMediaAnalysisAsChatMessageEn(result: MediaAnalyzeResult): string {
  const lines: string[] = [];

  lines.push(`📄 **Auto-Analysis: \`${result.filename}\`**`);
  lines.push('');

  if (result.kind === 'pdf' && result.pageCount) {
    lines.push(`📑 Pages: ${result.pageCount}`);
  }

  if (result.language) {
    lines.push(`🌐 Language: ${result.language}`);
  }

  lines.push('');
  lines.push('**📝 Summary:**');
  lines.push(result.summary);

  // Phase 171.12: Show phases found
  if (result.phasesFound && result.phasesFound.length > 0 && !result.phasesFound.includes('NO_PHASE_DATA_FOUND')) {
    lines.push('');
    lines.push('**🔢 Phases Found:**');
    for (const phase of result.phasesFound.slice(0, 10)) {
      lines.push(`- ${phase}`);
    }
  }

  // Phase 171.12: Show milestones
  if (result.milestones && result.milestones.length > 0) {
    lines.push('');
    lines.push('**🎯 Key Milestones:**');
    for (const milestone of result.milestones.slice(0, 8)) {
      lines.push(`- ${milestone}`);
    }
  }

  // Phase 171.12: Show technical details
  if (result.technicalDetails && result.technicalDetails.length > 0) {
    lines.push('');
    lines.push('**🔧 Technologies & Tools:**');
    lines.push(result.technicalDetails.slice(0, 10).join(' • '));
  }

  if (result.sections && result.sections.length > 0) {
    lines.push('');
    lines.push('**📋 Key Sections:**');
    for (const section of result.sections.slice(0, 8)) {
      // Phase 171.12: Show more content (300 chars instead of 100)
      lines.push(`- **${section.title}**: ${section.content.slice(0, 300)}${section.content.length > 300 ? '...' : ''}`);
    }
  }

  if (result.uiComponents && result.uiComponents.length > 0) {
    lines.push('');
    lines.push('**🧩 UI Components:**');
    for (const comp of result.uiComponents.slice(0, 5)) {
      lines.push(`- \`${comp.name}\` (${comp.type}): ${comp.description}`);
    }
  }

  if (result.risks && result.risks.length > 0) {
    lines.push('');
    lines.push('**⚠️ Warnings:**');
    for (const risk of result.risks) {
      lines.push(`- ${risk}`);
    }
  }

  if (result.recommendedNextAction) {
    lines.push('');
    lines.push(`**➡️ Suggested Next Step:** ${result.recommendedNextAction}`);
  }

  return lines.join('\n');
}

/**
 * Format analysis result based on locale
 */
export function formatMediaAnalysisAsChatMessage(
  result: MediaAnalyzeResult,
  locale: 'ar' | 'en' = 'ar'
): string {
  return locale === 'ar'
    ? formatMediaAnalysisAsChatMessageAr(result)
    : formatMediaAnalysisAsChatMessageEn(result);
}
