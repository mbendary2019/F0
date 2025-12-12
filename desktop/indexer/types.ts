// desktop/indexer/types.ts
// Phase 120.0: Project Indexer Types

/**
 * Supported file languages/types for syntax highlighting and icons
 */
export type IndexedFileLanguage =
  | 'typescript'
  | 'javascript'
  | 'tsx'
  | 'jsx'
  | 'json'
  | 'css'
  | 'scss'
  | 'html'
  | 'markdown'
  | 'yaml'
  | 'python'
  | 'rust'
  | 'go'
  | 'other';

/**
 * Represents a single indexed file in the project
 */
export interface IndexedFile {
  /** Relative path from project root (e.g., "src/components/Button.tsx") */
  relativePath: string;

  /** File name without path (e.g., "Button.tsx") */
  name: string;

  /** File extension without dot (e.g., "tsx") */
  ext: string;

  /** Detected language/file type */
  lang: IndexedFileLanguage;

  /** File size in bytes */
  sizeBytes: number;

  /** Last modified timestamp (Unix ms) */
  mtime: number;

  // Phase 121: Symbol extraction fields
  /** Exported names from this file (e.g., ["HomePage", "getServerSideProps"]) */
  exports?: string[];

  /** All symbols (functions, classes, hooks, components) in this file */
  symbols?: string[];

  // Phase 122: Full-text search snippet
  /** First ~2000 chars of file content for text search */
  snippet?: string;
}

/**
 * The full project index stored in .f0/index/project-index.json
 */
export interface ProjectIndex {
  /** Schema version for future migrations (3 = with snippets for text search) */
  version: 3;

  /** Absolute path to project root */
  projectRoot: string;

  /** When the index was last updated (Unix ms) */
  indexedAt: number;

  /** Total number of indexed files */
  totalFiles: number;

  /** Array of all indexed files */
  files: IndexedFile[];
}

/**
 * Search result with scoring for quick search (UI)
 */
export interface SearchResult {
  file: IndexedFile;
  score: number;
  /** Matched ranges for highlighting [start, end][] */
  matches: [number, number][];
}

/**
 * Phase 121: Search result for Agent tool
 * Used by SEARCH_PROJECT_INDEX tool
 * Phase 122: Added snippet field for text search results
 */
export interface ProjectSearchResult {
  /** File path relative to project root */
  path: string;
  /** Match score (higher = better match) */
  score: number;
  /** Why this file matched (e.g., "filename", "symbol: useAuth", "export: HomePage") */
  reason?: string;
  /** Snippet from file content (for text search results) */
  snippet?: string;
}

/**
 * Search type for Agent tool
 * Phase 122: Added 'text' for full-text search
 */
export type ProjectSearchType = 'file' | 'symbol' | 'export' | 'text' | 'all';

/**
 * File extensions to language mapping
 */
export const EXT_TO_LANG: Record<string, IndexedFileLanguage> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'css',
  html: 'html',
  htm: 'html',
  md: 'markdown',
  mdx: 'markdown',
  yaml: 'yaml',
  yml: 'yaml',
  py: 'python',
  rs: 'rust',
  go: 'go',
};

/**
 * Get language from file extension
 */
export function getLangFromExt(ext: string): IndexedFileLanguage {
  return EXT_TO_LANG[ext.toLowerCase()] || 'other';
}

/**
 * Directories to always skip when scanning
 */
export const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'build',
  '.cache',
  'coverage',
  '.nyc_output',
  '__pycache__',
  '.pytest_cache',
  'target', // Rust
  '.f0', // Our own index folder
]);

/**
 * File patterns to skip (exact matches or startsWith)
 */
export const SKIP_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
  '.gitkeep',
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
]);

/**
 * Extensions to include in the index
 */
export const INCLUDE_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'json',
  'css',
  'scss',
  'sass',
  'less',
  'html',
  'htm',
  'md',
  'mdx',
  'yaml',
  'yml',
  'py',
  'rs',
  'go',
  'sql',
  'graphql',
  'gql',
  'vue',
  'svelte',
  'astro',
]);

// ============================================================
// Phase 124.3: Route Index Types for Smart Route-Aware Agent
// ============================================================

/**
 * Route kind: page or API endpoint
 */
export type RouteKind = 'page' | 'api';

/**
 * Indexed route for route-aware agent queries
 * Stored in .f0/index/routes-index.json
 */
export interface IndexedRoute {
  /** Route type: page or api */
  kind: RouteKind;

  /** File system path relative to project root (e.g., "src/app/[locale]/auth/page.tsx") */
  fsPath: string;

  /** URL path as it appears in browser (e.g., "/en/auth") */
  urlPath: string;

  /** Locale-agnostic path without [locale] segment (e.g., "/auth") */
  localeAgnosticPath: string;

  /** Path segments for matching (e.g., ["auth"]) */
  segments: string[];

  /** Semantic tags for fuzzy matching (e.g., ["login", "auth", "signin", "تسجيل", "دخول"]) */
  tags: string[];

  /** HTTP methods for API routes (e.g., ["GET", "POST"]) */
  methods?: string[];

  /** Whether route has dynamic segments */
  isDynamic?: boolean;

  /** Route group if any (e.g., "(app)", "(marketing)") */
  group?: string;
}

/**
 * Routes index stored in .f0/index/routes-index.json
 */
export interface RoutesIndex {
  /** Schema version */
  version: 1;

  /** When the index was built (Unix ms) */
  indexedAt: number;

  /** Project root path */
  projectRoot: string;

  /** All indexed routes */
  routes: IndexedRoute[];

  /** Quick stats */
  stats: {
    pageCount: number;
    apiCount: number;
    dynamicCount: number;
  };
}

/**
 * Route search result from route resolver
 */
export interface RouteSearchResult {
  /** The matched route */
  route: IndexedRoute;

  /** Match score (0-1) */
  score: number;

  /** Why this route matched */
  reason: string;
}

/**
 * Semantic tags mapping for Arabic/English route names
 * Used by route resolver for fuzzy matching
 */
export const ROUTE_SEMANTIC_TAGS: Record<string, string[]> = {
  // Auth related
  auth: ['auth', 'login', 'signin', 'تسجيل', 'دخول', 'مصادقة'],
  login: ['login', 'signin', 'auth', 'تسجيل', 'دخول'],
  register: ['register', 'signup', 'تسجيل', 'حساب جديد', 'انشاء حساب'],
  logout: ['logout', 'signout', 'خروج', 'تسجيل خروج'],

  // Dashboard/Home
  dashboard: ['dashboard', 'home', 'لوحة', 'رئيسية', 'الرئيسية'],
  home: ['home', 'index', 'main', 'الرئيسية', 'البداية'],

  // Settings
  settings: ['settings', 'preferences', 'config', 'إعدادات', 'تفضيلات'],
  profile: ['profile', 'account', 'user', 'الملف الشخصي', 'حسابي'],

  // Projects
  projects: ['projects', 'مشاريع', 'المشاريع'],
  project: ['project', 'مشروع'],

  // Billing/Payment
  billing: ['billing', 'payment', 'subscription', 'فواتير', 'دفع', 'اشتراك'],
  pricing: ['pricing', 'plans', 'أسعار', 'خطط'],
  wallet: ['wallet', 'balance', 'محفظة', 'رصيد'],

  // Admin/Ops
  admin: ['admin', 'administration', 'إدارة', 'مدير'],
  ops: ['ops', 'operations', 'عمليات'],

  // API related
  api: ['api', 'endpoint', 'نقطة'],
  chat: ['chat', 'conversation', 'محادثة', 'دردشة'],
  users: ['users', 'مستخدمين'],
};
