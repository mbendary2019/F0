/**
 * Phase 171: Media Analyze API
 * POST /api/media/analyze
 *
 * Auto-analyzes dropped files (PDF, images) and returns structured summary
 * Called automatically when user drops a file in Desktop IDE
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractPDFContent } from '../../../../../orchestrator/core/media/extractors/pdfExtractor';

export const dynamic = 'force-dynamic';

// CORS headers for Desktop IDE
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/** Handle CORS preflight */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

interface MediaAnalyzeRequest {
  kind: 'pdf' | 'image';
  mimeType: string;
  filename: string;
  bytesBase64: string;
  projectId?: string;
  userId?: string;
  locale?: 'ar' | 'en';
}

interface Section {
  title: string;
  content: string;
}

interface MediaAnalyzeResult {
  kind: 'pdf' | 'image';
  filename: string;
  summary: string;
  summaryAr?: string;
  pageCount?: number;
  language?: string;
  sections?: Section[];
  risks?: string[];
  recommendedNextAction?: string;
  extractedText?: string;
  // Phase 171.12: New fields for deep extraction
  phasesFound?: string[];
  milestones?: string[];
  technicalDetails?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body: MediaAnalyzeRequest = await req.json();
    const { kind, mimeType, filename, bytesBase64, locale = 'ar' } = body;

    console.log('[MediaAnalyze] Request:', {
      kind,
      mimeType,
      filename,
      base64Length: bytesBase64?.length,
      locale,
    });

    if (!bytesBase64 || !filename) {
      return NextResponse.json(
        { ok: false, error: 'Missing bytesBase64 or filename' },
        { status: 400, headers: corsHeaders }
      );
    }

    let result: MediaAnalyzeResult;

    if (kind === 'pdf' || mimeType === 'application/pdf') {
      result = await analyzePDF(bytesBase64, filename, locale);
    } else if (kind === 'image' || mimeType?.startsWith('image/')) {
      result = await analyzeImage(bytesBase64, filename, mimeType, locale);
    } else {
      return NextResponse.json(
        { ok: false, error: `Unsupported media kind: ${kind}` },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[MediaAnalyze] Success:', {
      filename,
      summaryLength: result.summary?.length,
      pageCount: result.pageCount,
    });

    return NextResponse.json(
      { ok: true, result },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[MediaAnalyze] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Analysis failed' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Phase 171.9: Minimum text length to consider extraction successful
const MIN_TEXT_LEN = 800;

/**
 * Analyze PDF document
 * Phase 171.3: Improved fallback when pdfjs-dist fails
 * Phase 171.5: Added detailed logging for debugging extraction issues
 * Phase 171.9: Added MIN_TEXT_LEN guard and improved logging
 */
async function analyzePDF(
  base64: string,
  filename: string,
  locale: 'ar' | 'en'
): Promise<MediaAnalyzeResult> {
  let text = '';
  let pageCount = 0;
  let language = 'en';

  // Phase 171.9: Enhanced logging for debugging
  console.log('========================================');
  console.log('[PDF] bytesBase64 len:', base64?.length || 0);
  console.log('[PDF] filename:', filename);
  console.log('[PDF] locale:', locale);
  console.log('[PDF] base64 preview (first 100 chars):', base64?.slice(0, 100));
  console.log('========================================');

  // Try to extract text using pdfjs-dist
  try {
    const extracted = await extractPDFContent({
      content: base64,
      contentType: 'base64',
      mimeType: 'application/pdf',
      filename,
    });

    text = (extracted.text || '').trim();
    pageCount = extracted.pageCount || 0;
    language = extracted.language || 'en';

    // Phase 171.9: Detailed extraction logging
    console.log('[PDF] extractedText len:', text.length);
    console.log('[PDF] pageCount:', pageCount);
    console.log('[PDF] language:', language);
    console.log('[PDF] extractionMethod:', extracted.metadata?.extractionMethod);
    console.log('[PDF] preview (first 200 chars):', JSON.stringify(text.slice(0, 200)));
    console.log('========================================');
  } catch (extractError: any) {
    console.error('[PDF] ❌ Extraction FAILED:', extractError.message);
    console.error('[PDF] Full error:', extractError);
  }

  // Phase 171.9: Guard - if text is too short, it's probably placeholder or failed extraction
  // Phase 171.11: Stricter guard - also check pageCount
  if (text.length < MIN_TEXT_LEN || pageCount === 0) {
    console.log(`[PDF] ⚠️ Extraction incomplete (textLen=${text.length}, pageCount=${pageCount})`);
    console.log('[PDF] Reason:', text.length === 0 ? 'NO_TEXT_EXTRACTED' : pageCount === 0 ? 'NO_PAGE_COUNT' : 'TEXT_TOO_SHORT');

    // Phase 171.6: Try Vision API for scanned PDFs (analyze PDF as image)
    // Phase 171.11: Vision is now MANDATORY fallback - no filename guessing
    if (base64) {
      console.log('[MediaAnalyze] Attempting Vision API fallback for scanned PDF');
      try {
        const visionResult = await analyzePDFWithVision(base64, filename, locale);
        if (visionResult) {
          console.log('[MediaAnalyze] ✅ Vision API fallback succeeded');
          return {
            ...visionResult,
            pageCount: pageCount || visionResult.pageCount,
          };
        }
      } catch (visionError: any) {
        console.warn('[MediaAnalyze] Vision API fallback failed:', visionError.message);
      }
    }

    // Phase 171.11: NO filename-based hallucination - return explicit failure
    // This prevents the agent from making up content like "Phase 170/171"
    console.log('[MediaAnalyze] ❌ All extraction methods failed - returning PDF_TEXT_EXTRACTION_FAILED');

    const failureMessage = locale === 'ar'
      ? `📄 **ملف PDF:** \`${filename}\`\n\n⚠️ **لم نتمكن من استخراج النص من هذا الملف.**\n\nالأسباب المحتملة:\n- الملف مسح ضوئي (scanned PDF)\n- الملف محمي\n- صيغة PDF غير مدعومة\n\n**الخطوة التالية:** افتح الملف في قارئ PDF وانسخ النص يدوياً، أو أخبرني ما تريد معرفته عنه.`
      : `📄 **PDF File:** \`${filename}\`\n\n⚠️ **Could not extract text from this file.**\n\nPossible reasons:\n- Scanned PDF (image-based)\n- Protected/encrypted file\n- Unsupported PDF format\n\n**Next step:** Open the file in a PDF reader and copy the text manually, or tell me what you want to know about it.`;

    return {
      kind: 'pdf',
      filename,
      summary: failureMessage,
      summaryAr: locale === 'ar' ? failureMessage : `📄 **ملف PDF:** \`${filename}\`\n\n⚠️ لم نتمكن من استخراج النص. افتح الملف يدوياً.`,
      pageCount: pageCount || 0,
      language: 'unknown',
      extractedText: `PDF_TEXT_EXTRACTION_FAILED: textLen=${text.length}, pageCount=${pageCount}`,
      recommendedNextAction: locale === 'ar'
        ? 'افتح الملف في قارئ PDF وانسخ النص يدوياً'
        : 'Open in PDF reader and copy text manually',
    };
  }

  // Generate summary using extracted text
  const { summary, summaryAr, sections, risks, recommendedNextAction } =
    await generatePDFSummary(text, filename, locale, language);

  return {
    kind: 'pdf',
    filename,
    summary,
    summaryAr,
    pageCount,
    language,
    sections,
    risks,
    recommendedNextAction,
    extractedText: text.slice(0, 5000), // First 5000 chars
  };
}

/**
 * Analyze image using Vision API
 */
async function analyzeImage(
  base64: string,
  filename: string,
  mimeType: string,
  locale: 'ar' | 'en'
): Promise<MediaAnalyzeResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // Fallback without Vision API
    return {
      kind: 'image',
      filename,
      summary: locale === 'ar'
        ? `صورة: ${filename}. Vision API غير متاح - يرجى تكوين OPENAI_API_KEY.`
        : `Image: ${filename}. Vision API not available - please configure OPENAI_API_KEY.`,
      recommendedNextAction: locale === 'ar'
        ? 'اكتب وصفًا للصورة لمساعدة الوكيل'
        : 'Describe the image to help the agent',
    };
  }

  // Call Vision API
  const systemPrompt = locale === 'ar'
    ? `أنت محلل صور متخصص. حلل الصورة المرفقة وأرجع تحليلاً مفصلاً بالعربية.

إذا كانت الصورة تحتوي على:
- تصميم UI: اذكر المكونات والألوان والـ layout
- كود: اشرح ما يفعله الكود
- مخطط: اشرح العناصر والعلاقات
- خطأ: اقترح حلولاً

أرجع التحليل بتنسيق JSON:
{
  "summary": "ملخص الصورة",
  "uiComponents": [{"name": "اسم", "type": "نوع", "description": "وصف"}],
  "risks": ["تحذير1", "تحذير2"],
  "recommendedNextAction": "الخطوة التالية"
}`
    : `You are an image analyzer. Analyze the attached image and return a detailed analysis.

If the image contains:
- UI design: list components, colors, layout
- Code: explain what the code does
- Diagram: explain elements and relationships
- Error: suggest solutions

Return analysis in JSON format:
{
  "summary": "image summary",
  "uiComponents": [{"name": "name", "type": "type", "description": "desc"}],
  "risks": ["warning1", "warning2"],
  "recommendedNextAction": "next step"
}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: `حلل هذه الصورة: ${filename}` },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                  detail: 'auto',
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      throw new Error(`Vision API error: ${res.status}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || '';

    // Try to parse JSON from response
    try {
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
      return {
        kind: 'image',
        filename,
        summary: parsed.summary || content,
        uiComponents: parsed.uiComponents,
        risks: parsed.risks,
        recommendedNextAction: parsed.recommendedNextAction,
      };
    } catch {
      // Return raw text if not JSON
      return {
        kind: 'image',
        filename,
        summary: content,
      };
    }
  } catch (error: any) {
    console.error('[MediaAnalyze] Vision API error:', error);
    return {
      kind: 'image',
      filename,
      summary: locale === 'ar'
        ? `صورة: ${filename}. فشل التحليل: ${error.message}`
        : `Image: ${filename}. Analysis failed: ${error.message}`,
    };
  }
}

/**
 * Generate PDF summary using LLM
 */
async function generatePDFSummary(
  text: string,
  filename: string,
  locale: 'ar' | 'en',
  detectedLanguage: string
): Promise<{
  summary: string;
  summaryAr?: string;
  sections?: Section[];
  risks?: string[];
  recommendedNextAction?: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;

  // Truncate text for API
  const truncatedText = text.slice(0, 15000);

  if (!apiKey || !truncatedText || truncatedText.length < 50) {
    // Fallback: Basic extraction without LLM
    const lines = truncatedText.split('\n').filter(l => l.trim());
    const firstLines = lines.slice(0, 10).join('\n');

    return {
      summary: locale === 'ar'
        ? `مستند PDF: ${filename}\n\n${firstLines.slice(0, 500)}...`
        : `PDF Document: ${filename}\n\n${firstLines.slice(0, 500)}...`,
      sections: extractBasicSections(truncatedText),
      risks: detectRisks(truncatedText),
      recommendedNextAction: locale === 'ar'
        ? 'راجع المحتوى واطلب تفاصيل محددة'
        : 'Review the content and ask for specific details',
    };
  }

  // Phase 171.9: Enhanced prompt to extract phases and milestones
  const systemPrompt = locale === 'ar'
    ? `أنت محلل مستندات متخصص. حلل النص المستخرج من PDF واستخرج المعلومات التالية بدقة:

مهم جداً:
- استخرج أرقام الـ Phases الموجودة (مثل: Phase 170, Phase 171, إلخ)
- استخرج الـ Milestones أو المراحل المهمة
- لو ما لقيت phases أو milestones واضحة، اكتب: "NO_PHASE_DATA_FOUND"
- لا تكتب جمل عامة - كن محدداً

أرجع JSON فقط:
{
  "summary": "ملخص شامل للمستند بالعربية (3-5 جمل) - اذكر الـ phases المحددة",
  "summaryAr": "نفس الملخص بالعربية",
  "phasesFound": ["Phase 170", "Phase 171", ...],
  "milestones": ["milestone 1", "milestone 2", ...],
  "sections": [{"title": "عنوان", "content": "محتوى"}],
  "risks": ["تحذيرات"],
  "recommendedNextAction": "STORE_IN_MEMORY" | "ASK_USER"
}

قواعد:
- لو ما فيه أرقام phases واضحة في النص، phasesFound يكون: ["NO_PHASE_DATA_FOUND"]
- لا تخترع معلومات غير موجودة`
    : `You are a document analyzer. Extract the following from the PDF text:

IMPORTANT:
- Extract Phase numbers (e.g., Phase 170, Phase 171, etc.)
- Extract Milestones or key stages
- If no clear phases/milestones found, write: "NO_PHASE_DATA_FOUND"
- Be specific, not generic

Return JSON ONLY:
{
  "summary": "comprehensive summary (3-5 sentences) - mention specific phases",
  "summaryAr": "Arabic summary",
  "phasesFound": ["Phase 170", "Phase 171", ...],
  "milestones": ["milestone 1", "milestone 2", ...],
  "sections": [{"title": "title", "content": "content"}],
  "risks": ["warnings"],
  "recommendedNextAction": "STORE_IN_MEMORY" | "ASK_USER"
}

Rules:
- If no concrete phase numbers in text, phasesFound should be: ["NO_PHASE_DATA_FOUND"]
- Do NOT invent information not in the text`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use mini for cost efficiency
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `حلل هذا المستند (${filename}):\n\n${truncatedText}`,
          },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      throw new Error(`LLM API error: ${res.status}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || '';

    // Try to parse JSON
    try {
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
      return {
        summary: parsed.summary || content,
        summaryAr: parsed.summaryAr,
        sections: parsed.sections,
        risks: parsed.risks?.length > 0 ? parsed.risks : detectRisks(text),
        recommendedNextAction: parsed.recommendedNextAction,
      };
    } catch {
      return {
        summary: content,
        sections: extractBasicSections(text),
        risks: detectRisks(text),
      };
    }
  } catch (error: any) {
    console.error('[MediaAnalyze] LLM summary error:', error);
    // Fallback to basic extraction
    return {
      summary: locale === 'ar'
        ? `مستند PDF: ${filename} (${text.length} حرف)`
        : `PDF Document: ${filename} (${text.length} characters)`,
      sections: extractBasicSections(text),
      risks: detectRisks(text),
    };
  }
}

/**
 * Extract basic sections from text
 */
function extractBasicSections(text: string): Section[] {
  const sections: Section[] = [];
  const lines = text.split('\n');

  let currentSection: Section | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect section headers (all caps, numbered, or short bold-like lines)
    if (
      (trimmed.length < 50 && trimmed === trimmed.toUpperCase()) ||
      /^\d+\.\s+[A-Z]/.test(trimmed) ||
      /^(Chapter|Section|Part|Phase)\s+\d/i.test(trimmed)
    ) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = { title: trimmed, content: '' };
    } else if (currentSection) {
      currentSection.content += trimmed + ' ';
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  // Trim content and limit sections
  return sections
    .map(s => ({ ...s, content: s.content.trim().slice(0, 200) }))
    .slice(0, 10);
}

/**
 * Detect potential security risks in text
 */
function detectRisks(text: string): string[] {
  const risks: string[] = [];

  // API keys
  if (/[A-Za-z0-9_-]{20,}/.test(text) && /key|token|secret|password/i.test(text)) {
    risks.push('⚠️ يحتوي على ما يبدو أنه API keys أو tokens - تأكد من عدم مشاركتها');
  }

  // Passwords
  if (/password\s*[:=]\s*\S+/i.test(text)) {
    risks.push('⚠️ يحتوي على كلمات مرور ظاهرة');
  }

  // Connection strings
  if (/mongodb\+srv:\/\/|postgres:\/\/|mysql:\/\//i.test(text)) {
    risks.push('⚠️ يحتوي على connection strings لقواعد بيانات');
  }

  // Private keys
  if (/BEGIN (RSA |EC )?PRIVATE KEY/i.test(text)) {
    risks.push('⚠️ يحتوي على private keys - خطر أمني عالي!');
  }

  return risks;
}

/**
 * Phase 171.3: Generate PDF summary from filename when text extraction fails
 * Uses LLM to infer content from filename + any partial text
 */
async function generatePDFSummaryFromFilename(
  filename: string,
  partialText: string,
  locale: 'ar' | 'en'
): Promise<{
  summary: string;
  summaryAr?: string;
  sections?: Section[];
  risks?: string[];
  recommendedNextAction?: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // No API key - return basic info
    return {
      summary: locale === 'ar'
        ? `📄 مستند PDF: ${filename}\n\nلم نتمكن من استخراج المحتوى. يرجى فتح الملف يدوياً.`
        : `📄 PDF Document: ${filename}\n\nCould not extract content. Please open the file manually.`,
      summaryAr: `📄 مستند PDF: ${filename}\n\nلم نتمكن من استخراج المحتوى. يرجى فتح الملف يدوياً.`,
      recommendedNextAction: locale === 'ar'
        ? 'افتح الملف في قارئ PDF للاطلاع على المحتوى'
        : 'Open the file in a PDF reader to view the content',
    };
  }

  // Use LLM to generate intelligent summary based on filename
  // Phase 171.4: Force Arabic response when locale is 'ar'
  const systemPrompt = locale === 'ar'
    ? `أنت محلل مستندات عربي. يجب أن تكتب كل شيء بالعربية فقط.

لديك ملف PDF باسم "${filename}".
لم نتمكن من استخراج النص الكامل، لكن استنتج من اسم الملف ماذا قد يحتوي.

${partialText ? `نص جزئي مستخرج: ${partialText.slice(0, 500)}` : ''}

مهم جداً: يجب أن تكتب summary و summaryAr بالعربية الفصحى!

أرجع JSON بالتنسيق التالي (اكتب كل النصوص بالعربية):
{
  "summary": "ملخص عربي للملف بناء على اسمه",
  "summaryAr": "نفس الملخص بالعربية",
  "sections": [{"title": "عنوان عربي", "content": "محتوى عربي متوقع"}],
  "recommendedNextAction": "الخطوة التالية بالعربية"
}

تذكر: كل النصوص يجب أن تكون بالعربية!`
    : `You are a smart analyzer. You have a PDF file named "${filename}".
We couldn't extract the full text, but infer from the filename what it might contain.

${partialText ? `Partial extracted text: ${partialText.slice(0, 500)}` : ''}

Return an analysis in JSON format:
{
  "summary": "likely description of the file based on its name",
  "summaryAr": "same description in Arabic",
  "sections": [{"title": "likely section", "content": "expected content"}],
  "recommendedNextAction": "what to do to see the actual content"
}

Note: Make clear this is an inference based on the filename only.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `حلل الملف: ${filename}` },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || '';

    // Try to parse JSON
    try {
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
      return {
        summary: parsed.summary || content,
        summaryAr: parsed.summaryAr || parsed.summary,
        sections: parsed.sections,
        risks: parsed.risks,
        recommendedNextAction: parsed.recommendedNextAction || (locale === 'ar'
          ? 'افتح الملف في قارئ PDF للتحقق من المحتوى الفعلي'
          : 'Open the file in a PDF reader to verify actual content'),
      };
    } catch {
      return {
        summary: content,
        summaryAr: content,
        recommendedNextAction: locale === 'ar'
          ? 'افتح الملف في قارئ PDF'
          : 'Open the file in a PDF reader',
      };
    }
  } catch (error: any) {
    console.error('[MediaAnalyze] LLM analysis from filename failed:', error);
    return {
      summary: locale === 'ar'
        ? `📄 مستند PDF: ${filename}\n\nلم نتمكن من التحليل. افتح الملف يدوياً.`
        : `📄 PDF Document: ${filename}\n\nCould not analyze. Please open manually.`,
      summaryAr: `📄 مستند PDF: ${filename}\n\nلم نتمكن من التحليل. افتح الملف يدوياً.`,
    };
  }
}

/**
 * Phase 171.6: Analyze PDF using Vision API when text extraction fails
 * Phase 171.7: Removed canvas dependency - use Anthropic Claude for PDF analysis
 * Phase 171.8: Use Claude API which natively supports PDF documents
 * Phase 171.13: Use Gemini as PRIMARY (cheaper), Claude as fallback
 */
async function analyzePDFWithVision(
  base64: string,
  filename: string,
  locale: 'ar' | 'en'
): Promise<MediaAnalyzeResult | null> {
  // Phase 171.13: Priority order - Gemini (cheapest) → Claude → OpenAI
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !anthropicKey && !openaiKey) return null;

  // Clean base64 (remove data URL prefix if present)
  const cleanBase64 = base64.startsWith('data:') ? base64.split(',')[1] : base64;

  console.log('[MediaAnalyze] Vision fallback: PDF size:', cleanBase64.length);

  // Phase 171.13: Try Gemini FIRST (much cheaper than Claude)
  if (geminiKey) {
    try {
      console.log('[MediaAnalyze] Trying Gemini API for PDF analysis (cheapest)...');
      const result = await analyzePDFWithGemini(cleanBase64, filename, locale, geminiKey);
      if (result) {
        console.log('[MediaAnalyze] ✅ Gemini succeeded');
        return result;
      }
    } catch (geminiError: any) {
      console.warn('[MediaAnalyze] Gemini API failed:', geminiError.message);
    }
  }

  // Fallback to Claude (more expensive but reliable)
  if (anthropicKey) {
    try {
      console.log('[MediaAnalyze] Trying Claude API for PDF analysis (fallback)...');
      const result = await analyzePDFWithClaude(cleanBase64, filename, locale, anthropicKey);
      if (result) return result;
    } catch (claudeError: any) {
      console.warn('[MediaAnalyze] Claude API failed:', claudeError.message);
    }
  }

  // Last resort: OpenAI (may not support PDFs)
  if (openaiKey) {
    try {
      console.log('[MediaAnalyze] Trying OpenAI for PDF (last resort)...');
      const result = await analyzePDFWithOpenAI(cleanBase64, filename, locale, openaiKey);
      if (result) return result;
    } catch (openaiError: any) {
      console.warn('[MediaAnalyze] OpenAI Vision failed:', openaiError.message);
    }
  }

  return null;
}

/**
 * Phase 171.13: Analyze PDF using Gemini API (cheapest option)
 * Gemini 1.5 Flash supports PDFs natively and is much cheaper than Claude
 */
async function analyzePDFWithGemini(
  base64: string,
  filename: string,
  locale: 'ar' | 'en',
  apiKey: string
): Promise<MediaAnalyzeResult | null> {
  // Phase 171.13: Same deep extraction prompt as Claude
  const systemPrompt = locale === 'ar'
    ? `أنت محلل مستندات خبير متخصص في استخراج التفاصيل الدقيقة.

مهمتك: استخراج المحتوى الكامل والتفصيلي من المستند - ليس فقط العناوين بل المحتوى الفعلي!

قواعد الاستخراج:
1. اقرأ كل صفحة بعناية
2. استخرج كل Phase/مرحلة مع وصفها الكامل
3. استخرج كل Milestone/هدف مع تفاصيله
4. استخرج المهام والخطوات المحددة
5. لا تكتفي بالعناوين - اكتب المحتوى الفعلي لكل قسم

مهم جداً:
- اكتب كل شيء بالعربية الفصحى!
- لكل قسم، اكتب 200-500 حرف من المحتوى الفعلي
- إذا فيه أرقام أو نسب مئوية أو تواريخ، استخرجها
- إذا فيه أسماء تقنيات أو أدوات، اذكرها

أرجع JSON فقط بالتنسيق:
{
  "summary": "ملخص تفصيلي شامل (10-15 جملة)",
  "summaryAr": "نفس الملخص بالعربية",
  "phasesFound": ["Phase 120: وصف كامل", "Phase 121: وصف كامل"],
  "milestones": ["هدف 1 مع تفاصيله", "هدف 2 مع تفاصيله"],
  "sections": [{"title": "عنوان", "content": "محتوى 200-500 حرف"}],
  "technicalDetails": ["تقنية 1", "تقنية 2"],
  "risks": ["تحذيرات"],
  "recommendedNextAction": "الخطوة التالية"
}`
    : `You are an expert document analyzer. Extract DETAILED content from the document.

Rules:
1. Read every page carefully
2. Extract every Phase with FULL description
3. Extract every Milestone with details
4. Write 200-500 chars for each section content

Return JSON ONLY:
{
  "summary": "detailed summary (10-15 sentences)",
  "summaryAr": "Arabic summary",
  "phasesFound": ["Phase 120: full description"],
  "milestones": ["milestone with details"],
  "sections": [{"title": "title", "content": "200-500 chars"}],
  "technicalDetails": ["tech1", "tech2"],
  "risks": ["warnings"],
  "recommendedNextAction": "next step"
}`;

  // Gemini API endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: systemPrompt },
            {
              inline_data: {
                mime_type: 'application/pdf',
                data: base64,
              },
            },
            {
              text: locale === 'ar'
                ? `حلل هذا المستند: ${filename}`
                : `Analyze this document: ${filename}`,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 8000,
        temperature: 0.3,
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    console.error('[MediaAnalyze] Gemini API response:', res.status, errorText.slice(0, 300));
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const json = await res.json();
  const content = json.candidates?.[0]?.content?.parts?.[0]?.text || '';

  console.log('[MediaAnalyze] Gemini API response length:', content.length);

  // Parse JSON response
  try {
    const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));

    const extractedParts: string[] = [];
    if (parsed.summary) extractedParts.push(`Summary: ${parsed.summary}`);
    if (parsed.phasesFound?.length) extractedParts.push(`Phases: ${parsed.phasesFound.join('; ')}`);
    if (parsed.milestones?.length) extractedParts.push(`Milestones: ${parsed.milestones.join('; ')}`);
    if (parsed.technicalDetails?.length) extractedParts.push(`Tech: ${parsed.technicalDetails.join(', ')}`);

    return {
      kind: 'pdf',
      filename,
      summary: parsed.summary || content,
      summaryAr: parsed.summaryAr || parsed.summary,
      pageCount: undefined,
      language: locale === 'ar' ? 'ar' : 'en',
      sections: parsed.sections,
      risks: parsed.risks,
      recommendedNextAction: parsed.recommendedNextAction,
      extractedText: `[Gemini Analysis] ${extractedParts.join(' | ').slice(0, 2000)}`,
      phasesFound: parsed.phasesFound,
      milestones: parsed.milestones,
      technicalDetails: parsed.technicalDetails,
    };
  } catch {
    return {
      kind: 'pdf',
      filename,
      summary: content,
      summaryAr: content,
      pageCount: undefined,
      language: locale === 'ar' ? 'ar' : 'en',
      extractedText: `[Gemini Analysis] ${content.slice(0, 500)}`,
    };
  }
}

/**
 * Phase 171.8: Analyze PDF using Claude API (native PDF support)
 * Phase 171.12: Enhanced prompt for DEEP content extraction (not just headers)
 */
async function analyzePDFWithClaude(
  base64: string,
  filename: string,
  locale: 'ar' | 'en',
  apiKey: string
): Promise<MediaAnalyzeResult | null> {
  // Phase 171.12: Enhanced prompt for deep extraction
  const systemPrompt = locale === 'ar'
    ? `أنت محلل مستندات خبير متخصص في استخراج التفاصيل الدقيقة.

مهمتك: استخراج المحتوى الكامل والتفصيلي من المستند - ليس فقط العناوين بل المحتوى الفعلي!

قواعد الاستخراج:
1. اقرأ كل صفحة بعناية
2. استخرج كل Phase/مرحلة مع وصفها الكامل
3. استخرج كل Milestone/هدف مع تفاصيله
4. استخرج المهام والخطوات المحددة
5. لا تكتفي بالعناوين - اكتب المحتوى الفعلي لكل قسم

مهم جداً:
- اكتب كل شيء بالعربية الفصحى!
- لكل قسم، اكتب 200-500 حرف من المحتوى الفعلي
- إذا فيه أرقام أو نسب مئوية أو تواريخ، استخرجها
- إذا فيه أسماء تقنيات أو أدوات، اذكرها

أرجع JSON بالتنسيق:
{
  "summary": "ملخص تفصيلي شامل (10-15 جملة) يشمل: الغرض الرئيسي، المراحل الرئيسية، الأهداف، التقنيات المستخدمة",
  "summaryAr": "نفس الملخص بالعربية",
  "phasesFound": ["Phase 120: وصف كامل", "Phase 121: وصف كامل", ...],
  "milestones": ["هدف 1 مع تفاصيله", "هدف 2 مع تفاصيله", ...],
  "sections": [
    {"title": "عنوان القسم 1", "content": "المحتوى الكامل للقسم (200-500 حرف)"},
    {"title": "عنوان القسم 2", "content": "المحتوى الكامل للقسم (200-500 حرف)"}
  ],
  "technicalDetails": ["تقنية 1", "تقنية 2", ...],
  "risks": ["تحذيرات أو ملاحظات مهمة"],
  "recommendedNextAction": "الخطوة التالية المقترحة بناء على محتوى المستند"
}

تذكر: المستخدم يريد فهم المحتوى الكامل - ليس مجرد فكرة عامة!`
    : `You are an expert document analyzer specialized in extracting DETAILED content.

Your task: Extract COMPLETE and DETAILED content from the document - not just headers but actual content!

Extraction rules:
1. Read every page carefully
2. Extract every Phase/stage with its FULL description
3. Extract every Milestone/goal with its details
4. Extract specific tasks and steps
5. Don't just write titles - write the ACTUAL content of each section

IMPORTANT:
- For each section, write 200-500 characters of actual content
- If there are numbers, percentages, or dates, extract them
- If there are technology names or tools, mention them

Return JSON:
{
  "summary": "detailed comprehensive summary (10-15 sentences) including: main purpose, key phases, goals, technologies used",
  "summaryAr": "Same summary in Arabic",
  "phasesFound": ["Phase 120: full description", "Phase 121: full description", ...],
  "milestones": ["milestone 1 with details", "milestone 2 with details", ...],
  "sections": [
    {"title": "Section 1 title", "content": "Full section content (200-500 chars)"},
    {"title": "Section 2 title", "content": "Full section content (200-500 chars)"}
  ],
  "technicalDetails": ["tech 1", "tech 2", ...],
  "risks": ["warnings or important notes"],
  "recommendedNextAction": "suggested next step based on document content"
}

Remember: The user wants to understand the COMPLETE content - not just a general idea!`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000, // Phase 171.12: Increased for detailed extraction
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: locale === 'ar' ? `حلل هذا المستند: ${filename}` : `Analyze this document: ${filename}`,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    console.error('[MediaAnalyze] Claude API response:', res.status, errorText.slice(0, 300));
    throw new Error(`Claude API error: ${res.status}`);
  }

  const json = await res.json();
  const content = json.content?.[0]?.text || '';

  console.log('[MediaAnalyze] Claude API response length:', content.length);

  // Parse JSON response
  // Phase 171.12: Include new deep extraction fields
  try {
    const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));

    // Phase 171.12: Build comprehensive extracted text from all fields
    const extractedParts: string[] = [];
    if (parsed.summary) extractedParts.push(`Summary: ${parsed.summary}`);
    if (parsed.phasesFound?.length) extractedParts.push(`Phases: ${parsed.phasesFound.join('; ')}`);
    if (parsed.milestones?.length) extractedParts.push(`Milestones: ${parsed.milestones.join('; ')}`);
    if (parsed.technicalDetails?.length) extractedParts.push(`Tech: ${parsed.technicalDetails.join(', ')}`);

    return {
      kind: 'pdf',
      filename,
      summary: parsed.summary || content,
      summaryAr: parsed.summaryAr || parsed.summary,
      pageCount: undefined,
      language: locale === 'ar' ? 'ar' : 'en',
      sections: parsed.sections,
      risks: parsed.risks,
      recommendedNextAction: parsed.recommendedNextAction,
      extractedText: `[Claude Deep Analysis] ${extractedParts.join(' | ').slice(0, 2000)}`,
      // Phase 171.12: New fields
      phasesFound: parsed.phasesFound,
      milestones: parsed.milestones,
      technicalDetails: parsed.technicalDetails,
    };
  } catch {
    return {
      kind: 'pdf',
      filename,
      summary: content,
      summaryAr: content,
      pageCount: undefined,
      language: locale === 'ar' ? 'ar' : 'en',
      extractedText: `[Claude Analysis] ${content.slice(0, 500)}`,
    };
  }
}

/**
 * Phase 171.8: Fallback to OpenAI (may not support PDFs)
 */
async function analyzePDFWithOpenAI(
  base64: string,
  filename: string,
  locale: 'ar' | 'en',
  apiKey: string
): Promise<MediaAnalyzeResult | null> {
  const systemPrompt = locale === 'ar'
    ? `أنت محلل مستندات خبير. حلل هذا المستند واستخرج المعلومات الرئيسية بالتفصيل.

مهم: اكتب كل شيء بالعربية الفصحى!

أرجع JSON بالتنسيق:
{
  "summary": "ملخص شامل للمحتوى بالعربية (3-5 جمل)",
  "summaryAr": "نفس الملخص بالعربية",
  "sections": [{"title": "عنوان القسم", "content": "محتوى القسم"}],
  "risks": ["تحذيرات أو ملاحظات مهمة"],
  "recommendedNextAction": "الخطوة التالية المقترحة"
}`
    : `You are an expert document analyzer. Analyze this document and extract key information.

Return JSON:
{
  "summary": "comprehensive content summary (3-5 sentences)",
  "summaryAr": "Arabic summary",
  "sections": [{"title": "section title", "content": "section content"}],
  "risks": ["warnings or important notes"],
  "recommendedNextAction": "suggested next step"
}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: locale === 'ar' ? `حلل هذا المستند: ${filename}` : `Analyze this document: ${filename}` },
            {
              type: 'image_url',
              image_url: {
                url: `data:application/pdf;base64,${base64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 3000,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    // Check if it's an unsupported format error
    if (errorText.includes('unsupported') || errorText.includes('Invalid image')) {
      console.log('[MediaAnalyze] OpenAI does not support PDF format');
      return null;
    }
    throw new Error(`OpenAI API error: ${res.status}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content || '';

  console.log('[MediaAnalyze] OpenAI response length:', content.length);

  try {
    const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
    return {
      kind: 'pdf',
      filename,
      summary: parsed.summary || content,
      summaryAr: parsed.summaryAr || parsed.summary,
      pageCount: undefined,
      language: locale === 'ar' ? 'ar' : 'en',
      sections: parsed.sections,
      risks: parsed.risks,
      recommendedNextAction: parsed.recommendedNextAction,
      extractedText: `[OpenAI Analysis] ${parsed.summary?.slice(0, 500) || ''}`,
    };
  } catch {
    return {
      kind: 'pdf',
      filename,
      summary: content,
      summaryAr: content,
      pageCount: undefined,
      language: locale === 'ar' ? 'ar' : 'en',
      extractedText: `[OpenAI Analysis] ${content.slice(0, 500)}`,
    };
  }
}
