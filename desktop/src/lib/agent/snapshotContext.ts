// desktop/src/lib/agent/snapshotContext.ts
// Phase 124.2 Part 2: Snapshot Context Integration for Agent
// Injects project snapshot into every agent message for context-aware responses

import type { ProjectSnapshot, DependencyStats, RoutesStats } from './tools/generateProjectSnapshot';
import type { RouteInfo } from '../snapshot/routesDiscovery';
import { loadSnapshotLocally } from './saveSnapshot';
import type { F0ChatMessage } from '../../f0/apiClient';

/**
 * Snapshot context for agent messages
 */
export interface SnapshotContext {
  snapshot: ProjectSnapshot | null;
  loaded: boolean;
  error?: string;
}

/**
 * Options for building snapshot-enriched messages
 */
export interface BuildSnapshotMessagesOptions {
  projectRoot: string;
  userQuestion: string;
  language?: 'ar' | 'en';
  existingMessages?: F0ChatMessage[];
  snapshot?: ProjectSnapshot | null;
}

/**
 * Result from snapshot-enriched message building
 */
export interface SnapshotEnrichedResult {
  messages: F0ChatMessage[];
  usedSnapshot: boolean;
  snapshotSummary?: string;
}

/**
 * Load snapshot from local storage
 */
export function loadSnapshot(projectRoot: string): SnapshotContext {
  try {
    const snapshot = loadSnapshotLocally(projectRoot);
    return {
      snapshot,
      loaded: true,
    };
  } catch (err) {
    console.error('[snapshotContext] Error loading snapshot:', err);
    return {
      snapshot: null,
      loaded: true,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Format stack array for display
 */
function formatStack(stack: string[]): string {
  if (!stack || stack.length === 0) return 'Unknown';
  return stack.join(', ');
}

/**
 * Format routes for compact display
 */
function formatRoutes(routes: RouteInfo[] | undefined, maxItems: number = 10): string {
  if (!routes || routes.length === 0) return 'None discovered';

  const displayed = routes.slice(0, maxItems);
  const remaining = routes.length - maxItems;

  const formatted = displayed.map(r => {
    const dynamic = r.segmentType !== 'static' ? ` [${r.segmentType}]` : '';
    const methods = r.methods ? ` (${r.methods.join(', ')})` : '';
    return `  - ${r.path}${dynamic}${methods}`;
  }).join('\n');

  if (remaining > 0) {
    return `${formatted}\n  ... و ${remaining} مسار آخر`;
  }

  return formatted;
}

/**
 * Format dependency stats for display
 */
function formatDependencyStats(stats: DependencyStats | undefined): string {
  if (!stats) return 'Not analyzed';

  return [
    `  - Total Files: ${stats.totalFiles}`,
    `  - Connections: ${stats.totalEdges}`,
    `  - Hub Files (>10 deps): ${stats.hubCount}`,
    `  - Orphan Files: ${stats.orphanCount}`,
    `  - Avg imports/file: ${stats.avgImportsPerFile}`,
  ].join('\n');
}

/**
 * Format routes stats for display
 */
function formatRoutesStats(stats: RoutesStats | undefined): string {
  if (!stats) return 'Not discovered';

  return [
    `  - Pages: ${stats.pageCount}`,
    `  - API Routes: ${stats.apiCount}`,
    `  - Layouts: ${stats.layoutCount}`,
    `  - Dynamic Routes: ${stats.dynamicRouteCount}`,
  ].join('\n');
}

/**
 * Build snapshot context text for LLM
 * This is the main function that formats snapshot data for agent context
 */
export function buildSnapshotContextText(
  snapshot: ProjectSnapshot,
  language: 'ar' | 'en' = 'ar'
): string {
  const isArabic = language === 'ar';

  const sections: string[] = [];

  // Header
  sections.push(isArabic
    ? `🎯 ملخص المشروع: ${snapshot.projectName}`
    : `🎯 Project Summary: ${snapshot.projectName}`
  );

  // Stack & Frameworks
  sections.push(isArabic
    ? `\n📦 التقنيات:\n${formatStack(snapshot.stack)}`
    : `\n📦 Stack:\n${formatStack(snapshot.stack)}`
  );

  // Auth Flow (if available)
  if (snapshot.authFlow) {
    sections.push(isArabic
      ? `\n🔐 نظام المصادقة:\n${snapshot.authFlow}`
      : `\n🔐 Auth Flow:\n${snapshot.authFlow}`
    );
  }

  // Billing Flow (if available)
  if (snapshot.billingFlow) {
    sections.push(isArabic
      ? `\n💳 نظام الدفع:\n${snapshot.billingFlow}`
      : `\n💳 Billing Flow:\n${snapshot.billingFlow}`
    );
  }

  // Routes Stats
  if (snapshot.routesStats) {
    sections.push(isArabic
      ? `\n🗺️ إحصائيات المسارات:\n${formatRoutesStats(snapshot.routesStats)}`
      : `\n🗺️ Routes Stats:\n${formatRoutesStats(snapshot.routesStats)}`
    );
  }

  // Pages (detailed)
  if (snapshot.routesInfo && snapshot.routesInfo.length > 0) {
    sections.push(isArabic
      ? `\n📄 الصفحات:\n${formatRoutes(snapshot.routesInfo, 15)}`
      : `\n📄 Pages:\n${formatRoutes(snapshot.routesInfo, 15)}`
    );
  }

  // API Routes (detailed)
  if (snapshot.apiRoutesInfo && snapshot.apiRoutesInfo.length > 0) {
    sections.push(isArabic
      ? `\n🔌 نقاط الـ API:\n${formatRoutes(snapshot.apiRoutesInfo, 15)}`
      : `\n🔌 API Endpoints:\n${formatRoutes(snapshot.apiRoutesInfo, 15)}`
    );
  }

  // Dependency Stats
  if (snapshot.dependencyStats) {
    sections.push(isArabic
      ? `\n🕸️ خريطة الاعتمادات:\n${formatDependencyStats(snapshot.dependencyStats)}`
      : `\n🕸️ Dependency Graph:\n${formatDependencyStats(snapshot.dependencyStats)}`
    );
  }

  // Important Files
  if (snapshot.importantFiles && snapshot.importantFiles.length > 0) {
    const filesList = snapshot.importantFiles.slice(0, 10).map(f => `  - ${f}`).join('\n');
    sections.push(isArabic
      ? `\n📁 الملفات المهمة:\n${filesList}`
      : `\n📁 Important Files:\n${filesList}`
    );
  }

  // Features (if available)
  if (snapshot.features && snapshot.features.length > 0) {
    const featuresList = snapshot.features.slice(0, 8).map(f => `  - ${f}`).join('\n');
    sections.push(isArabic
      ? `\n✨ الميزات:\n${featuresList}`
      : `\n✨ Features:\n${featuresList}`
    );
  }

  // Snapshot timestamp
  if (snapshot.generatedAt) {
    const date = new Date(snapshot.generatedAt);
    const timeAgo = getTimeAgo(date, isArabic);
    sections.push(isArabic
      ? `\n⏰ آخر تحديث للـ Snapshot: ${timeAgo}`
      : `\n⏰ Snapshot updated: ${timeAgo}`
    );
  }

  return sections.join('\n');
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(date: Date, isArabic: boolean): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return isArabic ? 'الآن' : 'just now';
  } else if (diffMins < 60) {
    return isArabic ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return isArabic ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
  } else {
    return isArabic ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
  }
}

/**
 * Build system message with snapshot context
 */
export function buildSnapshotSystemMessage(
  snapshot: ProjectSnapshot,
  language: 'ar' | 'en' = 'ar'
): string {
  const isArabic = language === 'ar';
  const snapshotContext = buildSnapshotContextText(snapshot, language);

  if (isArabic) {
    return `أنت وكيل كود F0 تعمل داخل مشروع "${snapshot.projectName}".

📊 سياق المشروع (من الـ Snapshot):
${snapshotContext}

📌 تعليمات مهمة:
- استخدم المعلومات أعلاه لفهم بنية المشروع
- عند الإشارة لملف، استخدم المسار الكامل مثل: (src/app/page.tsx)
- إذا سأل المستخدم عن route أو API، راجع القوائم أعلاه
- يمكنك الإشارة للإحصائيات عند الحديث عن حجم المشروع
- لا تخترع ملفات أو routes غير موجودة في القوائم`;
  }

  return `You are the F0 Code Agent working inside the "${snapshot.projectName}" project.

📊 Project Context (from Snapshot):
${snapshotContext}

📌 Important Instructions:
- Use the information above to understand project structure
- When referencing files, use full paths like: (src/app/page.tsx)
- If user asks about routes or APIs, refer to the lists above
- You can reference stats when discussing project size
- Do NOT invent files or routes not listed above`;
}

/**
 * Build snapshot-enriched messages for the agent
 * Integrates snapshot context into the message flow
 */
export function buildSnapshotEnrichedMessages(
  options: BuildSnapshotMessagesOptions
): SnapshotEnrichedResult {
  const {
    projectRoot,
    userQuestion,
    language = 'ar',
    existingMessages = [],
    snapshot,
  } = options;

  // Try to load snapshot if not provided
  let activeSnapshot = snapshot;
  if (!activeSnapshot) {
    const ctx = loadSnapshot(projectRoot);
    activeSnapshot = ctx.snapshot;
  }

  // If no snapshot available, return basic messages
  if (!activeSnapshot) {
    console.log('[snapshotContext] No snapshot available for:', projectRoot);

    const systemPrompt = language === 'ar'
      ? 'أنت وكيل كود F0 داخل F0 Desktop IDE. ساعد المستخدم في كتابة وتحسين الكود.'
      : 'You are the F0 Code Agent inside F0 Desktop IDE. Help the user write and improve code.';

    const messages: F0ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...existingMessages.filter(m => m.role !== 'system'),
      { role: 'user', content: userQuestion },
    ];

    return {
      messages,
      usedSnapshot: false,
    };
  }

  // Build snapshot-enriched system message
  const systemMessage = buildSnapshotSystemMessage(activeSnapshot, language);
  const snapshotSummary = buildSnapshotContextText(activeSnapshot, language);

  console.log('[snapshotContext] Using snapshot for:', activeSnapshot.projectName);
  console.log('[snapshotContext] Routes:', activeSnapshot.routesStats?.pageCount || 0, 'pages,', activeSnapshot.routesStats?.apiCount || 0, 'APIs');

  const messages: F0ChatMessage[] = [
    { role: 'system', content: systemMessage },
    ...existingMessages.filter(m => m.role !== 'system'),
    { role: 'user', content: userQuestion },
  ];

  return {
    messages,
    usedSnapshot: true,
    snapshotSummary,
  };
}

/**
 * Enrich user message with snapshot context for cloud agent
 * Appends snapshot summary to the user's question
 */
export function enrichMessageWithSnapshot(
  userQuestion: string,
  snapshot: ProjectSnapshot,
  language: 'ar' | 'en' = 'ar'
): string {
  const snapshotContext = buildSnapshotContextText(snapshot, language);
  const isArabic = language === 'ar';

  const prefix = isArabic
    ? '📊 سياق المشروع:\n'
    : '📊 Project Context:\n';

  const separator = isArabic
    ? '\n\n---\n\n❓ السؤال:\n'
    : '\n\n---\n\n❓ Question:\n';

  return `${prefix}${snapshotContext}${separator}${userQuestion}`;
}

/**
 * Check if snapshot is recent enough to use
 * Default: 24 hours
 */
export function isSnapshotFresh(
  snapshot: ProjectSnapshot,
  maxAgeMs: number = 24 * 60 * 60 * 1000
): boolean {
  if (!snapshot.generatedAt) return false;

  const generatedAt = new Date(snapshot.generatedAt).getTime();
  const now = Date.now();

  return (now - generatedAt) < maxAgeMs;
}

/**
 * Get snapshot freshness level
 */
export function getSnapshotFreshness(
  snapshot: ProjectSnapshot
): 'fresh' | 'stale' | 'expired' {
  if (!snapshot.generatedAt) return 'expired';

  const ageMs = Date.now() - new Date(snapshot.generatedAt).getTime();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;

  if (ageMs < oneHour) return 'fresh';
  if (ageMs < oneDay) return 'stale';
  return 'expired';
}

export default {
  loadSnapshot,
  buildSnapshotContextText,
  buildSnapshotSystemMessage,
  buildSnapshotEnrichedMessages,
  enrichMessageWithSnapshot,
  isSnapshotFresh,
  getSnapshotFreshness,
};
