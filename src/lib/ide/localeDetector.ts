/**
 * Phase 169: Cloud Agent Locale Intelligence
 * Utilities for detecting message language and explicit language switches
 *
 * Helps the Cloud Agent respond in the same language as the user's message,
 * regardless of what locale the IDE sends.
 */

export type DetectedLocale = 'ar' | 'en' | 'mixed';

/**
 * Phase 169.1: Detect the language of a message based on character analysis
 *
 * @param text - The message text to analyze
 * @returns 'ar' for Arabic, 'en' for English/Latin, 'mixed' for both
 */
export function detectMessageLanguage(text: string): DetectedLocale {
  if (!text || text.trim().length === 0) {
    return 'en'; // Default to English for empty messages
  }

  // Remove code blocks, URLs, file paths, and common programming terms
  // These shouldn't affect language detection
  const cleanedText = text
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
    .replace(/[\/\\][\w\-\.\/\\]+/g, '') // Remove file paths
    .replace(/\b(function|const|let|var|import|export|class|interface|type|return|if|else|for|while)\b/gi, '') // Remove JS keywords
    .trim();

  if (cleanedText.length === 0) {
    return 'en'; // If only code/paths remain, default to English
  }

  // Count Arabic vs Latin characters
  let arabicCount = 0;
  let latinCount = 0;

  for (const char of cleanedText) {
    const code = char.charCodeAt(0);
    // Arabic Unicode range: 0x0600-0x06FF (Arabic), 0x0750-0x077F (Arabic Supplement)
    if ((code >= 0x0600 && code <= 0x06FF) || (code >= 0x0750 && code <= 0x077F)) {
      arabicCount++;
    }
    // Latin letters (A-Z, a-z)
    else if ((code >= 0x0041 && code <= 0x005A) || (code >= 0x0061 && code <= 0x007A)) {
      latinCount++;
    }
  }

  const totalLetters = arabicCount + latinCount;
  if (totalLetters === 0) {
    return 'en'; // No letters found, default to English
  }

  const arabicRatio = arabicCount / totalLetters;
  const latinRatio = latinCount / totalLetters;

  // If message has significant amount of both languages
  if (arabicRatio > 0.2 && latinRatio > 0.2) {
    // More Arabic than Latin → Arabic
    if (arabicRatio > latinRatio) {
      return 'ar';
    }
    return 'mixed';
  }

  // Predominantly Arabic
  if (arabicRatio > 0.5) {
    return 'ar';
  }

  // Predominantly Latin
  if (latinRatio > 0.5) {
    return 'en';
  }

  // Edge case: mostly symbols/numbers
  return 'en';
}

/**
 * Phase 169.2: Detect explicit language switch commands in the message
 *
 * Users can explicitly request a language by saying:
 * - "بالعربي" / "بالعربى" → switch to Arabic
 * - "بالإنجليزي" / "بالانجليزي" / "بالإنجليزية" / "in English" → switch to English
 *
 * @param text - The message text to check
 * @returns 'ar' | 'en' | null (null means no explicit switch)
 */
export function detectExplicitLanguageSwitch(text: string): 'ar' | 'en' | null {
  if (!text) return null;

  // Arabic switch patterns (various spellings)
  const arabicPatterns = [
    /\bبالعربي\b/i,
    /\bبالعربى\b/i,
    /\bبالعربية\b/i,
    /\bرد\s*بالعربي/i,
    /\bجاوب\s*بالعربي/i,
    /\bاكتب\s*بالعربي/i,
    /\bin\s+arabic\b/i,
    /\brespond\s+in\s+arabic\b/i,
    /\banswer\s+in\s+arabic\b/i,
  ];

  // English switch patterns
  const englishPatterns = [
    /\bبالإنجليزي\b/i,
    /\bبالانجليزي\b/i,
    /\bبالإنجليزية\b/i,
    /\bبالانجليزية\b/i,
    /\bرد\s*بالإنجليزي/i,
    /\bجاوب\s*بالإنجليزي/i,
    /\bin\s+english\b/i,
    /\brespond\s+in\s+english\b/i,
    /\banswer\s+in\s+english\b/i,
    /\bplease\s+in\s+english\b/i,
  ];

  // Check for explicit Arabic switch
  for (const pattern of arabicPatterns) {
    if (pattern.test(text)) {
      return 'ar';
    }
  }

  // Check for explicit English switch
  for (const pattern of englishPatterns) {
    if (pattern.test(text)) {
      return 'en';
    }
  }

  return null;
}

/**
 * Phase 169: Compute the effective locale for agent response
 *
 * Priority:
 * 1. Explicit language switch (highest priority)
 * 2. Detected message language (if not mixed)
 * 3. IDE-provided locale (fallback)
 *
 * @param message - User's message
 * @param ideLocale - Locale sent by IDE
 * @returns The effective locale to use for the agent's response
 */
export function computeEffectiveLocale(
  message: string,
  ideLocale: 'ar' | 'en' = 'en'
): {
  effectiveLocale: 'ar' | 'en';
  reason: 'explicit_switch' | 'message_language' | 'ide_locale';
  detected: DetectedLocale;
  explicitSwitch: 'ar' | 'en' | null;
} {
  // 1. Check for explicit language switch
  const explicitSwitch = detectExplicitLanguageSwitch(message);
  if (explicitSwitch) {
    return {
      effectiveLocale: explicitSwitch,
      reason: 'explicit_switch',
      detected: detectMessageLanguage(message),
      explicitSwitch,
    };
  }

  // 2. Detect message language
  const detected = detectMessageLanguage(message);

  // If message is predominantly in one language (not mixed), use that
  if (detected === 'ar') {
    return {
      effectiveLocale: 'ar',
      reason: 'message_language',
      detected,
      explicitSwitch: null,
    };
  }

  if (detected === 'en') {
    return {
      effectiveLocale: 'en',
      reason: 'message_language',
      detected,
      explicitSwitch: null,
    };
  }

  // 3. Mixed language or unknown - use IDE locale
  return {
    effectiveLocale: ideLocale,
    reason: 'ide_locale',
    detected,
    explicitSwitch: null,
  };
}

/**
 * Phase 176.1: Detect if message is a multimodal command (image/audio/file analysis)
 *
 * Multimodal commands should ALWAYS use the user's message language,
 * regardless of the content language (e.g., English transcript, English file content)
 *
 * Phase 176.4: Enhanced to detect file paths following Arabic commands
 *
 * @param message - User's message
 * @returns true if this is a multimodal analysis command
 */
export function isMultimodalCommand(message: string): boolean {
  if (!message) return false;

  const text = message.toLowerCase();

  // Arabic multimodal patterns
  const arabicMultimodalPatterns = [
    /حلل\s*(ال)?(صور[ةه]|صوت|ملف|مستند|pdf|وورد|اكسل)/,
    /شرح\s*(ال)?(صور[ةه]|صوت|ملف)/,
    /وصف\s*(ال)?(صور[ةه]|صوت|ملف)/,
    /ترجم\s*(ال)?(صور[ةه]|صوت|ملف)/,
    /لخص\s*(ال)?(صور[ةه]|صوت|ملف|مستند|pdf)/,
    /(ايش|ايه|شو)\s*(في|ب)\s*(ال)?(صور[ةه]|صوت|ملف)/,
    /عن\s*(ال)?(صور[ةه]|صوت|ملف)/,
    // Phase 176.4: Arabic command followed by file path (e.g., "حلل الملف /path/to/file.ts")
    /حلل\s+[\/~]/,  // "حلل" followed by path starting with / or ~
    /شرح\s+[\/~]/,
    /وصف\s+[\/~]/,
    /لخص\s+[\/~]/,
    /اقرأ\s+[\/~]/, // "اقرأ" = read
    /افتح\s+[\/~]/, // "افتح" = open
  ];

  // English multimodal patterns
  const englishMultimodalPatterns = [
    /analyze\s+(the\s+)?(image|picture|screenshot|audio|recording|file|document)/i,
    /describe\s+(the\s+)?(image|picture|screenshot|audio)/i,
    /explain\s+(the\s+)?(image|picture|screenshot|audio|file)/i,
    /summarize\s+(the\s+)?(audio|recording|file|document|pdf)/i,
    /what('s| is)\s+(in\s+)?(the\s+)?(image|picture|screenshot|audio|file)/i,
    /transcribe\s+(the\s+)?(audio|recording)/i,
    // Phase 176.4: English command followed by file path
    /analyze\s+[\/~]/i,
    /explain\s+[\/~]/i,
    /describe\s+[\/~]/i,
    /read\s+[\/~]/i,
  ];

  // Check patterns
  for (const pattern of arabicMultimodalPatterns) {
    if (pattern.test(text)) return true;
  }

  for (const pattern of englishMultimodalPatterns) {
    if (pattern.test(text)) return true;
  }

  return false;
}

/**
 * Phase 176.2: Generate STRONG language instruction for system prompt
 *
 * Returns a very strong, enforced instruction to include in the system prompt
 * to ensure the agent responds in the correct language.
 *
 * Phase 176 improvements:
 * - Much stronger language enforcement
 * - Explicit rules about RAG/file content not affecting response language
 * - Special handling for multimodal commands
 *
 * @param locale - The locale to respond in
 * @param reason - Why this locale was chosen
 * @param isMultimodal - Whether this is a multimodal command (image/audio/file)
 * @returns Instruction string to add to system prompt
 */
export function getLanguageInstruction(
  locale: 'ar' | 'en',
  reason: 'explicit_switch' | 'message_language' | 'ide_locale',
  isMultimodal: boolean = false
): string {
  if (locale === 'ar') {
    if (reason === 'explicit_switch') {
      return `
🚨 **قواعد اللغة الإلزامية (طلب صريح من المستخدم):**
المستخدم طلب الرد بالعربي صراحةً.

**قواعد صارمة:**
1. ✅ جميع الشرح والتوضيحات يجب أن تكون بالعربية
2. ✅ استخدم العربية الفصحى أو العامية المصرية
3. ✅ يمكن إبقاء أسماء الملفات والمتغيرات والكود بالإنجليزية
4. ❌ ممنوع الرد بالإنجليزية حتى لو الملفات/الكود/RAG بالإنجليزية
5. ❌ ممنوع التبديل للإنجليزية في منتصف الرد

**CRITICAL:** User EXPLICITLY requested Arabic. You MUST respond entirely in Arabic. Do NOT switch to English under any circumstances. Keep only code identifiers in English.
`;
    }

    // Multimodal command with Arabic message
    if (isMultimodal) {
      return `
🚨 **قواعد اللغة الإلزامية (أمر تحليل صورة/صوت/ملف):**
المستخدم يسأل بالعربي عن صورة/صوت/ملف.

**قواعد صارمة جداً:**
1. ✅ الرد كاملاً بالعربية - بدون استثناء
2. ✅ حتى لو محتوى الصوت/الملف بالإنجليزية، الشرح يكون عربي
3. ✅ حتى لو الـ transcript إنجليزي، ردك يكون عربي
4. ✅ يمكن اقتباس النص الأصلي كما هو، لكن التحليل عربي
5. ❌ ممنوع التبديل للإنجليزية لأن المحتوى إنجليزي

**CRITICAL MULTIMODAL RULE:** User's question is in Arabic about an image/audio/file. Even if the content is in English, you MUST respond ENTIRELY in Arabic. The content language does NOT determine your response language - only the USER's message language matters.
`;
    }

    // Regular Arabic message
    return `
🚨 **قواعد اللغة الإلزامية:**
رسالة المستخدم بالعربي، فيجب الرد بالعربي.

**قواعد صارمة:**
1. ✅ الرد كاملاً بالعربية
2. ✅ يمكن إبقاء أسماء الملفات والكود بالإنجليزية
3. ❌ ممنوع التبديل للإنجليزية لأن الملفات/RAG بالإنجليزية
4. ❌ لغة المشروع أو الكود لا تحدد لغة ردك

**CRITICAL:** User's message is in Arabic. Respond ENTIRELY in Arabic. Do NOT switch to English because code/files are in English. Only code identifiers may remain in English.
`;
  }

  // English locale
  if (reason === 'explicit_switch') {
    return `
🚨 **MANDATORY Language Rules (Explicit User Request):**
The user explicitly requested an English response.

**Strict Rules:**
1. ✅ ALL explanations and descriptions must be in English
2. ✅ Use clear, professional English
3. ✅ Keep code, file names, and identifiers as-is
4. ❌ Do NOT respond in Arabic even if user's message has Arabic text
5. ❌ Do NOT switch languages mid-response

**CRITICAL:** User EXPLICITLY requested English. You MUST respond entirely in English.
`;
  }

  // Multimodal command with English message
  if (isMultimodal) {
    return `
🚨 **MANDATORY Language Rules (Image/Audio/File Analysis):**
User is asking in English about an image/audio/file.

**Strict Rules:**
1. ✅ Respond entirely in English
2. ✅ Even if content has Arabic text, explain in English
3. ✅ You may quote original text, but analysis must be in English

**CRITICAL MULTIMODAL RULE:** User's question is in English. Respond ENTIRELY in English.
`;
  }

  // Regular English message
  return `
🚨 **MANDATORY Language Rules:**
User's message is in English. Respond in English.

**Strict Rules:**
1. ✅ Respond entirely in English
2. ✅ Be clear and professional
3. ❌ Do NOT switch to Arabic
`;
}

/**
 * Phase 170.2: Detect if user is referring to a previous attachment
 *
 * Checks if the message contains phrases that reference a previous
 * image, audio, or document attachment.
 *
 * @param message - User's message
 * @returns Object with isReferring flag and detected attachment type
 */
export function detectAttachmentReference(message: string): {
  isReferring: boolean;
  attachmentType: 'image' | 'audio' | 'document' | null;
} {
  if (!message) {
    return { isReferring: false, attachmentType: null };
  }

  const text = message.toLowerCase();

  // Image reference patterns (Arabic + English)
  const imagePatterns = [
    /بالنسبة\s*(لل)?صور[ةه]/,
    /الصور[ةه]\s*(دي|دى|السابقة)?/,
    /نفس\s*الصور[ةه]/,
    /about\s+(the|this)\s+(image|picture|screenshot)/i,
    /same\s+(image|picture|screenshot)/i,
    /previous\s+(image|picture|screenshot)/i,
    /regarding\s+(the|this)\s+(image|picture)/i,
  ];

  // Audio reference patterns (Arabic + English)
  const audioPatterns = [
    /بالنسبة\s*(لل)?صوت/,
    /التسجيل\s*(ده|السابق)?/,
    /الصوت\s*(ده|دى|السابق)?/,
    /نفس\s*(التسجيل|الصوت)/,
    /about\s+(the|this)\s+(audio|recording|voice)/i,
    /same\s+(audio|recording)/i,
    /previous\s+(audio|recording)/i,
    /regarding\s+(the|this)\s+(audio|recording)/i,
    /the\s+transcription/i,
  ];

  // Document reference patterns (Arabic + English)
  const documentPatterns = [
    /بالنسبة\s*(لل)?(ملف|مستند|وورد|اكسل|pdf)/,
    /(الملف|المستند|الوورد|الاكسل)\s*(ده|دى|السابق)?/,
    /نفس\s*(الملف|المستند)/,
    /about\s+(the|this)\s+(file|document|pdf|word|excel)/i,
    /same\s+(file|document)/i,
    /previous\s+(file|document)/i,
    /regarding\s+(the|this)\s+(file|document)/i,
    /the\s+(attached|uploaded)\s+(file|document)/i,
  ];

  // Check each category
  for (const pattern of imagePatterns) {
    if (pattern.test(text)) {
      return { isReferring: true, attachmentType: 'image' };
    }
  }

  for (const pattern of audioPatterns) {
    if (pattern.test(text)) {
      return { isReferring: true, attachmentType: 'audio' };
    }
  }

  for (const pattern of documentPatterns) {
    if (pattern.test(text)) {
      return { isReferring: true, attachmentType: 'document' };
    }
  }

  return { isReferring: false, attachmentType: null };
}

/**
 * Phase 180.10: Detect if message is a simple greeting/casual chat
 *
 * When the user sends a simple greeting like "هاي", "hello", "مرحبا",
 * we should NOT include file context in the response - just respond naturally.
 *
 * @param message - User's message
 * @returns true if this is a simple greeting/casual chat
 */
export function isSimpleGreeting(message: string): boolean {
  if (!message) return false;

  const text = message.trim().toLowerCase();

  // If message is too long, it's not a simple greeting
  if (text.length > 50) return false;

  // Arabic greetings (Egyptian + Gulf + MSA)
  const arabicGreetings = [
    'هاي', 'هاى', 'hi', 'هايي',
    'مرحبا', 'مرحبًا', 'اهلا', 'أهلا', 'أهلاً',
    'سلام', 'السلام عليكم', 'السلام',
    'صباح الخير', 'مساء الخير',
    'ازيك', 'ازايك', 'عامل ايه', 'عامل ايه؟',
    'كيفك', 'كيف حالك', 'شلونك', 'شخبارك',
    'يا هلا', 'هلا', 'هلا والله',
    'شو', 'ايش', 'ايه', 'ايوه',
    'تمام', 'طيب', 'اوكي', 'حاضر',
    'يب', 'اي', 'نعم', 'لا',
    'مممم', 'هممم', 'آها', 'اها',
    'شكرا', 'شكراً', 'شكرًا', 'مشكور', 'تسلم',
    'احسنت', 'ممتاز', 'جميل', 'رائع',
    'باي', 'مع السلامة', 'سلام',
  ];

  // English greetings
  const englishGreetings = [
    'hi', 'hey', 'hello', 'yo', 'sup',
    'good morning', 'morning', 'good evening', 'evening',
    'good afternoon', 'afternoon', 'good night',
    'how are you', "how's it going", 'what up', "what's up",
    'thanks', 'thank you', 'thx', 'ty',
    'ok', 'okay', 'k', 'alright', 'sure', 'yes', 'no', 'yeah', 'yep', 'nope',
    'cool', 'nice', 'great', 'awesome', 'perfect',
    'bye', 'goodbye', 'see you', 'cya', 'later',
    'hmm', 'hm', 'mmm', 'ah', 'aha', 'oh',
    'lol', 'haha', 'hehe',
    '👋', '😊', '👍', '🙏',
  ];

  // Check exact matches
  if (arabicGreetings.includes(text) || englishGreetings.includes(text)) {
    return true;
  }

  // Check if message starts with common greeting patterns
  const greetingPatterns = [
    /^(هاي|هايي|مرحبا|اهلا|سلام)\s*[!.]*$/i,
    /^(hi|hey|hello|yo)\s*[!.]*$/i,
    /^(ازيك|ازايك|كيفك)\s*[?؟!.]*$/i,
    /^(how are you|how's it going)\s*[?!.]*$/i,
    /^(thanks|thank you|شكرا)\s*[!.]*$/i,
    /^(ok|okay|تمام|طيب)\s*[!.]*$/i,
  ];

  for (const pattern of greetingPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Phase 180.11: Detect if message is asking about the project overview
 *
 * When the user asks "عايز اعرف مجمل المشروع ده" or "what is this project about",
 * they want to know about the WHOLE project, not just the open file.
 *
 * @param message - User's message
 * @returns true if this is a project-level question
 */
export function isProjectOverviewQuestion(message: string): boolean {
  if (!message) return false;

  const text = message.trim().toLowerCase();

  // Arabic patterns for project overview questions
  const arabicPatterns = [
    /(?:عايز|عاوز|محتاج|ابي|ابغى)\s*(?:اعرف|افهم)\s*(?:مجمل|عن|ايه)\s*(?:المشروع|البروجكت|الكود)/i,
    /(?:ايه|شو|ما)\s*(?:هو|هي|هذا)?\s*(?:المشروع|البروجكت)\s*(?:ده|دا|هذا|ذا)?/i,
    /(?:اشرح|فسر|وضح)\s*(?:لي)?\s*(?:المشروع|البروجكت|الكود)\s*(?:كله|بالكامل)?/i,
    /(?:المشروع|البروجكت)\s*(?:ده|دا|هذا)?\s*(?:بيعمل|يعمل|عن)\s*(?:ايه|شو|ما)/i,
    /(?:فكرة|ملخص|نظرة|لمحة)\s*(?:عامة|عن)?\s*(?:المشروع|البروجكت)/i,
    /(?:عايز|عاوز|محتاج)\s*(?:اعرف)?\s*(?:امكانيات|ميزات|فيتشرز)\s*(?:المشروع|البروجكت)/i,
    /(?:المشروع|البروجكت)\s*(?:ده|دا)?\s*(?:بيتكلم|يتكلم|بياكلم|يحكي)\s*(?:عن)?\s*(?:ايه|شو|ما)/i,
  ];

  // English patterns for project overview questions
  const englishPatterns = [
    /(?:what|tell me)\s*(?:is|about)\s*(?:this)?\s*(?:project|codebase|repo)/i,
    /(?:explain|describe|summarize)\s*(?:the|this)?\s*(?:project|codebase|application)/i,
    /(?:project|app|application)\s*(?:overview|summary|description)/i,
    /(?:what|how)\s*(?:does|is)\s*(?:this|the)\s*(?:project|app|application)\s*(?:do|about)/i,
    /(?:give me|provide)\s*(?:an?)?\s*(?:overview|summary)\s*(?:of)?\s*(?:the|this)?\s*(?:project|codebase)/i,
    /(?:features|capabilities)\s*(?:of)?\s*(?:this|the)?\s*(?:project|app)/i,
  ];

  // Check Arabic patterns
  for (const pattern of arabicPatterns) {
    if (pattern.test(text) || pattern.test(message)) {
      return true;
    }
  }

  // Check English patterns
  for (const pattern of englishPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}
