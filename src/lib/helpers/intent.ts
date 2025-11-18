/**
 * Intent Classification for Agent Chat
 * Determines user intent to avoid over-planning
 */

export type Intent = 'smalltalk' | 'clarify' | 'plan' | 'execute';

/**
 * Classify user intent from message text
 * @param text - User message
 * @returns Intent type
 */
export function classifyIntent(text: string): Intent {
  const t = (text || '').trim().toLowerCase();

  // Explicit execution command
  if (/\b(نفذ|نفّذ|ابدأ|execute|run|go|start)\b/.test(t)) {
    return 'execute';
  }

  // Small talk / greetings (short messages)
  if (
    t.length <= 8 ||
    /\b(hi|hello|hey|هاي|هلا|مرحبا|مرحباً|سلام|أهلا|أهلاً|تمام|شكرا|شكراً|thanks|bye)\b/.test(t)
  ) {
    return 'smalltalk';
  }

  // Vague request without technical details
  const isVague = t.length < 30;
  const hasGenericIntent = /\b(عايز|أبي|ابغى|أريد|بدي|i want|i need|need|want)\b/.test(t);
  const hasTechnicalContext = /\b(next|nextjs|firebase|firestore|stripe|react|vue|angular|ios|android|api|database|auth|payment)\b/.test(t);

  if ((isVague || hasGenericIntent) && !hasTechnicalContext) {
    return 'clarify';
  }

  // Default: plan
  return 'plan';
}

/**
 * Get a friendly response for small talk
 * @param lang - Language (ar/en)
 * @returns Response message
 */
export function getSmallTalkResponse(lang: 'ar' | 'en' = 'ar'): string {
  return lang === 'ar'
    ? `أهلاً! 👋\n\nاعطني **نبذة موجزة** (سطرين) عن فكرتك:\n\n**مثال:**\n"منصة توصيل: المستخدمون يطلبون طعام، السائقون يوصلون، دفع Stripe"`
    : `Hello! 👋\n\nGive me a **brief description** (2 lines) about your idea:\n\n**Example:**\n"Delivery platform: Users order food, drivers deliver, Stripe payments"`;
}

/**
 * Get a response asking for project brief
 * @param lang - Language (ar/en)
 * @returns Response message
 */
export function getNeedBriefResponse(lang: 'ar' | 'en' = 'ar'): string {
  return lang === 'ar'
    ? `قبل التخطيط، احتاج **نبذة موجزة** عن المشروع:\n\n**مثال:**\n"تطبيق مثل Twitter: تسجيل دخول، منشورات، تعليقات، إعجابات، إشعارات"`
    : `Before planning, I need a **brief description** of the project:\n\n**Example:**\n"Twitter-like app: Login, posts, comments, likes, notifications"`;
}

/**
 * Generate intelligent brief from vague user request
 * This allows the agent to start planning even with minimal context
 */
export function generateAutoBrief(text: string, lang: 'ar' | 'en' = 'ar'): string {
  const t = text.toLowerCase();

  // Detect project type keywords
  const keywords: Record<string, string> = {
    // Arabic
    'توصيل|ديليفري': lang === 'ar'
      ? 'تطبيق توصيل: المستخدمون يطلبون منتجات، السائقون يوصلون، الدفع عبر Stripe'
      : 'Delivery app: Users order products, drivers deliver, payment via Stripe',
    'تواصل|شات|محادثة': lang === 'ar'
      ? 'منصة تواصل: تسجيل دخول، رسائل فورية، مجموعات، إشعارات'
      : 'Chat platform: Login, instant messages, groups, notifications',
    'تعليم|دورات|كورس': lang === 'ar'
      ? 'منصة تعليمية: تسجيل دخول، دورات فيديو، تقييم، شهادات'
      : 'Learning platform: Login, video courses, assessments, certificates',
    'متجر|تجارة|سوق': lang === 'ar'
      ? 'متجر إلكتروني: منتجات، سلة تسوق، دفع Stripe، تتبع شحن'
      : 'E-commerce store: Products, shopping cart, Stripe payments, shipping tracking',
    'حجز|مواعيد': lang === 'ar'
      ? 'نظام حجز: المستخدمون يحجزون مواعيد، الإدارة تدير التقويم، تأكيد تلقائي'
      : 'Booking system: Users book appointments, admins manage calendar, auto-confirmation',
    // English
    'delivery|courier': lang === 'ar'
      ? 'تطبيق توصيل: المستخدمون يطلبون، السائقون يوصلون، Stripe'
      : 'Delivery app: Users order, drivers deliver, Stripe payments',
    'chat|messaging': lang === 'ar'
      ? 'منصة محادثة: تسجيل دخول، رسائل، مجموعات'
      : 'Chat platform: Login, messaging, groups, notifications',
    'learning|education|course': lang === 'ar'
      ? 'منصة تعليمية: دورات، فيديو، اختبارات'
      : 'Learning platform: Courses, videos, quizzes, certificates',
    'shop|store|ecommerce': lang === 'ar'
      ? 'متجر إلكتروني: منتجات، سلة، دفع Stripe'
      : 'E-commerce: Products, cart, Stripe, shipping',
    'booking|appointment': lang === 'ar'
      ? 'نظام حجز: مواعيد، تأكيد، إشعارات'
      : 'Booking system: Appointments, confirmation, notifications',
  };

  // Match keywords
  for (const [pattern, brief] of Object.entries(keywords)) {
    if (new RegExp(pattern, 'i').test(t)) {
      return brief;
    }
  }

  // Fallback: Generic web app
  return lang === 'ar'
    ? 'تطبيق ويب: تسجيل دخول عبر Firebase Auth، قاعدة بيانات Firestore، واجهة Next.js'
    : 'Web app: Firebase Auth login, Firestore database, Next.js frontend';
}
