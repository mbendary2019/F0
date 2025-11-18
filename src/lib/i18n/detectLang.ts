/**
 * Language detection utility
 * Detects Arabic vs English from user input
 */

export type Lang = "ar" | "en";

/**
 * Detects language from input text
 * @param input - User input text
 * @param fallback - Fallback language if detection fails
 * @returns Detected language code
 */
export function detectLang(input: string, fallback: Lang = "ar"): Lang {
  if (!input || input.trim().length === 0) return fallback;

  const trimmed = input.trim();

  // Check for Arabic characters (Unicode range U+0600 to U+06FF)
  const hasArabic = /[\u0600-\u06FF]/.test(trimmed);
  if (hasArabic) return "ar";

  // Check for Latin/English characters
  const hasLatin = /[A-Za-z]/.test(trimmed);
  if (hasLatin) return "en";

  // No clear indicators - use fallback
  return fallback;
}

/**
 * Gets system message in detected language
 * @param lang - Language code
 * @returns System message for agent
 */
export function getSystemMessageForLang(lang: Lang): string {
  if (lang === "ar") {
    return "أجب دائمًا بنفس لغة المستخدم (العربية إن كانت الرسالة بالعربية). لا تستخدم عبارات تقنية مثل 'تم تلخيص الطلب'؛ تحدث طبيعيًا، وعندما يكون الطلب واضحًا انشئ خطة مراحل + مهام.";
  } else {
    return "Always reply in the user's language. No meta phrases like 'request summarized'. When clear, produce phases + tasks.";
  }
}
