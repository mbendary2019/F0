'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient';
import { useLiveSessionsList } from '@/hooks/useLiveSessionsList';
import { useIdePatches } from '@/hooks/useIdePatches';
import F0Shell from '@/components/f0/F0Shell';
import PatchViewer from '@/components/f0/PatchViewer';
import { LiveFileMirror } from '@/components/f0/LiveFileMirror';
// Phase 150.1: Web IDE Quality & Evolution UI
import { QualityBarWeb } from '@/components/quality/QualityBarWeb';
import { CodeEvolutionModalWeb } from '@/components/ace/CodeEvolutionModalWeb';
// Phase 150.6.1: Performance-optimized hooks - single runtime instance
import { useProjectRuntime, type RuntimeError } from '@/hooks/useProjectRuntime';
import { useProjectQualityWithRuntime } from '@/hooks/useProjectQuality';
// Phase 150.4: Web Deploy Gate
import { WebDeployGateBadge } from '@/components/deploy/WebDeployGateBadge';
import { WebDeployGateModal } from '@/components/deploy/WebDeployGateModal';
import { useWebDeployGateWithRuntime } from '@/hooks/useWebDeployGate';
// Phase 150.6.1: Toast for error notifications
import { useToast } from '@/components/ui/use-toast';
// Phase 151.2: File Explorer
import { FileExplorer } from '@/components/ide/FileExplorer';
import type { FileInput } from '@/lib/fs';
import type { QualitySnapshot } from '@/types/quality';
// Phase 151.3: Code Viewer
import { CodeViewer } from '@/components/ide/CodeViewer';
import { useFileContent } from '@/hooks/useFileContent';
// Phase 152: Monaco Editor + File Editing
import { useEditorState } from '@/hooks/useEditorState';
import { useFileSave } from '@/hooks/useFileSave';
// Phase 152.4: Prettier formatting
import { formatCode, isFormattable } from '@/lib/editor/formatCode';
// Phase 152.5: File issues for Monaco markers
import { useFileIssues, useFileIssuesForFile } from '@/hooks/useFileIssues';
// Phase 152.6: Diff mode
import { CodeDiffViewer } from '@/components/ide/CodeDiffViewer';
// Phase 153.0: Selection tracking
import type { SelectedRangeInfo } from '@/components/ide/CodeViewer';
// Phase 153.2 + 153.3: ACE Inline Fix
import type { InlineAceRequestContext, AceInlinePatch } from '@/types/aceInline';
import { useAceInlineFix } from '@/hooks/useAceInlineFix';
// Phase 154.6: Issue Details Panel
import { IssueDetailsPanel } from '@/components/ide/IssueDetailsPanel';
import type { FileIssueForEditor } from '@/types/fileIssues';

// =============================================================================
// Phase 151.3: Demo/Fallback data when no active session
// =============================================================================
const DEMO_QUALITY_SNAPSHOT: QualitySnapshot = {
  score: 72,
  status: 'caution',
  totalIssues: 5,
  lastScanAt: new Date().toISOString(),
  filesScanned: 19,
  securityAlerts: 0,
  testsStatus: 'passing',
};

// Demo file contents for when no active session
const DEMO_FILE_CONTENTS: Record<string, { content: string; language: string }> = {
  'src/app/page.tsx': {
    language: 'tsx',
    content: [
      "// src/app/page.tsx",
      "'use client';",
      "",
      "import { useRouter } from 'next/navigation';",
      "",
      "export default function HomePage() {",
      "  const router = useRouter();",
      "",
      "  return (",
      "    <main className=\"min-h-screen bg-gradient-to-b from-slate-900 to-slate-800\">",
      "      <div className=\"container mx-auto px-4 py-16\">",
      "        <h1 className=\"text-4xl font-bold text-white mb-4\">",
      "          Welcome to F0",
      "        </h1>",
      "        <p className=\"text-slate-300 mb-8\">",
      "          Your AI-powered development companion",
      "        </p>",
      "        <button",
      "          onClick={() => router.push('/projects')}",
      "          className=\"bg-purple-600 text-white px-6 py-3 rounded-lg\"",
      "        >",
      "          Get Started",
      "        </button>",
      "      </div>",
      "    </main>",
      "  );",
      "}",
    ].join('\n'),
  },
  'src/app/layout.tsx': {
    language: 'tsx',
    content: [
      "// src/app/layout.tsx",
      "import type { Metadata } from 'next';",
      "import { Inter } from 'next/font/google';",
      "import './globals.css';",
      "",
      "const inter = Inter({ subsets: ['latin'] });",
      "",
      "export const metadata: Metadata = {",
      "  title: 'F0 - AI Development Platform',",
      "  description: 'Build faster with AI assistance',",
      "};",
      "",
      "export default function RootLayout({",
      "  children,",
      "}: {",
      "  children: React.ReactNode;",
      "}) {",
      "  return (",
      "    <html lang=\"en\">",
      "      <body className={inter.className}>",
      "        {children}",
      "      </body>",
      "    </html>",
      "  );",
      "}",
    ].join('\n'),
  },
  'src/lib/utils.ts': {
    language: 'typescript',
    content: [
      "// src/lib/utils.ts",
      "import { clsx, type ClassValue } from 'clsx';",
      "import { twMerge } from 'tailwind-merge';",
      "",
      "export function cn(...inputs: ClassValue[]) {",
      "  return twMerge(clsx(inputs));",
      "}",
      "",
      "export function formatDate(date: Date): string {",
      "  return new Intl.DateTimeFormat('en-US', {",
      "    year: 'numeric',",
      "    month: 'short',",
      "    day: 'numeric',",
      "  }).format(date);",
      "}",
    ].join('\n'),
  },
  'package.json': {
    language: 'json',
    content: JSON.stringify({
      name: "f0-demo-project",
      version: "1.0.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint",
      },
      dependencies: {
        next: "14.2.0",
        react: "18.2.0",
        "react-dom": "18.2.0",
        typescript: "5.4.0",
      },
    }, null, 2),
  },
};

// =============================================================================
// Phase 151.2: Mock files for testing FileExplorer
// TODO: Replace with useProjectFiles(projectId) in Phase 151.3
// =============================================================================
const MOCK_PROJECT_FILES: FileInput[] = [
  { relativePath: 'src/app/page.tsx' },
  { relativePath: 'src/app/layout.tsx' },
  { relativePath: 'src/app/globals.css' },
  { relativePath: 'src/app/[locale]/page.tsx' },
  { relativePath: 'src/app/[locale]/layout.tsx' },
  { relativePath: 'src/app/[locale]/live/page.tsx' },
  { relativePath: 'src/components/ui/Button.tsx' },
  { relativePath: 'src/components/ui/Card.tsx' },
  { relativePath: 'src/components/ide/FileExplorer.tsx' },
  { relativePath: 'src/lib/fs/buildFileTree.ts' },
  { relativePath: 'src/lib/fs/sortFileTree.ts' },
  { relativePath: 'src/lib/fs/index.ts' },
  { relativePath: 'src/lib/utils.ts' },
  { relativePath: 'src/hooks/useProjectRuntime.ts' },
  { relativePath: 'src/hooks/useProjectQuality.ts' },
  { relativePath: 'package.json' },
  { relativePath: 'tsconfig.json' },
  { relativePath: 'next.config.js' },
  { relativePath: 'README.md' },
];

function LiveCodingContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'en';
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showEvolutionModal, setShowEvolutionModal] = useState(false);
  const [showGateModal, setShowGateModal] = useState(false);
  // Phase 151.2: Show/hide file explorer sidebar
  const [showFileExplorer, setShowFileExplorer] = useState(true);
  // Phase 152.6: Diff mode toggle
  const [showDiff, setShowDiff] = useState(false);
  // Phase 153.0: Selection tracking for Ask ACE
  const [selectedRange, setSelectedRange] = useState<SelectedRangeInfo | null>(null);

  // ==========================================================================
  // Phase 153.2 + 153.3: ACE Inline Fix hook
  // ==========================================================================
  const {
    isLoadingAceInline,
    lastInlineResponse,
    errorAceInline,
    runAceInlineFix,
    clearAceInlineResponse,
  } = useAceInlineFix();

  // ==========================================================================
  // Phase 153.1 + 153.2: Inline Ask ACE handler
  // ==========================================================================
  const handleAskAceInline = useCallback(
    async (ctx: InlineAceRequestContext) => {
      console.log('[153.2][WEB][ACE] /live handleAskAceInline', {
        cursorLine: ctx.selectedRange?.cursorLine,
        selectedLength: ctx.selectedRange?.selectedText?.length ?? 0,
        language: ctx.language,
        filePath: selectedFile,
      });

      // Phase 153.2: Call the ACE inline API
      // Phase 153.3: Response will be displayed in suggestion bubble
      await runAceInlineFix(ctx);
    },
    [selectedFile, runAceInlineFix]
  );

  // ==========================================================================
  // Phase 153.3: Suggestion Bubble handlers
  // ==========================================================================
  const handleApplyAcePatch = useCallback(
    (patch: AceInlinePatch) => {
      console.log('[153.3][WEB][INLINE] Apply patch from /live', {
        patchId: patch.id,
        startLine: patch.beforeRange.startLine,
        endLine: patch.beforeRange.endLine,
      });

      // Phase 153.4: Actually apply the patch to editor content
      // For now, just close the bubble and show a toast
      toast({
        title: locale === 'ar' ? '✨ تم التطبيق' : '✨ Applied',
        description: patch.title || (locale === 'ar' ? 'تم تطبيق الإصلاح' : 'Fix applied'),
      });

      clearAceInlineResponse();
    },
    [locale, toast, clearAceInlineResponse]
  );

  const handleDismissAcePatch = useCallback(() => {
    console.log('[153.3][WEB][INLINE] Dismiss patch from /live');
    clearAceInlineResponse();
  }, [clearAceInlineResponse]);

  const { sessions } = useLiveSessionsList();

  // Get active session (first active one)
  const activeSession = sessions.find((s) => s.status === 'active');

  // ==========================================================================
  // Phase 150.6.1: Error handler for Firestore errors
  // ==========================================================================
  const handleRuntimeError = useCallback(
    (error: RuntimeError) => {
      const errorLabels: Record<RuntimeError['type'], { en: string; ar: string }> = {
        quality_listener: { en: 'Quality data error', ar: 'خطأ في بيانات الجودة' },
        ace_listener: { en: 'ACE data error', ar: 'خطأ في بيانات ACE' },
        security_listener: { en: 'Security data error', ar: 'خطأ في بيانات الأمان' },
        tests_listener: { en: 'Tests data error', ar: 'خطأ في بيانات الاختبارات' },
      };

      const label = errorLabels[error.type]?.[locale as 'en' | 'ar'] || error.type;
      toast({
        title: locale === 'ar' ? 'خطأ في تحميل البيانات' : 'Data loading error',
        description: `${label}: ${error.message}`,
        variant: 'error',
        duration: 5000,
      });
    },
    [toast, locale]
  );

  // ==========================================================================
  // Phase 150.6.1: SINGLE runtime instance for ALL derived hooks
  // Before: useProjectQuality + useWebDeployGate each called useProjectRuntime
  //         = 4x Firestore listeners!
  // After:  One useProjectRuntime, pass to derived hooks = 1x listeners
  // ==========================================================================
  const runtimeOptions = useMemo(
    () => ({ onError: handleRuntimeError }),
    [handleRuntimeError]
  );
  const projectRuntime = useProjectRuntime(
    activeSession?.projectId || null,
    runtimeOptions
  );

  // Phase 150.2: Get quality from shared runtime (no duplicate listeners)
  const { quality: qualitySnapshotReal } = useProjectQualityWithRuntime(
    projectRuntime,
    activeSession?.projectId
  );

  // Phase 151.3: Use demo snapshot if no real data available
  const qualitySnapshot = qualitySnapshotReal || (!activeSession ? DEMO_QUALITY_SNAPSHOT : null);

  // Phase 150.4: Get deploy gate decision from shared runtime
  const { decision: gateDecision, inputs: gateInputs } = useWebDeployGateWithRuntime(
    projectRuntime,
    activeSession?.projectId
  );

  // Phase 151.3: Demo deploy gate decision when no session
  const effectiveGateDecision = activeSession ? gateDecision : {
    status: 'ready' as const,
    canDeploy: true,
    blockers: [],
    warnings: ['Demo mode - connect a project to see real data'],
  };

  // Fetch patches for active session (must be before early return)
  const { patches } = useIdePatches(
    activeSession?.projectId || null,
    activeSession?.id || null
  );

  // ==========================================================================
  // Phase 151.3: Fetch file content for CodeViewer
  // ==========================================================================
  const fileContent = useFileContent(
    activeSession?.projectId || null,
    selectedFile
  );

  // ==========================================================================
  // Phase 152.1: Editor state for local editing
  // ==========================================================================
  const backendContent = activeSession
    ? fileContent.content
    : (DEMO_FILE_CONTENTS[selectedFile || '']?.content || '');

  const editor = useEditorState(selectedFile, backendContent);

  // ==========================================================================
  // Phase 152.2: File save hook
  // ==========================================================================
  const { isSaving, error: saveError, saveFile } = useFileSave(
    activeSession?.projectId || null
  );

  // ==========================================================================
  // Phase 152.5: File issues for Monaco markers
  // ==========================================================================
  const fileIssues = useFileIssues(
    activeSession?.projectId || null,
    selectedFile
  );

  // ==========================================================================
  // Phase 154.0: File issues for inline decorations (demo mode support)
  // ==========================================================================
  const fileIssuesForDecorations = useFileIssuesForFile(selectedFile);

  // ==========================================================================
  // Phase 154.6: Focused issue for IssueDetailsPanel
  // ==========================================================================
  const focusedIssue: FileIssueForEditor | null = useMemo(() => {
    if (!fileIssuesForDecorations.length) return null;
    const cursorLine = selectedRange?.cursorLine ?? null;
    if (!cursorLine) return fileIssuesForDecorations[0] ?? null;
    return (
      fileIssuesForDecorations.find((i) => i.line === cursorLine) ??
      fileIssuesForDecorations[0] ??
      null
    );
  }, [fileIssuesForDecorations, selectedRange?.cursorLine]);

  // Phase 152.2: Handle save with Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const isSaveCombo = isMac
        ? e.metaKey && e.key === 's'
        : e.ctrlKey && e.key === 's';

      if (isSaveCombo) {
        e.preventDefault();
        if (selectedFile && editor.isDirty && !isSaving && activeSession) {
          void saveFile(selectedFile, editor.content).then((success) => {
            if (success) {
              editor.markSaved();
              toast({
                title: locale === 'ar' ? 'تم الحفظ' : 'Saved',
                description: locale === 'ar' ? 'تم حفظ الملف بنجاح' : 'File saved successfully',
              });
            }
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile, editor, isSaving, activeSession, saveFile, toast, locale]);

  // Show save error in toast
  useEffect(() => {
    if (saveError) {
      toast({
        title: locale === 'ar' ? 'خطأ في الحفظ' : 'Save error',
        description: saveError,
        variant: 'destructive',
      });
    }
  }, [saveError, toast, locale]);

  // ==========================================================================
  // Phase 151.2: Handle file selection from FileExplorer
  // MUST be before early return to avoid hooks order change
  // ==========================================================================
  const handleFileSelect = useCallback((path: string) => {
    console.log('[151.2][WEB][FILE_SELECT]', path);
    setSelectedFile(path);
    // Update URL for deep linking
    const sp = new URLSearchParams(searchParams?.toString() || '');
    sp.set('file', path);
    router.replace(`/${locale}/live?${sp.toString()}`, { scroll: false });
  }, [searchParams, router, locale]);

  // Sync selected file from URL on mount
  useEffect(() => {
    const fileFromUrl = searchParams?.get('file');
    if (fileFromUrl && fileFromUrl !== selectedFile) {
      setSelectedFile(fileFromUrl);
    }
  }, [searchParams, selectedFile]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (current) => {
      if (!current) {
        router.push(`/${locale}/auth`);
      } else {
        setUser(current);
      }
    });
    return () => unsub();
  }, [router, locale]);

  if (!user) return null;

  // Handle apply patch
  const handleApplyPatch = async (patchId: string, selectedFilePaths: string[]) => {
    if (!activeSession) {
      alert('No active session');
      return;
    }

    const patch = patches.find((p) => p.patchId === patchId);
    if (!patch) {
      alert('Patch not found');
      return;
    }

    // Filter files by selected paths
    const selectedFiles = patch.files
      .filter((f) => selectedFilePaths.includes(f.path))
      .map((f) => ({
        path: f.path,
        newContent: f.newContent,
      }));

    // Generate command ID
    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Send command to API
    const response = await fetch('/api/live/send-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commandId,
        sessionId: activeSession.id,
        projectId: activeSession.projectId,
        kind: 'APPLY_PATCH',
        ts: new Date().toISOString(),
        payload: {
          patchId,
          files: selectedFiles,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send command');
    }

    alert('Patch command sent to IDE! Check your IDE for changes.');
  };

  return (
    <F0Shell>
      <div className="flex h-full overflow-hidden -mx-6 -my-6">
        {/* Phase 151.2: File Explorer Sidebar - inside F0Shell */}
        {showFileExplorer && (
          <FileExplorer
            files={MOCK_PROJECT_FILES}
            selectedPath={selectedFile}
            onSelect={handleFileSelect}
            locale={locale as 'en' | 'ar'}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="space-y-6">
        {/* Phase 150.1: Quality Bar + Phase 150.4: Deploy Gate Badge */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <QualityBarWeb
              snapshot={qualitySnapshot}
              locale={locale as 'en' | 'ar'}
              onOpenEvolution={() => setShowEvolutionModal(true)}
              loading={activeSession ? projectRuntime.loading : false}
            />
          </div>
          {/* Phase 150.4: Deploy Gate Badge */}
          <WebDeployGateBadge
            status={effectiveGateDecision.status}
            loading={activeSession ? projectRuntime.loading : false}
            onClick={() => setShowGateModal(true)}
            locale={locale as 'en' | 'ar'}
          />
        </div>

        {/* Phase 150.1/150.3: Code Evolution Modal with ACE wiring */}
        {showEvolutionModal && (
          <CodeEvolutionModalWeb
            onClose={() => setShowEvolutionModal(false)}
            projectId={activeSession?.projectId}
            locale={locale as 'en' | 'ar'}
          />
        )}

        {/* Phase 150.4: Deploy Gate Modal */}
        {showGateModal && (
          <WebDeployGateModal
            decision={gateDecision}
            inputs={gateInputs}
            onClose={() => setShowGateModal(false)}
            locale={locale as 'en' | 'ar'}
          />
        )}

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
              F0 Panel · Live Coding
            </p>
            {/* Phase 151.3: Demo Mode Badge */}
            {!activeSession && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
                {locale === 'ar' ? 'وضع العرض' : 'DEMO MODE'}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-white">
            Live Coding / Cloud IDE
          </h1>
          <p className="text-sm text-slate-400">
            Connect your local IDE or use the web editor to collaborate with F0
            Agent in real time.
          </p>
        </div>

        {/* Active Session Card */}
        {activeSession ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-6 py-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-sm font-semibold text-white">
                  Active Session
                </p>
              </div>
              <button
                onClick={() =>
                  router.push(`/${locale}/projects/${activeSession.projectId}`)
                }
                className="text-xs text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
              >
                View Project Details
              </button>
            </div>
            <p className="text-xs text-white/80">
              Project:{' '}
              <span className="font-medium">
                {activeSession.projectName || activeSession.projectId}
              </span>{' '}
              | Live session with F0 Agent
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-6 py-5 text-center">
            <p className="text-sm text-white/60">
              No active session. Start a live session from your project to
              connect.
            </p>
          </div>
        )}

        {/* Back to Projects Button */}
        <div className="flex justify-start">
          <button
            onClick={() => router.push(`/${locale}/projects`)}
            className="text-xs text-pink-300 underline underline-offset-2 hover:text-pink-400"
          >
            ← Back to Projects
          </button>
        </div>

        {/* Phase 152: Monaco Code Editor with Save */}
        {selectedFile && (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            {/* Phase 152.2: Save toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#070019] border-b border-white/10">
              <div className="flex items-center gap-3">
                {editor.isDirty ? (
                  <span className="flex items-center gap-1.5 text-[11px] text-amber-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {locale === 'ar' ? 'تغييرات غير محفوظة' : 'Unsaved changes'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[11px] text-emerald-300/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {locale === 'ar' ? 'تم الحفظ' : 'Saved'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Discard changes button */}
                {editor.isDirty && (
                  <button
                    onClick={() => editor.reset()}
                    className="px-2.5 py-1 rounded text-[10px] text-white/60 hover:text-white hover:bg-white/10 transition"
                  >
                    {locale === 'ar' ? 'تراجع' : 'Discard'}
                  </button>
                )}

                {/* Phase 152.6: View Diff button */}
                {editor.isDirty && (
                  <button
                    onClick={() => {
                      setShowDiff((v) => !v);
                      console.log('[152.6][WEB][DIFF] Toggled diff view', {
                        showDiff: !showDiff,
                        filePath: selectedFile,
                      });
                    }}
                    className="px-2.5 py-1 rounded text-[10px] text-white/60 hover:text-white hover:bg-white/10 transition flex items-center gap-1"
                  >
                    <span className="text-[11px]">📊</span>
                    {showDiff
                      ? (locale === 'ar' ? 'اخفاء المقارنة' : 'Hide Diff')
                      : (locale === 'ar' ? 'عرض المقارنة' : 'View Diff')
                    }
                  </button>
                )}

                {/* Phase 152.4: Format button */}
                {selectedFile && isFormattable(fileContent.language) && !showDiff && (
                  <button
                    onClick={async () => {
                      try {
                        const formatted = await formatCode(editor.content, fileContent.language);
                        editor.setContent(formatted);
                        toast({
                          title: locale === 'ar' ? 'تم التنسيق' : 'Formatted',
                          description: locale === 'ar' ? 'تم تنسيق الكود بنجاح' : 'Code formatted successfully',
                        });
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : 'Unknown error';
                        toast({
                          title: locale === 'ar' ? 'خطأ في التنسيق' : 'Format error',
                          description: msg,
                          variant: 'destructive',
                        });
                      }
                    }}
                    className="px-2.5 py-1 rounded text-[10px] text-white/60 hover:text-white hover:bg-white/10 transition flex items-center gap-1"
                  >
                    <span className="text-[11px]">✨</span>
                    {locale === 'ar' ? 'تنسيق' : 'Format'}
                  </button>
                )}

                {/* Save button */}
                <button
                  disabled={!editor.isDirty || isSaving || !activeSession}
                  onClick={() => {
                    if (selectedFile && activeSession) {
                      void saveFile(selectedFile, editor.content).then((success) => {
                        if (success) {
                          editor.markSaved();
                          toast({
                            title: locale === 'ar' ? 'تم الحفظ' : 'Saved',
                            description: locale === 'ar' ? 'تم حفظ الملف بنجاح' : 'File saved successfully',
                          });
                        }
                      });
                    }
                  }}
                  className="px-3 py-1 rounded text-[10px] font-medium bg-purple-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-500 transition flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                      {locale === 'ar' ? 'جاري الحفظ...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <span className="text-[12px]">💾</span>
                      {locale === 'ar' ? 'حفظ' : 'Save'} (⌘S)
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Phase 154.6: Monaco Editor + Issue Details Panel */}
            <div className="flex gap-6">
              {/* Monaco Editor / Diff View */}
              <div className="h-[500px] flex-1 min-w-0">
                {showDiff && editor.isDirty ? (
                  <CodeDiffViewer
                    original={editor.originalContent}
                    modified={editor.content}
                    language={
                      activeSession
                        ? fileContent.language
                        : (DEMO_FILE_CONTENTS[selectedFile]?.language || 'typescript')
                    }
                    filePath={selectedFile}
                    locale={locale as 'en' | 'ar'}
                  />
                ) : (
                  <CodeViewer
                    filePath={selectedFile}
                    content={editor.content}
                    language={
                      activeSession
                        ? fileContent.language
                        : (DEMO_FILE_CONTENTS[selectedFile]?.language || 'typescript')
                    }
                    loading={activeSession ? fileContent.loading : false}
                    notFound={activeSession ? fileContent.notFound : !DEMO_FILE_CONTENTS[selectedFile]}
                    locale={locale as 'en' | 'ar'}
                    readOnly={false}
                    onChangeContent={editor.setContent}
                    issues={fileIssues}
                    onSelectedRangeChange={setSelectedRange}
                    onAskAce={handleAskAceInline}
                    aceInlineResponse={lastInlineResponse}
                    onApplyAcePatch={handleApplyAcePatch}
                    onDismissAcePatch={handleDismissAcePatch}
                    fileIssues={fileIssuesForDecorations}
                  />
                )}
              </div>

              {/* Phase 154.6: Issue Details Panel (right sidebar on xl screens) */}
              <IssueDetailsPanel
                issues={fileIssuesForDecorations}
                focusedIssue={focusedIssue}
                locale={locale as 'en' | 'ar'}
              />
            </div>
          </div>
        )}

        {/* Split View: Patches + Live File Mirror */}
        {activeSession && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Patches from AI Agent */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-white">
                Pending Patches from AI Agent
              </h2>
              <PatchViewer
                patches={patches}
                onApplyPatch={handleApplyPatch}
                onFileSelect={(path) => setSelectedFile(path)}
              />
            </div>

            {/* Right: Live File Mirror */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                Live File Mirror
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </h2>
              <div className="h-[400px]">
                <LiveFileMirror
                  projectId={activeSession.projectId}
                  sessionId={activeSession.id}
                  filePath={selectedFile}
                />
              </div>
            </div>
          </div>
        )}

        {/* Connect VS Code / Cursor */}
        <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">
            Connect VS Code or Cursor (Local)
          </h2>

          <ol className="space-y-3 text-sm text-white/80">
            <li className="flex gap-3">
              <span className="text-pink-400 font-mono">1.</span>
              <span>
                Install the{' '}
                <span className="font-semibold text-white">
                  "F0 Live Bridge"
                </span>{' '}
                extension from the marketplace.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-pink-400 font-mono">2.</span>
              <span>
                Open the extension and click{' '}
                <span className="font-semibold text-white">
                  "Connect to F0 Dashboard"
                </span>
                .
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-pink-400 font-mono">3.</span>
              <span>
                Use the{' '}
                <span className="font-semibold text-white">Session ID</span>{' '}
                shown at the top of this page (usually the project ID).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-pink-400 font-mono">4.</span>
              <span>
                After that, any requests you send to the Agent here will propose
                changes in your IDE directly.
              </span>
            </li>
          </ol>
        </div>

        {/* Session Information */}
        {activeSession && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">
              Session Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-white/60 text-xs">Session ID:</p>
                <p className="text-white font-mono">
                  {activeSession.projectId}
                </p>
              </div>
              <div>
                <p className="text-white/60 text-xs">Project:</p>
                <p className="text-white">
                  {activeSession.projectName || 'Untitled'}
                </p>
              </div>
              <div>
                <p className="text-white/60 text-xs">Status:</p>
                <p className="text-emerald-300 font-semibold">Connected</p>
              </div>
              <div>
                <p className="text-white/60 text-xs">Duration:</p>
                <p className="text-white font-mono">
                  {(() => {
                    const now = Date.now();
                    const start = activeSession.createdAt.getTime();
                    const diff = Math.floor((now - start) / 1000);
                    const hours = Math.floor(diff / 3600);
                    const minutes = Math.floor((diff % 3600) / 60);
                    const seconds = diff % 60;
                    return `${String(hours).padStart(2, '0')}:${String(
                      minutes
                    ).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                  })()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Web IDE Coming Soon */}
        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-6 py-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">
            Web IDE (Coming Soon)
          </h2>
          <p className="text-sm text-white/60">
            Soon we will provide a full cloud editor inside the Dashboard, so
            you can edit files without needing a local IDE.
          </p>
        </div>

        {/* Phase 151.2: Toggle File Explorer button */}
        <div className="flex justify-start">
          <button
            onClick={() => setShowFileExplorer((prev) => !prev)}
            className="text-xs text-purple-300 underline underline-offset-2 hover:text-purple-400"
          >
            {showFileExplorer
              ? (locale === 'ar' ? 'اخفاء مستكشف الملفات' : 'Hide File Explorer')
              : (locale === 'ar' ? 'اظهار مستكشف الملفات' : 'Show File Explorer')
            }
          </button>
        </div>
          </div>
        </div>
      </div>
    </F0Shell>
  );
}

// Loading fallback for Suspense boundary
function LiveCodingLoading() {
  return (
    <F0Shell>
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading Live Coding...</p>
        </div>
      </div>
    </F0Shell>
  );
}

// Main page component with Suspense boundary
export default function LiveCodingPage() {
  return (
    <Suspense fallback={<LiveCodingLoading />}>
      <LiveCodingContent />
    </Suspense>
  );
}
