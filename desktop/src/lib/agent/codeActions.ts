// desktop/src/lib/agent/codeActions.ts
// Phase 122.6: Code Action Rules for Agent
// Provides structured prompts for specific code modification actions

export type CodeActionType =
  | 'auth-guard'
  | 'add-loading-state'
  | 'add-error-handling'
  | 'extract-component'
  | 'add-typescript-types';

export interface CodeActionPayload {
  type: CodeActionType;
  filePath: string;
  fileContent?: string;
  locale?: 'ar' | 'en';
}

export interface CodeActionPrompt {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Build prompts for code actions
 * Returns system and user prompts tailored for the specific action
 */
export function buildCodeActionPrompts(payload: CodeActionPayload): CodeActionPrompt {
  const isArabic = payload.locale === 'ar';
  const { type, filePath, fileContent } = payload;

  switch (type) {
    case 'auth-guard':
      return {
        systemPrompt: isArabic
          ? `أنت وكيل كود F0.
أضف أو لف المكون المعطى بـ <AuthGuard>.
مسار الاستيراد: "@/components/AuthGuard"
لا تعيد كتابة الملف بالكامل — فقط أضف الاستيراد + اللف.
حافظ على جميع الأكواد الأخرى كما هي.`
          : `You are F0 Code Agent.
Add or wrap the given component with an <AuthGuard>.
Import path: "@/components/AuthGuard"
Do not rewrite the whole file — only add import + wrapper.
Keep all other code as-is.`,

        userPrompt: isArabic
          ? `الملف: ${filePath}
أضف AuthGuard حول المكون المُصدَّر الافتراضي.
إذا كان المكون مُصدَّرًا inline، قم بلفه.

${fileContent ? `الكود الحالي:\n\`\`\`tsx\n${fileContent}\n\`\`\`` : ''}`
          : `File: ${filePath}
Add AuthGuard around the default export component.
If the component is default-exported inline, wrap it.

${fileContent ? `Current code:\n\`\`\`tsx\n${fileContent}\n\`\`\`` : ''}`,
      };

    case 'add-loading-state':
      return {
        systemPrompt: isArabic
          ? `أنت وكيل كود F0.
أضف حالة تحميل للمكون.
استخدم useState لـ isLoading وأضف UI للتحميل.`
          : `You are F0 Code Agent.
Add loading state to the component.
Use useState for isLoading and add loading UI.`,

        userPrompt: isArabic
          ? `الملف: ${filePath}
أضف حالة تحميل (isLoading) للمكون.
أضف مؤشر تحميل مناسب.

${fileContent ? `الكود الحالي:\n\`\`\`tsx\n${fileContent}\n\`\`\`` : ''}`
          : `File: ${filePath}
Add loading state (isLoading) to the component.
Add appropriate loading indicator.

${fileContent ? `Current code:\n\`\`\`tsx\n${fileContent}\n\`\`\`` : ''}`,
      };

    case 'add-error-handling':
      return {
        systemPrompt: isArabic
          ? `أنت وكيل كود F0.
أضف معالجة الأخطاء للمكون.
استخدم try-catch وأضف حالة خطأ وUI مناسب.`
          : `You are F0 Code Agent.
Add error handling to the component.
Use try-catch and add error state with appropriate UI.`,

        userPrompt: isArabic
          ? `الملف: ${filePath}
أضف معالجة الأخطاء للمكون.
أضف حالة خطأ ورسائل مناسبة للمستخدم.

${fileContent ? `الكود الحالي:\n\`\`\`tsx\n${fileContent}\n\`\`\`` : ''}`
          : `File: ${filePath}
Add error handling to the component.
Add error state and appropriate user messages.

${fileContent ? `Current code:\n\`\`\`tsx\n${fileContent}\n\`\`\`` : ''}`,
      };

    case 'extract-component':
      return {
        systemPrompt: isArabic
          ? `أنت وكيل كود F0.
استخرج جزء من الكود كمكون منفصل.
أنشئ ملف جديد للمكون واستورده في الملف الأصلي.`
          : `You are F0 Code Agent.
Extract a part of the code as a separate component.
Create a new file for the component and import it in the original file.`,

        userPrompt: isArabic
          ? `الملف: ${filePath}
استخرج الكود المحدد كمكون منفصل.

${fileContent ? `الكود الحالي:\n\`\`\`tsx\n${fileContent}\n\`\`\`` : ''}`
          : `File: ${filePath}
Extract the selected code as a separate component.

${fileContent ? `Current code:\n\`\`\`tsx\n${fileContent}\n\`\`\`` : ''}`,
      };

    case 'add-typescript-types':
      return {
        systemPrompt: isArabic
          ? `أنت وكيل كود F0.
أضف أنواع TypeScript للمكون.
أضف interfaces و types للـ props والـ state.`
          : `You are F0 Code Agent.
Add TypeScript types to the component.
Add interfaces and types for props and state.`,

        userPrompt: isArabic
          ? `الملف: ${filePath}
أضف أنواع TypeScript المناسبة.

${fileContent ? `الكود الحالي:\n\`\`\`tsx\n${fileContent}\n\`\`\`` : ''}`
          : `File: ${filePath}
Add appropriate TypeScript types.

${fileContent ? `Current code:\n\`\`\`tsx\n${fileContent}\n\`\`\`` : ''}`,
      };

    default:
      return {
        systemPrompt: 'You are F0 Code Agent.',
        userPrompt: `Modify file: ${filePath}`,
      };
  }
}

/**
 * Get all available code actions
 */
export function getAvailableCodeActions(locale: 'ar' | 'en' = 'en'): Array<{
  type: CodeActionType;
  label: string;
  description: string;
  icon: string;
}> {
  const isArabic = locale === 'ar';

  return [
    {
      type: 'auth-guard',
      label: isArabic ? '🔐 حماية بـ Auth' : '🔐 Protect with Auth',
      description: isArabic
        ? 'إضافة AuthGuard لحماية الصفحة'
        : 'Add AuthGuard to protect the page',
      icon: '🔐',
    },
    {
      type: 'add-loading-state',
      label: isArabic ? '⏳ إضافة حالة تحميل' : '⏳ Add Loading State',
      description: isArabic
        ? 'إضافة مؤشر تحميل للمكون'
        : 'Add loading indicator to component',
      icon: '⏳',
    },
    {
      type: 'add-error-handling',
      label: isArabic ? '🚨 إضافة معالجة الأخطاء' : '🚨 Add Error Handling',
      description: isArabic
        ? 'إضافة معالجة الأخطاء للمكون'
        : 'Add error handling to component',
      icon: '🚨',
    },
    {
      type: 'extract-component',
      label: isArabic ? '📦 استخراج كمكون' : '📦 Extract Component',
      description: isArabic
        ? 'استخراج الكود كمكون منفصل'
        : 'Extract code as separate component',
      icon: '📦',
    },
    {
      type: 'add-typescript-types',
      label: isArabic ? '📝 إضافة أنواع TS' : '📝 Add TS Types',
      description: isArabic
        ? 'إضافة أنواع TypeScript'
        : 'Add TypeScript types',
      icon: '📝',
    },
  ];
}

export default buildCodeActionPrompts;
