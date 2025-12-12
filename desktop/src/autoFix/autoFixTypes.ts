// desktop/src/autoFix/autoFixTypes.ts
// Phase 141.0 – Auto-Fix Architecture & Types
// Phase 142.0 – Added Engine types (AutoFixEngine, AutoFixEngineResult)
// Phase 144.3 – Enhanced skip reasons for better UX

export type IssueSeverity = 'info' | 'warning' | 'error' | 'critical';

export type IssueKind =
  | 'typescript'
  | 'eslint'
  | 'security'
  | 'test'
  | 'performance'
  | 'style'
  | 'unknown';

export interface IDEIssue {
  id: string;
  filePath: string;
  message: string;
  code?: string;
  ruleId?: string; // eslint rule / category id
  line?: number;
  column?: number;
  severity: IssueSeverity;
  kind: IssueKind;
  source?: string; // e.g. "ts", "eslint", "watchdog", "coverage"
  fixable?: boolean;
}

export interface FilePatch {
  filePath: string;
  before: string;
  after: string;
}

export interface AutoFixRequest {
  issues: IDEIssue[];
  mode: 'all' | 'selected';
  dryRun?: boolean;
}

/**
 * Route = مجموعة issues هتتعالج بنفس الـ engine
 * (TS, ESLint, Security Agent, Test Agent, ...).
 */
export type AutoFixEngineType =
  | 'ts'
  | 'eslint'
  | 'security'
  | 'tests'
  | 'generic';

export interface AutoFixRoute {
  engine: AutoFixEngineType;
  issueIds: string[];
}

export interface AutoFixPlan {
  routes: AutoFixRoute[];
  /**
   * issues اللي مش Fixable أو مش عارفين نصنّفها
   * (مهمين عشان نعرض للمستخدم ليه متصلحتش).
   */
  unsupportedIssueIds: string[];
}

/**
 * Phase 144.3: أسباب الـ skip - عشان نعرضها للمستخدم بشكل واضح
 * Phase 144.5.1: Added PATCH_NO_CONTENT for files not loaded in IDE
 */
export type AutoFixSkipReason =
  | 'NO_FIXER'         // مافيش pattern للـ rule
  | 'OUT_OF_SCOPE'     // نوع ملف/مسار مش بنلمسه في الـ beta
  | 'FIXER_ERROR'      // حصل error جوّه الـ fixer
  | 'FILE_NOT_FOUND'   // الملف مش موجود
  | 'PATCH_NO_CONTENT' // Phase 144.5.1: الملف مش محمّل في الـ IDE (لا يوجد محتوى)
  | 'BEFORE_MISMATCH'  // Phase 144.5.1: المحتوى الحالي مختلف عن الـ snapshot
  | 'SECURITY'         // Security issue محتاج manual review
  | 'UNKNOWN';         // fallback

/**
 * Phase 144.3: Enhanced error with skip reason
 */
export interface AutoFixIssueError {
  issueId: string;
  filePath: string;
  ruleId?: string; // eslint rule / category id
  reason: AutoFixSkipReason;
  message?: string; // optional extra info
}

/** Legacy error format for backwards compatibility */
export interface AutoFixError {
  issueId: string;
  error: string;
}

/**
 * Phase 144.2.0: Backup session metadata
 */
export interface AutoFixBackupFile {
  path: string;         // relative path from project root
  sizeBefore: number;
  sizeAfter?: number;
  issuesFixed: number;
}

export interface AutoFixBackupSession {
  timestamp: string;    // ISO timestamp
  projectRoot: string;
  backupDir: string;    // .f0/auto-fix-backups/<timestamp>/
  files: AutoFixBackupFile[];
  totalFilesBackedUp: number;
}

export interface AutoFixResult {
  fixedIssueIds: string[];
  skippedIssueIds: string[];
  errors: AutoFixIssueError[];
  patches: FilePatch[];
  /** Phase 144.2.0: Backup session info */
  backupSession?: AutoFixBackupSession | null;
  /** Phase 144.3: Summary stats */
  stats?: {
    totalIssues: number;
    fixedCount: number;
    skippedCount: number;
    errorCount: number;
    outOfScopeCount: number;
    noFixerCount: number;
    durationMs: number;
  };
}

/**
 * Phase 142.0: نتيجة أي Engine فردي (TS, ESLint, ...).
 */
export interface AutoFixEngineResult {
  patches: FilePatch[];
  fixedIssueIds: string[];
  errors: AutoFixIssueError[];
}

/**
 * Phase 142.0: Interface موّحد لأي Engine.
 * Phase 143 هننفّذ Implementations فعليّة للـ Engines دي.
 */
export interface AutoFixEngine {
  type: AutoFixEngineType;
  run(opts: {
    issues: IDEIssue[];
    dryRun?: boolean;
  }): Promise<AutoFixEngineResult>;
}

/**
 * Phase 144.3.5: Check if file is compiled/backup (out of scope)
 * Phase 145.4.1: Added dist-electron and backup folder patterns
 */
export function isOutOfScopeFile(filePath: string): boolean {
  if (!filePath) return false;
  return (
    filePath.includes('functions/lib/') ||
    filePath.includes('functions/backup/') ||
    filePath.includes('/lib/') && filePath.includes('functions') ||
    filePath.endsWith('/desktop/main.js') ||
    filePath.endsWith('.min.js') ||
    filePath.includes('/dist/') ||
    filePath.includes('/dist-electron/') ||  // Phase 145.4.1: Electron build output
    filePath.includes('/build/') ||
    filePath.includes('node_modules/') ||
    filePath.includes('/.backup/') ||        // Phase 145.4.1: Auto-fix backup
    filePath.includes('/backup/') ||         // Phase 145.4.1: General backup folders
    filePath.includes('/.f0/auto-fix-backups/')  // Phase 145.4.1: F0 backup location
  );
}

/**
 * Phase 144.3.5: Get human-readable label for skip reason
 * Phase 144.5.1: Added labels for PATCH_NO_CONTENT and BEFORE_MISMATCH
 */
export function getSkipReasonLabel(reason: AutoFixSkipReason, locale: 'ar' | 'en' = 'en'): string {
  const labels: Record<AutoFixSkipReason, { en: string; ar: string }> = {
    NO_FIXER: {
      en: 'No auto-fix available for this rule',
      ar: 'لا يوجد إصلاح تلقائي لهذه القاعدة',
    },
    OUT_OF_SCOPE: {
      en: 'Compiled/Backup file — auto-fix disabled',
      ar: 'ملف مُجمَّع/نسخة احتياطية — الإصلاح التلقائي معطل',
    },
    FIXER_ERROR: {
      en: 'Fixer encountered an error',
      ar: 'حدث خطأ أثناء الإصلاح',
    },
    FILE_NOT_FOUND: {
      en: 'File not found',
      ar: 'الملف غير موجود',
    },
    PATCH_NO_CONTENT: {
      en: 'File not loaded — no content available',
      ar: 'الملف غير محمّل — لا يوجد محتوى متاح',
    },
    BEFORE_MISMATCH: {
      en: 'File changed since analysis — refresh needed',
      ar: 'الملف تغير منذ التحليل — يحتاج تحديث',
    },
    SECURITY: {
      en: 'Security issue — requires manual review',
      ar: 'مشكلة أمنية — تتطلب مراجعة يدوية',
    },
    UNKNOWN: {
      en: 'Unknown reason',
      ar: 'سبب غير معروف',
    },
  };
  return labels[reason]?.[locale] ?? labels.UNKNOWN[locale];
}
