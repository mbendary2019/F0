/**
 * Phase 180.2: Browser Agent
 * Fetches web content and documentation from URLs
 *
 * Supports:
 * - Fetching documentation pages
 * - Extracting content from web pages
 * - Handling errors gracefully
 */

export interface BrowserFetchIntent {
  detected: boolean;
  url?: string;
  description?: string;
  isValidUrl: boolean;
  errorReason?: string;
}

export interface FetchedContent {
  success: boolean;
  url: string;
  title?: string;
  content?: string;
  error?: string;
  fetchedAt: Date;
}

/**
 * Pattern matchers for browser/fetch intent detection
 */
const BROWSER_PATTERNS = {
  // Fetch URL patterns
  fetchUrl: {
    ar: [
      /(?:جيبلي|هاتلي|اقرأ|افتح)\s*(?:المحتوى|الصفحة|المستند|الدوكيومنتيشن)?\s*(?:من|في|على)?\s*(https?:\/\/[^\s]+)/i,
      /(?:ايه|شو)\s*(?:المكتوب|الموجود)\s*(?:في|على)\s*(https?:\/\/[^\s]+)/i,
      /(?:وريني|شوفني)\s*(?:اللي في|محتوى)?\s*(https?:\/\/[^\s]+)/i,
    ],
    en: [
      /(?:fetch|get|read|open)\s*(?:the)?\s*(?:content|page|document|docs?)?\s*(?:from|at|on)?\s*(https?:\/\/[^\s]+)/i,
      /(?:what's|what\s+is)\s*(?:on|at|in)\s*(https?:\/\/[^\s]+)/i,
      /(?:show\s+me|display)\s*(?:the)?\s*(?:content)?\s*(?:of|from)?\s*(https?:\/\/[^\s]+)/i,
      /(?:can\s+you\s+)?(?:fetch|read)\s*(https?:\/\/[^\s]+)/i,
    ],
  },

  // Fetch documentation patterns
  fetchDocs: {
    ar: [
      /(?:جيبلي|هاتلي|اقرأ)\s*(?:دوكيومنتيشن|التوثيق|الدوكس)\s*(?:بتاعة?|حقّ)?\s*(.+)/i,
      /(?:ابحث|دوّر)\s*(?:في|عن)\s*(?:دوكيومنتيشن|توثيق)\s*(.+)/i,
    ],
    en: [
      /(?:fetch|get|read|find)\s*(?:the)?\s*(?:documentation|docs?)\s*(?:for|of|about)?\s*(.+)/i,
      /(?:show\s+me|look\s+up)\s*(?:the)?\s*(?:documentation|docs?)\s*(?:for|of)?\s*(.+)/i,
    ],
  },

  // Phase 180.9: Web search patterns for news/latest/updates
  webSearch: {
    ar: [
      /(?:ايه|شو|ما)\s*(?:أخبار|اخبار|آخر|اخر)\s*(.+)/i,           // ايه أخبار React
      /(?:جديد|آخر|اخر)\s*(?:الأخبار|الاخبار|التحديثات)\s*(?:عن|في|بتاعة?)?\s*(.+)/i, // آخر الأخبار عن Next.js
      /(?:ايه|شو|ما)\s*الجديد\s*(?:في|عن|بخصوص)?\s*(.+)/i,        // ايه الجديد في TypeScript
      /(?:دوّر|ابحث)\s*(?:عن|على)\s*(.+)\s*(?:أخبار|اخبار|تحديثات)/i, // دوّر عن React أخبار
      /(?:أحدث|احدث|آخر|اخر)\s*(?:إصدار|اصدار|نسخة|version)\s*(?:من|بتاعة?)?\s*(.+)/i, // أحدث إصدار من Node
    ],
    en: [
      /(?:what's|what\s+is|any)\s*(?:new|latest|news)\s*(?:in|about|with|on)?\s*(.+)/i, // what's new in React
      /(?:latest|recent|new)\s*(?:news|updates?|releases?|version)\s*(?:of|for|about|in)?\s*(.+)/i, // latest news about Next.js
      /(?:search|find|look\s+up)\s*(?:for)?\s*(.+)\s*(?:news|updates?|releases?)/i, // search for React news
      /(?:what)\s*(?:is|are)\s*(?:the)?\s*(?:latest|newest|recent)\s*(?:updates?|changes?|features?)\s*(?:in|for|of)?\s*(.+)/i, // what are the latest updates in TypeScript
      /(?:check|get)\s*(?:the)?\s*(?:latest|recent)\s*(?:on|about|for)\s*(.+)/i, // check the latest on Node
    ],
  },
};

/**
 * Blocked/dangerous domains
 */
const BLOCKED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'internal',
  'intranet',
  '.local',
];

/**
 * Validate URL for safety
 */
function isUrlSafe(url: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(url);

    // Check protocol
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { safe: false, reason: `Invalid protocol: ${parsed.protocol}` };
    }

    // Check for blocked domains
    for (const blocked of BLOCKED_DOMAINS) {
      if (parsed.hostname.includes(blocked)) {
        return { safe: false, reason: `Blocked domain: ${parsed.hostname}` };
      }
    }

    // Check for IP addresses (might be internal)
    if (/^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname)) {
      return { safe: false, reason: 'Direct IP addresses are not allowed' };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }
}

/**
 * Build documentation URL for common libraries
 */
function buildDocsUrl(library: string): string | null {
  const lib = library.toLowerCase().trim();

  const docsMap: Record<string, string> = {
    // JavaScript/TypeScript
    react: 'https://react.dev/reference',
    nextjs: 'https://nextjs.org/docs',
    'next.js': 'https://nextjs.org/docs',
    vue: 'https://vuejs.org/guide/',
    angular: 'https://angular.io/docs',
    svelte: 'https://svelte.dev/docs',
    typescript: 'https://www.typescriptlang.org/docs/',
    ts: 'https://www.typescriptlang.org/docs/',

    // Backend
    nodejs: 'https://nodejs.org/en/docs/',
    'node.js': 'https://nodejs.org/en/docs/',
    express: 'https://expressjs.com/en/4x/api.html',
    fastify: 'https://www.fastify.io/docs/latest/',
    nestjs: 'https://docs.nestjs.com/',

    // Firebase
    firebase: 'https://firebase.google.com/docs',
    firestore: 'https://firebase.google.com/docs/firestore',
    'firebase auth': 'https://firebase.google.com/docs/auth',
    'firebase functions': 'https://firebase.google.com/docs/functions',

    // Databases
    mongodb: 'https://docs.mongodb.com/',
    postgres: 'https://www.postgresql.org/docs/',
    postgresql: 'https://www.postgresql.org/docs/',
    mysql: 'https://dev.mysql.com/doc/',
    redis: 'https://redis.io/docs/',

    // CSS/Styling
    tailwind: 'https://tailwindcss.com/docs',
    tailwindcss: 'https://tailwindcss.com/docs',
    'styled-components': 'https://styled-components.com/docs',

    // Testing
    jest: 'https://jestjs.io/docs/getting-started',
    vitest: 'https://vitest.dev/guide/',
    playwright: 'https://playwright.dev/docs/intro',
    cypress: 'https://docs.cypress.io/',

    // Build tools
    vite: 'https://vitejs.dev/guide/',
    webpack: 'https://webpack.js.org/concepts/',
    esbuild: 'https://esbuild.github.io/',

    // Package managers
    npm: 'https://docs.npmjs.com/',
    pnpm: 'https://pnpm.io/motivation',
    yarn: 'https://yarnpkg.com/getting-started',

    // APIs
    openai: 'https://platform.openai.com/docs',
    stripe: 'https://stripe.com/docs',
    twilio: 'https://www.twilio.com/docs',

    // Mobile
    'react native': 'https://reactnative.dev/docs/getting-started',
    flutter: 'https://docs.flutter.dev/',
    expo: 'https://docs.expo.dev/',

    // Other
    docker: 'https://docs.docker.com/',
    kubernetes: 'https://kubernetes.io/docs/',
    k8s: 'https://kubernetes.io/docs/',
    git: 'https://git-scm.com/doc',
    github: 'https://docs.github.com/',
  };

  return docsMap[lib] || null;
}

/**
 * Detect browser/fetch intent from user message
 */
export function detectBrowserIntent(
  message: string,
  locale: 'ar' | 'en' = 'en'
): BrowserFetchIntent {
  const msg = message.trim();
  const otherLocale = locale === 'ar' ? 'en' : 'ar';

  // Try URL fetch patterns
  for (const lang of [locale, otherLocale]) {
    for (const pattern of BROWSER_PATTERNS.fetchUrl[lang]) {
      const match = msg.match(pattern);
      if (match) {
        const url = match[1].trim();
        const safety = isUrlSafe(url);

        console.log(`[BrowserAgent] Detected URL fetch intent: ${url}`);

        return {
          detected: true,
          url,
          description: locale === 'ar'
            ? `جلب محتوى: ${url}`
            : `Fetch content from: ${url}`,
          isValidUrl: safety.safe,
          errorReason: safety.reason,
        };
      }
    }
  }

  // Try documentation fetch patterns
  for (const lang of [locale, otherLocale]) {
    for (const pattern of BROWSER_PATTERNS.fetchDocs[lang]) {
      const match = msg.match(pattern);
      if (match) {
        const library = match[1].trim();
        const docsUrl = buildDocsUrl(library);

        console.log(`[BrowserAgent] Detected docs fetch intent for: ${library}`);

        if (docsUrl) {
          return {
            detected: true,
            url: docsUrl,
            description: locale === 'ar'
              ? `جلب توثيق: ${library}`
              : `Fetch documentation for: ${library}`,
            isValidUrl: true,
          };
        } else {
          // Try Google search for docs
          const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(library + ' documentation')}`;
          return {
            detected: true,
            url: searchUrl,
            description: locale === 'ar'
              ? `البحث عن توثيق: ${library}`
              : `Search for documentation: ${library}`,
            isValidUrl: true,
          };
        }
      }
    }
  }

  // Check if message contains a URL (even without explicit fetch intent)
  const urlMatch = msg.match(/(https?:\/\/[^\s]+)/);
  if (urlMatch) {
    const url = urlMatch[1];
    const safety = isUrlSafe(url);

    // Only detect as intent if asking a question about the URL
    const hasQuestion = /\?|ما|ايش|شو|what|how|explain|اشرح/.test(msg);
    if (hasQuestion) {
      console.log(`[BrowserAgent] Detected implicit URL intent: ${url}`);
      return {
        detected: true,
        url,
        description: locale === 'ar'
          ? `تحليل: ${url}`
          : `Analyze: ${url}`,
        isValidUrl: safety.safe,
        errorReason: safety.reason,
      };
    }
  }

  return { detected: false, isValidUrl: true };
}

/**
 * Fetch content from URL using server-side API
 * This should be called from the main process or via IPC
 */
export async function fetchWebContent(
  url: string,
  apiEndpoint: string = '/api/ide/web-fetch'
): Promise<FetchedContent> {
  try {
    console.log(`[BrowserAgent] Fetching content from: ${url}`);

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        url,
        error: `HTTP ${response.status}: ${error}`,
        fetchedAt: new Date(),
      };
    }

    const data = await response.json();

    return {
      success: true,
      url,
      title: data.title,
      content: data.content,
      fetchedAt: new Date(),
    };
  } catch (error: any) {
    console.error(`[BrowserAgent] Fetch error:`, error);
    return {
      success: false,
      url,
      error: error.message || 'Failed to fetch content',
      fetchedAt: new Date(),
    };
  }
}

/**
 * Format fetched content for display
 */
export function formatFetchedContent(
  result: FetchedContent,
  locale: 'ar' | 'en' = 'en'
): string {
  if (!result.success) {
    if (locale === 'ar') {
      return `❌ **فشل جلب المحتوى**\n\nURL: ${result.url}\nالخطأ: ${result.error}`;
    }
    return `❌ **Failed to fetch content**\n\nURL: ${result.url}\nError: ${result.error}`;
  }

  const title = result.title || 'No title';
  const content = result.content || 'No content extracted';

  // Truncate very long content
  const maxLength = 10000;
  const truncatedContent = content.length > maxLength
    ? content.slice(0, maxLength) + '\n\n... [Content truncated]'
    : content;

  if (locale === 'ar') {
    return `📄 **${title}**\n\n🔗 ${result.url}\n\n---\n\n${truncatedContent}`;
  }
  return `📄 **${title}**\n\n🔗 ${result.url}\n\n---\n\n${truncatedContent}`;
}

/**
 * Format blocked URL message
 */
export function formatBlockedUrlMessage(
  intent: BrowserFetchIntent,
  locale: 'ar' | 'en' = 'en'
): string {
  if (locale === 'ar') {
    return `🚫 **تم حظر الرابط**\n\n${intent.errorReason}\n\nلأسباب أمنية، لا أستطيع الوصول إلى هذا الرابط.`;
  }
  return `🚫 **URL Blocked**\n\n${intent.errorReason}\n\nFor security reasons, I cannot access this URL.`;
}

// ============================================
// Phase 180.9: Web Search Intent Detection
// For queries about news, latest updates, documentation
// ============================================

export interface WebSearchIntent {
  detected: boolean;
  topic?: string;
  searchQuery?: string;
  description?: string;
}

/**
 * Detect if user is asking about news, latest updates, or wants to search the web
 * Examples:
 * - "ايه أخبار React" → search for React news
 * - "what's new in Next.js 15" → search for Next.js 15 updates
 * - "أحدث إصدار من Node" → search for latest Node version
 */
export function detectWebSearchIntent(
  message: string,
  locale: 'ar' | 'en' = 'en'
): WebSearchIntent {
  const msg = message.trim();
  const otherLocale = locale === 'ar' ? 'en' : 'ar';

  // Try web search patterns
  for (const lang of [locale, otherLocale]) {
    for (const pattern of BROWSER_PATTERNS.webSearch[lang]) {
      const match = msg.match(pattern);
      if (match) {
        const topic = match[1]?.trim();
        if (topic) {
          // Build a search-friendly query
          const searchQuery = lang === 'ar'
            ? `${topic} أخبار تحديثات latest`
            : `${topic} latest news updates`;

          console.log(`[BrowserAgent] Detected web search intent for: ${topic}`);

          return {
            detected: true,
            topic,
            searchQuery,
            description: lang === 'ar'
              ? `🔍 البحث عن: ${topic}`
              : `🔍 Searching for: ${topic}`,
          };
        }
      }
    }
  }

  return { detected: false };
}

/**
 * Build a Google search URL for web search intent
 */
export function buildSearchUrl(intent: WebSearchIntent): string {
  if (!intent.detected || !intent.searchQuery) {
    return '';
  }
  return `https://www.google.com/search?q=${encodeURIComponent(intent.searchQuery)}`;
}

/**
 * Format web search response with context for LLM
 * This creates a message that will be passed to the Cloud Agent
 */
export function formatWebSearchContext(
  intent: WebSearchIntent,
  fetchedContent: FetchedContent | null,
  locale: 'ar' | 'en' = 'en'
): string {
  if (!intent.detected) {
    return '';
  }

  const header = locale === 'ar'
    ? `🔍 **نتائج البحث عن: ${intent.topic}**\n\n`
    : `🔍 **Search results for: ${intent.topic}**\n\n`;

  if (!fetchedContent || !fetchedContent.success) {
    const fallback = locale === 'ar'
      ? `لم أتمكن من جلب النتائج. يمكنك البحث مباشرة:\n${buildSearchUrl(intent)}`
      : `Could not fetch results. You can search directly:\n${buildSearchUrl(intent)}`;
    return header + fallback;
  }

  // Format the content nicely
  const content = fetchedContent.content || '';
  const truncated = content.length > 5000
    ? content.slice(0, 5000) + '\n\n... [Content truncated]'
    : content;

  return header + truncated;
}

/**
 * Check if a message might need web search (simple heuristic)
 * Used to decide whether to route to BrowserAgent
 */
export function mightNeedWebSearch(message: string): boolean {
  const keywords = [
    // Arabic
    'أخبار', 'اخبار', 'آخر', 'اخر', 'جديد', 'أحدث', 'احدث',
    'تحديثات', 'إصدار', 'اصدار', 'نسخة', 'version',
    // English
    'news', 'latest', 'recent', 'new', 'updates', 'release',
    'version', 'changelog', "what's new", 'whats new',
  ];

  const msgLower = message.toLowerCase();
  return keywords.some(kw => msgLower.includes(kw.toLowerCase()));
}
