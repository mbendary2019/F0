/**
 * Plan Utility Functions
 * Canonical slug generation for phases and tasks
 */

/**
 * Canonicalize a phase/task title to a consistent slug
 * Handles common variations in Arabic and English
 */
export function canonicalize(str: string): string {
  if (!str) return '';

  let normalized = str.toLowerCase().trim();

  // Common Arabic variations → canonical slugs
  const arabicMappings: Record<string, string> = {
    // Frontend/UI variations
    'تطوير الواجهة الأمامية': 'frontend-ui',
    'تطوير واجهة المستخدم': 'frontend-ui',
    'بناء الواجهة': 'frontend-ui',
    'إنشاء الواجهة': 'frontend-ui',

    // Auth variations
    'إعداد المصادقة': 'auth-setup',
    'إعداد نظام المصادقة': 'auth-setup',
    'تكامل firebase auth': 'auth-setup',
    'تهيئة المصادقة': 'auth-setup',
    'إنشاء نظام تسجيل الدخول': 'auth-setup',

    // Database variations
    'إعداد قاعدة البيانات': 'firestore-setup',
    'تهيئة firestore': 'firestore-setup',
    'إنشاء قاعدة البيانات': 'firestore-setup',
    'تكوين firestore': 'firestore-setup',

    // Stripe/Payment variations
    'دمج نظام الاشتراك': 'stripe-integration',
    'تكامل stripe': 'stripe-integration',
    'تكامل stripe للمدفوعات': 'stripe-integration',
    'إعداد الدفع': 'stripe-integration',
    'تكامل المدفوعات': 'stripe-integration',

    // API variations
    'بناء api': 'api-development',
    'تطوير api': 'api-development',
    'إنشاء endpoints': 'api-development',

    // Testing variations
    'اختبار التطبيق': 'testing',
    'كتابة الاختبارات': 'testing',
    'إعداد الاختبارات': 'testing',

    // Deployment variations
    'نشر التطبيق': 'deployment',
    'رفع التطبيق': 'deployment',
    'إطلاق التطبيق': 'deployment',
  };

  // Apply mappings
  for (const [pattern, slug] of Object.entries(arabicMappings)) {
    if (normalized.includes(pattern)) {
      return slug;
    }
  }

  // Common English variations → canonical slugs
  const englishMappings: Record<string, string> = {
    'setup firebase authentication': 'auth-setup',
    'configure firebase auth': 'auth-setup',
    'implement authentication': 'auth-setup',
    'setup authentication': 'auth-setup',

    'setup firestore': 'firestore-setup',
    'configure firestore': 'firestore-setup',
    'setup database': 'firestore-setup',

    'integrate stripe': 'stripe-integration',
    'setup stripe': 'stripe-integration',
    'implement payments': 'stripe-integration',

    'build frontend': 'frontend-ui',
    'develop ui': 'frontend-ui',
    'create frontend': 'frontend-ui',

    'build api': 'api-development',
    'develop api': 'api-development',
    'create endpoints': 'api-development',

    'write tests': 'testing',
    'setup testing': 'testing',
    'implement tests': 'testing',

    'deploy application': 'deployment',
    'deploy app': 'deployment',
    'launch app': 'deployment',
  };

  // Apply English mappings
  for (const [pattern, slug] of Object.entries(englishMappings)) {
    if (normalized.includes(pattern)) {
      return slug;
    }
  }

  // Fallback: create slug from original text
  return normalized
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9\-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50); // Limit length
}

/**
 * Generate a deterministic ID from a canonical slug
 */
export function generatePhaseId(title: string): string {
  const slug = canonicalize(title);
  return `phase-${slug || 'untitled'}`;
}

/**
 * Generate a deterministic task ID from phase and task titles
 */
export function generateTaskId(phaseTitle: string, taskTitle: string): string {
  const phaseSlug = canonicalize(phaseTitle);
  const taskSlug = canonicalize(taskTitle);
  return `task-${phaseSlug}-${taskSlug}`;
}
