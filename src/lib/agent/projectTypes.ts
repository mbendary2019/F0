// src/lib/agent/projectTypes.ts

export type ProjectType =
  | 'IDEA_DISCOVERY'       // مستخدم غير تقني بيرتب فكرته
  | 'MOBILE_APP_BUILDER'   // زي Vibecode / FlutterFlow
  | 'SAAS_DASHBOARD'       // SaaS عادي (لوحات تحكم / اشتراكات)
  | 'BOOKING_SYSTEM'       // حجز مواعيد (دكاترة، صالون، مطاعم)
  | 'ECOMMERCE'            // متجر / ماركت
  | 'MARKETPLACE'          // بائعين + عملاء (2-sided)
  | 'CRYPTO_TRADING'       // منصات كريبتو
  | 'AI_TOOLING'           // AI Agent / IDE / Code tools
  | 'GENERIC_APP';         // fallback

export interface ClassifiedIntent {
  projectType: ProjectType;
  isArabic: boolean;
  raw: string;
}

/**
 * خوارزمية خفيفة وسريعة لتحديد نوع المشروع من النص.
 * تقدر لاحقًا تستبدلها بـ LLM call لو حبيت.
 */
export function classifyProjectIdea(message: string): ClassifiedIntent {
  const raw = message.trim();
  const lower = raw.toLowerCase();

  const isArabic = /[\u0600-\u06FF]/.test(raw);

  // 0) IDEA_DISCOVERY - Check FIRST for non-technical users exploring ideas
  // Signals: vague language, asking for help, no technical background mentioned
  const ideaDiscoverySignals = [
    // Arabic patterns
    /فكرة جديدة|مش عارف أبدأ|معنديش خلفية تقنية|رتب الفكرة|رتبها لي|ساعدني في الفكرة/,
    /مش متأكد من الفكرة|عايز أبدأ مشروع|محتاج مساعدة في الفكرة|مش فاهم أبدأ منين/,
    /ساعدني أختار|إيه أفضل فكرة|عايز أعمل حاجة|نصحني بفكرة/,
    // English patterns
    /new idea|don't know where to start|no technical background|help me organize|help with idea/i,
    /not sure about|want to start|need help with idea|don't understand where to begin/i,
    /help me choose|what's the best idea|want to make something|suggest an idea/i,
  ];

  const hasIdeaDiscoverySignal = ideaDiscoverySignals.some(pattern => pattern.test(raw));

  // Check if message has strong keywords for other specific types
  const hasStrongKeywords =
    lower.includes('vibecode') ||
    lower.includes('flutterflow') ||
    lower.includes('app builder') ||
    lower.includes('booking') ||
    lower.includes('appointments') ||
    lower.includes('store') ||
    lower.includes('ecommerce') ||
    lower.includes('marketplace') ||
    lower.includes('crypto') ||
    lower.includes('trading') ||
    /حجز|مواعيد|متجر|سوق|ماركت|عملات رقمية/.test(raw);

  // If has idea discovery signal AND no strong specific keywords, classify as IDEA_DISCOVERY
  if (hasIdeaDiscoverySignal && !hasStrongKeywords) {
    return { projectType: 'IDEA_DISCOVERY', isArabic, raw };
  }

  // 1) Mobile App Builder / Vibecode style
  if (
    lower.includes('vibecode') ||
    lower.includes('vibe code') ||
    lower.includes('app builder') ||
    lower.includes('build apps from mobile') ||
    lower.includes('no-code mobile') ||
    lower.includes('flutterflow') ||
    /يعمل تطبيقات|بناء تطبيقات|صانع تطبيقات/.test(raw)
  ) {
    return { projectType: 'MOBILE_APP_BUILDER', isArabic, raw };
  }

  // 2) Booking systems
  if (
    lower.includes('booking') ||
    lower.includes('appointments') ||
    lower.includes('doctor app') ||
    lower.includes('reservation') ||
    /حجز|مواعيد|عيادة|دكاترة|صالون/.test(raw)
  ) {
    return { projectType: 'BOOKING_SYSTEM', isArabic, raw };
  }

  // 3) E-commerce / Marketplace
  if (
    lower.includes('store') ||
    lower.includes('ecommerce') ||
    lower.includes('shop') ||
    lower.includes('product catalog') ||
    /متجر|سوق|ماركت|منتجات/.test(raw)
  ) {
    // marketplace لو فيه بائعين / Vendors
    if (
      lower.includes('vendors') ||
      lower.includes('multi-vendor') ||
      lower.includes('sellers') ||
      /بائعين|محلات|تجار/.test(raw)
    ) {
      return { projectType: 'MARKETPLACE', isArabic, raw };
    }
    return { projectType: 'ECOMMERCE', isArabic, raw };
  }

  // 4) Crypto
  if (
    lower.includes('crypto') ||
    lower.includes('defi') ||
    lower.includes('trading') ||
    lower.includes('cryptocurrency') ||
    /عملات رقمية|منصة تداول|بيتكوين/.test(raw)
  ) {
    return { projectType: 'CRYPTO_TRADING', isArabic, raw };
  }

  // 5) AI / IDE / Code tools
  if (
    lower.includes('ide') ||
    lower.includes('code assistant') ||
    lower.includes('ai agent') ||
    lower.includes('from zero') ||
    lower.includes('code editor') ||
    /وكيل ذكي|مساعد برمجي|محرر أكواد/.test(raw)
  ) {
    return { projectType: 'AI_TOOLING', isArabic, raw };
  }

  // 6) SaaS dashboards في العموم
  if (
    lower.includes('saas') ||
    lower.includes('dashboard') ||
    lower.includes('admin panel') ||
    /ساس|لوحة تحكم|نظام إدارة/.test(raw)
  ) {
    return { projectType: 'SAAS_DASHBOARD', isArabic, raw };
  }

  // fallback
  return { projectType: 'GENERIC_APP', isArabic, raw };
}
