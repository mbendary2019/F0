'use client';

/**
 * Phase 84.9.2: Live Cloud IDE - Multi-File Support with Tabs
 * Web-based IDE with Monaco Editor, Real AI Integration, and In-Memory File System
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import nextDynamic from 'next/dynamic';
import { createIdeSession, sendIdeChat } from '@/lib/ideClient';
import { useIdeFiles } from './hooks/useIdeFiles';
import { parseAiPatch, FilePatch } from '@/lib/patch/parsePatch';
import { applyUnifiedDiff } from '@/lib/patch/applyPatch';
import { DiffViewer } from './components/DiffViewer';
import DependencyGraphPanel from '@/components/DependencyGraphPanel';
import RefactorDock from './components/RefactorDock';
import type { WorkspacePlan, IdeProjectAnalysisDocument } from '@/types/ideBridge';
import { useHeatmap } from './hooks/useHeatmap';
import {
  createSandbox,
  resetSandbox,
  applyPatchToSandbox,
  compareSandbox,
  exportSandboxSummary,
  type IdeSandbox,
  type IdeFileMap,
} from '@/lib/ide/sandboxEngine';

// Force dynamic rendering to avoid SSR issues with Monaco and window usage
export const dynamic = 'force-dynamic';

// Dynamic import to avoid SSR issues with Monaco
const Editor = nextDynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading Editor...</div>
});

export default function WebIDEPage() {
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const projectId = 'web-ide-default';

  // File system hook (with Firestore persistence)
  const {
    files,
    activeFile,
    activeFileId,
    setActiveFileId,
    updateFileContent,
    createFile,
    deleteFile,
    isLoading: filesLoading,
    error: filesError,
  } = useIdeFiles({ projectId });

  const editorRef = useRef<any>(null);

  // Chat state
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([
    { role: 'assistant', content: '👋 Hi! I\'m your F0 AI Assistant with Firestore persistence! Try:\n• Your files are automatically saved to Firestore\n• Refresh the page - your files persist!\n• Create, edit, and delete files\n• I can see all your files and changes' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // New file dialog state
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  // Patch state (Phase 84.9.4)
  const [pendingPatch, setPendingPatch] = useState<{
    filePath: string;
    original: string;
    modified: string;
    diff: string;
  } | null>(null);

  const [patchError, setPatchError] = useState<string | null>(null);

  // Phase 85.2.1: Workspace Plan state
  const [workspacePlan, setWorkspacePlan] = useState<WorkspacePlan | null>(null);
  const [workspacePatches, setWorkspacePatches] = useState<Array<{
    filePath: string;
    diff: string;
    stepId?: string;
  }>>([]);
  const [selectedPlanStepId, setSelectedPlanStepId] = useState<string | null>(null);
  const [isWorkspaceActionLoading, setIsWorkspaceActionLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Phase 85.3.1: Project Analysis state
  const [analysis, setAnalysis] = useState<IdeProjectAnalysisDocument | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Phase 85.4.2: Dependency Graph state
  const [showGraph, setShowGraph] = useState(false);

  // Phase 85.4.3: Code Impact Heatmap
  const heatmap = useHeatmap(
    editorRef.current,
    activeFile?.path ?? '',
    activeFile?.content ?? '',
    analysis
  );

  // Phase 85.5.1: Sandbox Mode state
  const [sandbox, setSandbox] = useState<IdeSandbox | null>(null);

  // Phase 85.5.3: Refactor Preview Dock state
  const [sandboxDiff, setSandboxDiff] = useState<{
    added: string[];
    modified: string[];
    removed: string[];
  } | null>(null);
  const [isDockOpen, setIsDockOpen] = useState(false);
  const [selectedForCommit, setSelectedForCommit] = useState<Set<string>>(new Set());

  // Group patches by step
  const patchesByStep = useMemo(() => {
    const map = new Map<string, Array<{ filePath: string; diff: string }>>();
    workspacePatches.forEach(p => {
      const stepId = p.stepId || 'unknown';
      if (!map.has(stepId)) map.set(stepId, []);
      map.get(stepId)!.push({ filePath: p.filePath, diff: p.diff });
    });
    return map;
  }, [workspacePatches]);

  // Create IDE session on mount
  useEffect(() => {
    async function initSession() {
      try {
        console.log('[IDE] Creating session...');
        const id = await createIdeSession({ projectId, clientKind: 'web-ide' });
        setSessionId(id);
        console.log('[IDE] Session created:', id);
      } catch (error: any) {
        console.error('[IDE] Session creation failed:', error);
        setSessionError(error.message);
      }
    }

    initSession();
  }, []);

  // Phase 85.5.3: Auto-calculate sandbox diff when sandbox or files change
  useEffect(() => {
    if (!sandbox) {
      setSandboxDiff(null);
      setSelectedForCommit(new Set());
      setIsDockOpen(false);
      return;
    }

    // Build real files map
    const realFilesMap: IdeFileMap = {};
    files.forEach((file) => {
      realFilesMap[file.path] = {
        path: file.path,
        content: file.content,
        languageId: file.languageId,
      };
    });

    // Compare sandbox with real files
    const diff = compareSandbox(sandbox, realFilesMap);
    setSandboxDiff(diff);

    // Auto-select all changed files for commit
    const allChangedFiles = new Set([
      ...diff.modified,
      ...diff.added,
      ...diff.removed,
    ]);
    setSelectedForCommit(allChangedFiles);

    // Auto-open dock if there are changes
    if (allChangedFiles.size > 0) {
      setIsDockOpen(true);
    }
  }, [sandbox, files]);

  // Handle editor mount
  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    console.log('[IDE] Monaco editor mounted');

    // Phase 85.4.3: Register heatmap hover provider
    if (monaco) {
      monaco.languages.registerHoverProvider(['typescript', 'javascript', 'typescriptreact', 'javascriptreact'], {
        provideHover(model: any, position: any) {
          if (!heatmap.impactData) return null;

          const line = position.lineNumber;
          const data = heatmap.impactData.lines.find((l) => l.line === line);

          if (!data) return null;

          return {
            contents: [
              {
                value: `**Impact:** ${data.risk.toUpperCase()} (${(data.impact * 100).toFixed(1)}%)\n\n${
                  data.reason || ''
                }`,
              },
            ],
          };
        },
      });
    }
  };

  // Handle new file creation
  const handleCreateFile = () => {
    if (newFileName.trim()) {
      createFile(newFileName.trim());
      setNewFileName('');
      setShowNewFileDialog(false);
    }
  };

  // Handle file deletion with confirmation
  const handleDeleteFile = (fileId: string) => {
    if (files.length === 1) {
      alert('Cannot delete the last file!');
      return;
    }

    if (confirm(`Delete ${fileId}?`)) {
      deleteFile(fileId);
    }
  };

  // Send message to AI
  const sendToAI = async () => {
    if (!input.trim() || !sessionId) return;

    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setInput('');

    try {
      // Get editor selection if any
      const editor = editorRef.current;
      let selectedText = '';

      if (editor) {
        const selection = editor.getSelection();
        const model = editor.getModel();
        if (selection && model) {
          selectedText = model.getValueInRange(selection);
        }
      }

      // Build file context for active file
      const fileContext = {
        filePath: activeFile.path,
        content: activeFile.content,
        selection: selectedText || undefined,
        languageId: activeFile.languageId
      };

      // Build workspace context with ALL files
      const workspaceContext = {
        projectId,
        sessionId,
        openedFiles: files.map(f => ({
          path: f.path,
          languageId: f.languageId
        })),
        currentFile: {
          path: activeFile.path,
          languageId: activeFile.languageId
        },
        changedFiles: files
          .filter(f => f.isDirty)
          .map(f => ({
            path: f.path,
            status: 'modified' as const
          })),
        packageJson: undefined,
        timestamp: Date.now()
      };

      console.log('[IDE] Sending chat:', {
        userMessage,
        hasSelection: !!selectedText,
        activeFile: activeFile.path,
        totalFiles: files.length,
        modifiedFiles: workspaceContext.changedFiles.length
      });

      // Send to AI
      const response = await sendIdeChat({
        sessionId,
        projectId,
        message: userMessage,
        fileContext,
        workspaceContext,
        locale: 'en'
      });

      console.log('[IDE] Received response:', response);

      // Extract reply text
      const replyText: string =
        response.replyText ??
        response.message ??
        'AI responded, but no replyText field was found.';

      // Add AI response to chat
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: replyText }
      ]);

      // 🔥 NEW: Try to parse patches from the response (if present)
      if (response.patches || response.patch || response.diff) {
        try {
          console.log('[IDE] Patch detected in response, parsing...');

          const rawPatchPayload =
            typeof response.patches === 'string'
              ? response.patches
              : typeof response.patch === 'string'
              ? response.patch
              : typeof response.diff === 'string'
              ? response.diff
              : JSON.stringify(response.patches ?? response.patch ?? response.diff);

          const filePatches: FilePatch[] = parseAiPatch(
            rawPatchPayload,
            activeFile.path
          );

          console.log('[IDE] Parsed patches:', filePatches);

          // Get the patch for the active file (or first patch if not found)
          const targetPatch =
            filePatches.find((p) => p.filePath === activeFile.path) ??
            filePatches[0];

          if (targetPatch) {
            console.log('[IDE] Applying patch to:', targetPatch.filePath);

            const modifiedContent = applyUnifiedDiff(
              activeFile.content,
              targetPatch.diff
            );

            setPendingPatch({
              filePath: targetPatch.filePath,
              original: activeFile.content,
              modified: modifiedContent,
              diff: targetPatch.diff,
            });

            console.log('[IDE] Patch ready for review');
          }
        } catch (err: any) {
          console.error('[IDE] Failed to parse/apply patch', err);
          setPatchError(err?.message ?? 'Failed to parse/apply AI patch');

          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: `⚠️ I suggested a code change, but there was an error applying it: ${err?.message || 'Unknown error'}`
            }
          ]);
        }
      }

    } catch (error: any) {
      console.error('[IDE] Chat error:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `⚠️ Error: ${error.message}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Phase 85.2.1: Build workspace context with file contents
  const buildWorkspaceContext = () => {
    return {
      projectId,
      sessionId,
      openedFiles: files.map(f => ({
        path: f.path,
        languageId: f.languageId,
        content: f.content, // Include content for patch generation
      })),
      currentFile: {
        path: activeFile.path,
        languageId: activeFile.languageId,
      },
      changedFiles: files
        .filter(f => f.isDirty)
        .map(f => ({ path: f.path, status: 'modified' as const })),
      timestamp: Date.now(),
    };
  };

  // Phase 85.2.1: Handle workspace plan/apply actions
  const handleWorkspaceAction = async (mode: 'multi-file-plan' | 'multi-file-apply') => {
    if (!input.trim() || !sessionId) return;

    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsWorkspaceActionLoading(true);
    setInput('');
    setLastError(null);

    // Clear previous plan
    setWorkspacePlan(null);
    setWorkspacePatches([]);
    setSelectedPlanStepId(null);

    try {
      console.log(`[IDE] Workspace action: ${mode}`);

      const workspaceContext = buildWorkspaceContext();

      const response = await sendIdeChatMessage({
        sessionId,
        projectId,
        message: userMessage,
        locale: params.locale,
        workspaceContext,
        mode, // Pass mode to API
      });

      console.log('[IDE] Workspace response:', response);

      // Handle workspace plan response
      if (response.kind === 'workspace-plan' || response.kind === 'workspace-plan+patches') {
        if (response.plan) {
          console.log('[IDE] Received workspace plan with', response.plan.steps.length, 'steps');
          setWorkspacePlan(response.plan);
        }

        if (response.patches && Array.isArray(response.patches)) {
          console.log('[IDE] Received', response.patches.length, 'patches');
          setWorkspacePatches(response.patches);
        }

        // Add AI response
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: response.replyText || 'Created workspace plan.' }
        ]);
      } else {
        // Fallback for unexpected response
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: response.replyText || 'Workspace action completed.' }
        ]);
      }
    } catch (error: any) {
      console.error('[IDE] Workspace action error:', error);
      setLastError(error.message);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `⚠️ Error: ${error.message}` }
      ]);
    } finally {
      setIsWorkspaceActionLoading(false);
    }
  };

  // Phase 85.2.1: Open a patch in diff viewer
  const openPatchDiff = (patch: { filePath: string; diff: string }) => {
    try {
      console.log('[IDE] Opening patch diff for:', patch.filePath);

      // Find the file in workspace
      const targetFile = files.find(f => f.path === patch.filePath);

      if (!targetFile) {
        console.warn('[IDE] File not found in workspace:', patch.filePath);
        setPatchError(`File not found: ${patch.filePath}`);
        return;
      }

      // Apply diff to get modified content
      const modifiedContent = applyUnifiedDiff(targetFile.content, patch.diff);

      // Set pending patch for diff viewer
      setPendingPatch({
        filePath: patch.filePath,
        original: targetFile.content,
        modified: modifiedContent,
        diff: patch.diff,
      });

      console.log('[IDE] Patch ready for review');
    } catch (err: any) {
      console.error('[IDE] Failed to apply patch:', err);
      setPatchError(err?.message ?? 'Failed to apply patch');
    }
  };

  // Phase 85.2.2 + 85.5.2: Apply multiple patches at once (with sandbox support)
  const applyPatchList = async (
    patches: Array<{ filePath: string; diff: string }>,
    scopeLabel: string
  ) => {
    if (!patches.length) {
      setLastError(`No patches to apply for ${scopeLabel}.`);
      return;
    }

    setIsWorkspaceActionLoading(true);
    setLastError(null);

    let applied = 0;
    let failed = 0;

    // Phase 85.5.2: Check if we're in sandbox mode
    if (sandbox) {
      console.log('[WebIDE] Applying patches to SANDBOX (not Firestore)');

      for (const patch of patches) {
        try {
          applyPatchToSandbox(sandbox, patch.filePath, patch.diff);
          applied++;
        } catch (err) {
          console.error('[WebIDE] Failed to apply patch to sandbox for', patch.filePath, err);
          failed++;
        }
      }

      // Trigger re-render to show sandbox changes
      setSandbox({ ...sandbox });

      setIsWorkspaceActionLoading(false);

      // Add summary message to chat
      const summary = `Applied ${applied}/${patches.length} patches to SANDBOX for ${scopeLabel}.` +
        (failed ? ` ${failed} patch(es) failed to apply.` : '') +
        ` (${sandbox.dirtyFiles.size} files modified)`;

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `🧪 ${summary}\n\n⚠️ Changes are in sandbox. Click "✅ Commit" to save to Firestore.` },
      ]);

      if (failed) {
        setLastError(summary);
      }
    } else {
      console.log('[WebIDE] Applying patches DIRECTLY to Firestore');

      for (const patch of patches) {
        const file = files.find((f) => f.path === patch.filePath);
        if (!file) {
          console.warn('[WebIDE] Cannot apply patch, file not loaded:', patch.filePath);
          failed++;
          continue;
        }

        try {
          const modified = applyUnifiedDiff(file.content, patch.diff);
          // Update state + let auto-save handle persistence (Phase 84.9.3)
          updateFileContent(patch.filePath, modified);
          applied++;
        } catch (err) {
          console.error('[WebIDE] Failed to apply patch for', patch.filePath, err);
          failed++;
        }
      }

      setIsWorkspaceActionLoading(false);

      // Add summary message to chat
      const summary = `Applied ${applied}/${patches.length} patches for ${scopeLabel}.` +
        (failed ? ` ${failed} patch(es) failed to apply.` : '');

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `✅ ${summary}` },
      ]);

      if (failed) {
        setLastError(summary);
      }
    }
  };

  // Phase 85.2.2: Apply all patches for a specific step
  const handleApplyStepPatches = async (stepId: string) => {
    if (!workspacePlan) return;
    const step = workspacePlan.steps.find((s) => s.id === stepId);
    const patches = patchesByStep.get(stepId) ?? [];

    const label = step
      ? `step "${step.title}"`
      : `step ${stepId}`;

    await applyPatchList(patches, label);
  };

  // Phase 85.2.2: Apply all patches across all steps
  const handleApplyAllPatches = async () => {
    if (!workspacePlan || !workspacePatches.length) {
      setLastError('No workspace patches to apply.');
      return;
    }

    await applyPatchList(workspacePatches, `workspace plan "${workspacePlan.goal}"`);
  };

  // Phase 85.5.1 + 85.5.2: Sandbox Mode handlers
  const startSandbox = () => {
    // Convert files array to file map
    const fileMap: IdeFileMap = {};
    files.forEach((file) => {
      fileMap[file.path] = {
        path: file.path,
        content: file.content,
        languageId: file.languageId,
      };
    });

    const newSandbox = createSandbox(fileMap);
    setSandbox(newSandbox);

    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: `🧪 **Sandbox Mode Activated!**\n\nYou're now in a safe experimentation environment. All future patches and AI refactors will be applied to an in-memory copy of your project.\n\n✨ **What this means:**\n- All changes are isolated (won't affect Firestore)\n- You can review diffs before committing\n- Click "✅ Commit" when ready to save\n- Click "🗑️ Discard" to abandon all changes\n\nSandbox ID: \`${newSandbox.id.slice(0, 8)}\``,
      },
    ]);

    console.log('[Sandbox] Created new sandbox:', exportSandboxSummary(newSandbox));
  };

  const discardSandbox = () => {
    if (sandbox) {
      const summary = exportSandboxSummary(sandbox);
      console.log('[Sandbox] Discarding sandbox:', summary);

      setSandbox(null);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `🗑️ Sandbox discarded. ${summary.patchCount} patches were not applied.`,
        },
      ]);
    }
  };

  const commitSandbox = async () => {
    if (!sandbox) return;

    const comparison = compareSandbox(sandbox, files.reduce((map, f) => ({ ...map, [f.path]: f }), {} as IdeFileMap));
    console.log('[Sandbox] Committing sandbox:', comparison);

    // Apply all changed files to real project
    for (const filePath of comparison.modified) {
      const newContent = sandbox.working[filePath].content;
      await updateFileContent(filePath, newContent);
    }

    for (const filePath of comparison.added) {
      await createFile(filePath, sandbox.working[filePath].content);
    }

    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: `✅ Sandbox committed! ${comparison.modified.length} modified, ${comparison.added.length} added.`,
      },
    ]);

    setSandbox(null);
  };

  // Phase 85.5.3: RefactorDock handler functions
  const toggleFileSelection = (filePath: string) => {
    setSelectedForCommit((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  };

  const openFileDiffInViewer = (filePath: string) => {
    if (!sandbox) return;

    const realFile = files.find((f) => f.path === filePath);
    const sandboxFile = sandbox.working[filePath];

    if (!sandboxFile) {
      console.warn('[RefactorDock] File not in sandbox:', filePath);
      return;
    }

    // Show diff viewer
    setPendingPatch({
      filePath,
      original: realFile?.content || '',
      modified: sandboxFile.content,
      diff: '', // Diff viewer will compute it
    });
  };

  const handleCommitSelected = async () => {
    if (!sandbox || selectedForCommit.size === 0) return;

    console.log('[RefactorDock] Committing', selectedForCommit.size, 'files');

    let committed = 0;

    // Apply selected files to real project
    for (const filePath of selectedForCommit) {
      const sandboxFile = sandbox.working[filePath];
      if (!sandboxFile) continue;

      const realFile = files.find((f) => f.path === filePath);

      if (realFile) {
        // Modified file
        await updateFileContent(filePath, sandboxFile.content);
        committed++;
      } else {
        // New file
        await createFile(filePath, sandboxFile.content);
        committed++;
      }

      // Remove from sandbox dirty files
      sandbox.dirtyFiles.delete(filePath);
    }

    // Update sandbox state
    setSandbox({ ...sandbox });

    // Clear selection
    setSelectedForCommit(new Set());

    // Add success message
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: `✅ Committed ${committed} file${committed !== 1 ? 's' : ''} from sandbox to Firestore.`,
      },
    ]);

    // If all files are committed, close sandbox
    if (sandbox.dirtyFiles.size === 0) {
      setSandbox(null);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '🧪 Sandbox empty. Sandbox mode deactivated.',
        },
      ]);
    }
  };

  const handleDiscardSandbox = () => {
    discardSandbox();
  };

  // Phase 85.3.1: Run project dependency analysis
  const runAnalysis = async () => {
    if (!sessionId) {
      setAnalysisError("No active IDE session. Please wait for connection.");
      return;
    }

    setIsAnalysisLoading(true);
    setAnalysisError(null);

    try {
      // Use the same helper from Phase 85.2.1
      const workspaceContext = buildWorkspaceContext();

      const res = await fetch("/api/ide/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          files: files.map(f => ({
            path: f.path,
            content: f.content,
            languageId: f.languageId
          }))
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("[WebIDE] Analysis error response:", json);
        throw new Error(json?.error ?? "Failed to analyze project");
      }

      // Store full analysis document
      setAnalysis(json.analysis || {
        summary: json.summary,
        files: json.files || [],
        edges: json.edges || []
      });

      // Add feedback message to chat
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `📊 Project analysis updated.\n\nFiles: ${json.summary?.fileCount || 0}, Dependencies: ${json.summary?.edgeCount || 0}, Issues: ${json.summary?.issues?.length || 0}.`,
        },
      ]);
    } catch (err: any) {
      console.error("[WebIDE] runAnalysis error", err);
      setAnalysisError(err?.message ?? "Project analysis failed");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Project analysis failed: ${err?.message ?? "Unknown error"}`,
        },
      ]);
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  // Connection status indicator
  const getConnectionStatus = () => {
    if (sessionError) return { text: '⚠️ Disconnected', color: 'text-red-400' };
    if (!sessionId) return { text: '🔄 Connecting...', color: 'text-yellow-400' };
    return { text: '✅ Connected to F0 IDE', color: 'text-green-400' };
  };

  const status = getConnectionStatus();

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Top Bar */}
      <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 gap-4">
        <h1 className="text-white font-semibold text-lg">F0 Live Cloud IDE</h1>

        {/* Connection status / session */}
        <div className="text-xs text-gray-400">
          {sessionId ? (
            <span>Session: <span className="text-green-400">{sessionId.slice(0, 8)}...</span></span>
          ) : (
            <span className="text-yellow-400">Connecting...</span>
          )}
        </div>

        {/* Phase 85.3.1: Analyze Project Button */}
        <button
          onClick={runAnalysis}
          disabled={isAnalysisLoading || !sessionId}
          className="ml-auto text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-100 disabled:opacity-50 flex items-center gap-2"
        >
          {isAnalysisLoading ? (
            <span className="animate-pulse">Analyzing...</span>
          ) : (
            <>
              <span>📊 Analyze Project</span>
            </>
          )}
        </button>

        {/* Phase 85.4.2: Graph Toggle Button */}
        <button
          onClick={() => setShowGraph(!showGraph)}
          disabled={!analysis}
          className="ml-3 text-xs px-3 py-1 rounded bg-purple-700 hover:bg-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          📈 Graph
        </button>

        {/* Phase 85.4.3: Heatmap Toggle Button */}
        <button
          onClick={() => heatmap.toggle()}
          disabled={!analysis || !activeFile}
          className={`ml-3 text-xs px-3 py-1 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed ${
            heatmap.enabled ? 'bg-fuchsia-700 hover:bg-fuchsia-600' : 'bg-fuchsia-600 hover:bg-fuchsia-500'
          }`}
        >
          🔥 Heatmap
        </button>

        {/* Phase 85.5.1 + 85.5.2: Sandbox Mode Button */}
        {!sandbox ? (
          <button
            onClick={startSandbox}
            disabled={files.length === 0}
            className="ml-3 text-xs px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🧪 Sandbox Mode
          </button>
        ) : (
          <div className="ml-3 flex gap-2 items-center">
            {/* Active Sandbox Badge */}
            <span className="text-xs px-2 py-1 rounded bg-purple-900 border border-purple-500 text-purple-200 flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
              Sandbox Active • {sandbox.dirtyFiles.size} modified
            </span>

            {/* Commit Button */}
            <button
              onClick={commitSandbox}
              disabled={sandbox.dirtyFiles.size === 0}
              className="text-xs px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save all sandbox changes to Firestore"
            >
              ✅ Commit
            </button>

            {/* Discard Button */}
            <button
              onClick={discardSandbox}
              className="text-xs px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white"
              title="Discard all sandbox changes"
            >
              🗑️ Discard
            </button>
          </div>
        )}

        <div className="text-gray-400 text-xs flex items-center gap-2">
          Phase 85.3.1 - Analysis Panel
          {filesLoading && <span className="text-yellow-400">● Loading...</span>}
          {filesError && <span className="text-red-400">⚠ Error</span>}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Explorer (Left) */}
        <div className="w-64 bg-gray-900 border-r border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Files</h3>
            <button
              onClick={() => setShowNewFileDialog(true)}
              className="text-blue-400 hover:text-blue-300 text-sm"
              title="Create new file"
            >
              + New
            </button>
          </div>

          <div className="space-y-1">
            {files.map(file => (
              <div
                key={file.id}
                onClick={() => setActiveFileId(file.id)}
                className={`group flex items-center justify-between p-2 rounded cursor-pointer text-sm ${
                  file.id === activeFileId
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="flex-shrink-0">
                    {file.languageId === 'markdown' ? '📝' : '📄'}
                  </span>
                  <span className="truncate">{file.path}</span>
                  {file.isDirty && (
                    <span className="text-yellow-400 text-xs">●</span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(file.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 ml-2 flex-shrink-0"
                  title="Delete file"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* File Stats */}
          <div className="mt-4 pt-4 border-t border-gray-800">
            <div className="text-xs text-gray-500 space-y-1">
              <div>Total files: {files.length}</div>
              <div>Modified: {files.filter(f => f.isDirty).length}</div>
              <div>Active: {activeFile.path}</div>
            </div>
          </div>
        </div>

        {/* Monaco Editor (Center) */}
        <div className="flex-1 flex flex-col">
          {/* Tab Bar */}
          <div className="h-10 bg-gray-800 border-b border-gray-700 flex items-center px-2 space-x-1 overflow-x-auto">
            {files.map(file => (
              <button
                key={file.id}
                onClick={() => setActiveFileId(file.id)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-t text-sm whitespace-nowrap ${
                  file.id === activeFileId
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span>{file.path}</span>
                {file.isDirty && <span className="text-yellow-400">●</span>}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(file.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:bg-gray-600 rounded px-1 text-gray-400 hover:text-white"
                  title="Close"
                >
                  ×
                </button>
              </button>
            ))}
          </div>

          {/* Editor */}
          <div className="flex-1">
            <Editor
              height="100%"
              language={activeFile.languageId}
              theme="vs-dark"
              value={activeFile.content}
              onChange={(value) => updateFileContent(activeFileId, value || '')}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: true },
                fontSize: 14,
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2
              }}
            />
          </div>

          {/* Status Bar */}
          <div className="h-8 bg-blue-600 flex items-center px-4 text-white text-sm">
            <span>{activeFile.languageId}</span>
            <span className="mx-2">|</span>
            <span>UTF-8</span>
            <span className="mx-2">|</span>
            <span>{activeFile.path}</span>
            {activeFile.isDirty && (
              <>
                <span className="mx-2">|</span>
                <span className="text-yellow-300">● Modified</span>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              <span className={status.color}>{status.text}</span>
            </div>
          </div>
        </div>

        {/* AI Chat Panel (Right) */}
        <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
          {/* Chat Header */}
          <div className="h-12 border-b border-gray-700 flex items-center px-4 gap-2">
            <h3 className="text-white font-semibold">AI Assistant</h3>

            {/* Phase 85.2.1: Workspace Action Buttons */}
            {sessionId && (
              <>
                <button
                  onClick={() => handleWorkspaceAction('multi-file-plan')}
                  disabled={isWorkspaceActionLoading || !input.trim()}
                  className="ml-auto text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-2 py-1 rounded transition-colors"
                  title="Create a multi-file plan"
                >
                  📋 Plan Workspace
                </button>
                <button
                  onClick={() => handleWorkspaceAction('multi-file-apply')}
                  disabled={isWorkspaceActionLoading || !input.trim()}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-2 py-1 rounded transition-colors"
                  title="Plan + generate patches"
                >
                  🔧 Plan & Patch
                </button>
              </>
            )}

            {!sessionId && (
              <div className="ml-auto">
                <span className="text-xs text-yellow-400">Connecting...</span>
              </div>
            )}
          </div>

          {/* Phase 85.2.1: Workspace Plan Panel */}
          {workspacePlan && (
            <div className="border-b border-gray-700 bg-gray-800/50 p-4 max-h-64 overflow-y-auto">
              <div className="text-sm font-semibold text-purple-400 mb-2">
                📋 Workspace Plan
              </div>
              <div className="text-xs text-gray-400 mb-3">{workspacePlan.summary}</div>

              <div className="space-y-2">
                {workspacePlan.steps.map((step) => {
                  const stepPatches = patchesByStep.get(step.id) || [];
                  const isSelected = selectedPlanStepId === step.id;

                  return (
                    <div
                      key={step.id}
                      className={`border rounded p-2 ${
                        isSelected ? 'border-purple-500 bg-purple-900/20' : 'border-gray-600'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedPlanStepId(isSelected ? null : step.id)}
                        className="w-full text-left"
                      >
                        <div className="text-sm font-medium text-white">
                          {step.title}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {step.description}
                        </div>
                        <div className="flex gap-2 mt-2 text-xs flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                            {step.changeKind}
                          </span>
                          <span className="text-gray-500">
                            {step.targetFiles.length} file{step.targetFiles.length > 1 ? 's' : ''}
                          </span>
                          {stepPatches.length > 0 && (
                            <span className="text-green-400">
                              ✓ {stepPatches.length} patch{stepPatches.length > 1 ? 'es' : ''}
                            </span>
                          )}

                          {/* Phase 85.4.1: Impact & Risk Badges */}
                          {step.impact && (
                            <>
                              <span className={`px-2 py-0.5 rounded ${
                                step.impact.overallImpact === 'high' ? 'bg-red-700/40 text-red-300' :
                                step.impact.overallImpact === 'medium' ? 'bg-yellow-700/40 text-yellow-300' :
                                'bg-green-700/40 text-green-300'
                              }`}>
                                Impact: {step.impact.overallImpact}
                              </span>
                              <span className={`px-2 py-0.5 rounded ${
                                step.impact.overallRisk === 'high' ? 'bg-red-900/40 text-red-400' :
                                step.impact.overallRisk === 'medium' ? 'bg-orange-800/40 text-orange-300' :
                                'bg-green-900/40 text-green-300'
                              }`}>
                                Risk: {step.impact.overallRisk}
                              </span>
                              {step.impact.blastRadius > 0 && (
                                <span className="text-gray-500">
                                  Blast: {step.impact.blastRadius}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </button>

                      {/* Show patches for selected step */}
                      {isSelected && stepPatches.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-600 space-y-2">
                          <div className="space-y-1">
                            {stepPatches.map((patch, idx) => (
                              <button
                                key={idx}
                                onClick={() => openPatchDiff(patch)}
                                className="w-full text-left px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                              >
                                <div className="text-xs text-blue-400 font-mono">
                                  {patch.filePath}
                                </div>
                              </button>
                            ))}
                          </div>

                          {/* Phase 85.2.2: Apply Step / Apply All Buttons */}
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <button
                              onClick={() => handleApplyStepPatches(step.id)}
                              disabled={isWorkspaceActionLoading || !stepPatches.length}
                              className="flex-1 text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-colors"
                            >
                              Apply Step Patches
                            </button>

                            <button
                              onClick={handleApplyAllPatches}
                              disabled={isWorkspaceActionLoading || !workspacePatches.length}
                              className="flex-1 text-xs px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-colors"
                            >
                              Apply All
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {lastError && (
                <div className="mt-3 text-xs text-red-400">
                  ⚠️ {lastError}
                </div>
              )}

              <button
                onClick={() => {
                  setWorkspacePlan(null);
                  setWorkspacePatches([]);
                  setSelectedPlanStepId(null);
                }}
                className="mt-3 w-full text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded"
              >
                Clear Plan
              </button>
            </div>
          )}

          {/* Phase 85.3.1: Project Analysis Panel */}
          {analysis && (
            <div className="border-b border-gray-700 px-4 py-3 text-xs text-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-100 flex items-center gap-2">
                    <span>📊 Project Analysis</span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(analysis.summary.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Files: {analysis.summary.fileCount} · Deps: {analysis.summary.edgeCount} · Issues: {analysis.summary.issues.length}
                  </div>
                </div>
                <button
                  className="text-[11px] text-gray-400 hover:text-gray-200"
                  onClick={() => setAnalysis(null)}
                >
                  Clear
                </button>
              </div>

              {/* Core Files (Top Fan-In) */}
              <div className="space-y-1">
                <div className="font-semibold text-[11px] text-gray-300">
                  Core Files (Top Fan-In)
                </div>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {analysis.summary.topFanIn.length === 0 && (
                    <div className="text-[11px] text-gray-500">No data.</div>
                  )}
                  {analysis.summary.topFanIn.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => setActiveFileId(f.path)}
                      className="w-full text-left px-2 py-1 rounded bg-gray-800/60 hover:bg-gray-800 flex items-center justify-between"
                    >
                      <span className="font-mono text-[11px] text-gray-200 truncate mr-2">
                        {f.path}
                      </span>
                      <span className="text-[10px] text-blue-300">
                        ↑ {f.fanIn}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* God Files (Top Fan-Out) */}
              <div className="space-y-1 pt-2 border-t border-gray-800">
                <div className="font-semibold text-[11px] text-gray-300">
                  God Files (Top Fan-Out)
                </div>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {analysis.summary.topFanOut.length === 0 && (
                    <div className="text-[11px] text-gray-500">No data.</div>
                  )}
                  {analysis.summary.topFanOut.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => setActiveFileId(f.path)}
                      className="w-full text-left px-2 py-1 rounded bg-gray-800/60 hover:bg-gray-800 flex items-center justify-between"
                    >
                      <span className="font-mono text-[11px] text-gray-200 truncate mr-2">
                        {f.path}
                      </span>
                      <span className="text-[10px] text-amber-300">
                        ↓ {f.fanOut}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cycles */}
              <div className="space-y-1 pt-2 border-t border-gray-800">
                <div className="font-semibold text-[11px] text-gray-300">
                  Cycles
                </div>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {analysis.summary.cycles.length === 0 && (
                    <div className="text-[11px] text-gray-500">No cycles detected.</div>
                  )}
                  {analysis.summary.cycles.map((cycle, idx) => (
                    <div
                      key={idx}
                      className="px-2 py-1 rounded bg-gray-800/60 text-[11px] text-gray-200 space-y-1"
                    >
                      <div className="text-[11px] text-amber-400">
                        cycle-{idx + 1}
                      </div>
                      <div className="space-y-0.5">
                        {cycle.map((p) => (
                          <button
                            key={p}
                            onClick={() => setActiveFileId(p)}
                            className="block text-left w-full font-mono text-[11px] text-gray-300 hover:text-white truncate"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Issues */}
              <div className="space-y-1 pt-2 border-t border-gray-800">
                <div className="font-semibold text-[11px] text-gray-300">
                  Issues
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {analysis.summary.issues.length === 0 && (
                    <div className="text-[11px] text-gray-500">No issues detected.</div>
                  )}
                  {analysis.summary.issues.map((issue) => (
                    <div
                      key={issue.id}
                      className="px-2 py-1 rounded bg-gray-800/60 text-[11px] text-gray-200"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span>
                          [{issue.severity}] {issue.title}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {issue.kind}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 mb-1">
                        {issue.description}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {issue.files.slice(0, 4).map((path) => (
                          <button
                            key={path}
                            onClick={() => setActiveFileId(path)}
                            className="text-[10px] px-2 py-0.5 rounded bg-gray-900 hover:bg-gray-700 text-gray-200 font-mono truncate max-w-full"
                          >
                            {path}
                          </button>
                        ))}
                        {issue.files.length > 4 && (
                          <span className="text-[10px] text-gray-500">
                            +{issue.files.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {analysisError && (
                <div className="text-[11px] text-red-400 pt-1 border-t border-gray-800">
                  ⚠ {analysisError}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`${
                  msg.role === 'user'
                    ? 'bg-blue-900/30 border-blue-700'
                    : 'bg-gray-700/50 border-gray-600'
                } border rounded-lg p-3`}
              >
                <div className={`text-xs font-semibold mb-1 ${
                  msg.role === 'user' ? 'text-blue-400' : 'text-green-400'
                }`}>
                  {msg.role === 'user' ? 'You' : 'F0 AI'}
                </div>
                <div className="text-gray-200 text-sm whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            ))}
            {(isLoading || isWorkspaceActionLoading) && (
              <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3">
                <div className="text-xs font-semibold mb-1 text-green-400">F0 AI</div>
                <div className="text-gray-400 text-sm flex items-center gap-2">
                  <div className="animate-pulse">●</div>
                  {isWorkspaceActionLoading
                    ? 'Planning workspace changes...'
                    : `Analyzing ${files.length} file${files.length > 1 ? 's' : ''}...`}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-700 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && !isWorkspaceActionLoading && sessionId && sendToAI()}
                className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                placeholder={sessionId ? "Ask about your code..." : "Connecting..."}
                disabled={isLoading || isWorkspaceActionLoading || !sessionId}
              />
              <button
                onClick={sendToAI}
                disabled={isLoading || isWorkspaceActionLoading || !input.trim() || !sessionId}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium transition-colors"
              >
                {isLoading || isWorkspaceActionLoading ? '...' : 'Send'}
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              💡 Files auto-save to Firestore • {files.length} file{files.length > 1 ? 's' : ''} • {files.filter(f => f.isDirty).length} unsaved
            </div>
            {sessionError && (
              <div className="mt-2 text-xs text-red-400">
                ⚠️ {sessionError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New File Dialog */}
      {showNewFileDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-96">
            <h3 className="text-white font-semibold mb-4">Create New File</h3>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateFile()}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="e.g., components.tsx"
              autoFocus
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowNewFileDialog(false);
                  setNewFileName('');
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFile}
                disabled={!newFileName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patch Diff Viewer (Phase 84.9.4) */}
      {pendingPatch && (
        <DiffViewer
          filePath={pendingPatch.filePath}
          original={pendingPatch.original}
          modified={pendingPatch.modified}
          onCancel={() => {
            setPendingPatch(null);
            setPatchError(null);
          }}
          onApply={() => {
            console.log('[IDE] Applying patch to:', pendingPatch.filePath);
            // Apply the patch to the file
            updateFileContent(pendingPatch.filePath, pendingPatch.modified);
            setPendingPatch(null);
            setPatchError(null);

            // Notify user
            setMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content: `✅ Patch applied to ${pendingPatch.filePath}! The file will auto-save in 2 seconds.`
              }
            ]);
          }}
        />
      )}

      {/* Phase 85.4.2: Dependency Graph Panel */}
      {showGraph && analysis && (
        <div className="absolute right-0 bottom-0 top-12 w-[500px] border-l border-gray-700 bg-gray-900 z-50">
          <DependencyGraphPanel
            analysis={analysis}
            onOpenFile={(path) => {
              setActiveFileId(path);
            }}
          />
        </div>
      )}

      {/* Phase 85.5.3: Refactor Preview Dock */}
      {sandbox && sandboxDiff && (
        <div className="absolute bottom-0 left-0 right-0 z-40">
          <RefactorDock
            isOpen={isDockOpen}
            sandboxDiff={sandboxDiff}
            selectedFiles={selectedForCommit}
            onToggle={() => setIsDockOpen(!isDockOpen)}
            onSelectFile={openFileDiffInViewer}
            onToggleFileSelection={toggleFileSelection}
            onCommitSelected={handleCommitSelected}
            onDiscardSandbox={handleDiscardSandbox}
          />
        </div>
      )}
    </div>
  );
}
