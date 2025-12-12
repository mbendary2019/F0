// desktop/src/lib/agent/prompts/snapshotPrompt.ts
// Phase 123: Snapshot Prompt Builder
// Builds the prompt for generating project snapshots

export interface SnapshotPromptMessages {
  system: string;
  user: string;
}

/**
 * Build the prompt for snapshot generation
 * Takes important project files and creates a structured analysis request
 */
export function buildSnapshotPrompt(
  files: Array<{ path: string; content: string }>,
  locale: 'ar' | 'en' = 'ar'
): SnapshotPromptMessages {
  // Build file bundle
  const bundle = files
    .map(
      (f) => `
📄 FILE: ${f.path}
----------------
${f.content.slice(0, 3000)}${f.content.length > 3000 ? '\n... [truncated]' : ''}
`
    )
    .join('\n\n');

  const systemPromptAr = `أنت F0 Project Snapshot Agent.
مهمتك تحليل المشروع بالكامل وإنشاء ملخص JSON منظم.
كن دقيقاً. كن موجزاً. استنتج البنية إذا لزم الأمر.
أجب بـ JSON فقط بدون أي نص إضافي.`;

  const systemPromptEn = `You are F0 Project Snapshot Agent.
Your job is to analyze the entire project and generate a structured JSON summary.
Be accurate. Be concise. Infer architecture if needed.
Respond with JSON only, no additional text.`;

  const userPromptAr = `هذه أهم ملفات المشروع:

${bundle}

أرجع JSON بالهيكل التالي بالضبط:
{
  "projectName": "اسم المشروع المستنتج",
  "stack": ["Next.js", "TypeScript", "Firebase", ...],
  "authFlow": "وصف مختصر لآلية المصادقة",
  "billingFlow": "وصف مختصر لنظام الدفع إن وجد",
  "routes": ["قائمة المسارات الرئيسية"],
  "apis": ["قائمة نقاط الـ API"],
  "stateManagement": ["طرق إدارة الحالة المستخدمة"],
  "database": "نوع قاعدة البيانات",
  "styling": "أسلوب التنسيق (Tailwind, CSS Modules, etc)",
  "importantFiles": ["قائمة أهم الملفات"],
  "features": ["قائمة الميزات الرئيسية"],
  "notes": ["ملاحظات إضافية"]
}`;

  const userPromptEn = `Below are the most important project files:

${bundle}

Return JSON with EXACT structure:
{
  "projectName": "inferred project name",
  "stack": ["Next.js", "TypeScript", "Firebase", ...],
  "authFlow": "brief description of authentication flow",
  "billingFlow": "brief description of billing system if exists",
  "routes": ["list of main routes"],
  "apis": ["list of API endpoints"],
  "stateManagement": ["state management methods used"],
  "database": "database type",
  "styling": "styling approach (Tailwind, CSS Modules, etc)",
  "importantFiles": ["list of important files"],
  "features": ["list of main features"],
  "notes": ["additional notes"]
}`;

  return {
    system: locale === 'ar' ? systemPromptAr : systemPromptEn,
    user: locale === 'ar' ? userPromptAr : userPromptEn,
  };
}

export default buildSnapshotPrompt;
