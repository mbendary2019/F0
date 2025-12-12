# Phase 84.9.4 Integration Guide
## How to Add Patch System to page.tsx

This guide shows exactly what to add to `src/app/[locale]/f0/ide/page.tsx` to enable the patch application system.

---

## Step 1: Add Imports

Replace the current imports (lines 8-11) with:

```typescript
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { createIdeSession, sendIdeChat } from '@/lib/ideClient';
import { useIdeFiles } from './hooks/useIdeFiles';
import { parseAiPatch, FilePatch } from '@/lib/patch/parsePatch';
import { applyUnifiedDiff } from '@/lib/patch/applyPatch';
import { DiffViewer } from './components/DiffViewer';
```

---

## Step 2: Add Patch State

After line 49 (after `const [newFileName, setNewFileName] = useState('');`), add:

```typescript
  // Patch state (Phase 84.9.4)
  const [pendingPatch, setPendingPatch] = useState<{
    filePath: string;
    original: string;
    modified: string;
    diff: string;
  } | null>(null);

  const [patchError, setPatchError] = useState<string | null>(null);
```

---

## Step 3: Update sendToAI Function

Find the `sendToAI` function (around line 94) and replace the response handling section with this enhanced version:

```typescript
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
```

---

## Step 4: Add DiffViewer to JSX

At the **very end** of the return statement, just before the closing `</div>`, add:

```typescript
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
    </div>
  );
}
```

---

## Step 5: Update Phase Number in Header

Find line 216 and change:

```typescript
// OLD:
Phase 84.9.3 - Firestore Persistence

// NEW:
Phase 84.9.4 - Patch Application
```

---

## Complete Files Created

The following files have been created and are ready to use:

1. **[src/lib/patch/parsePatch.ts](src/lib/patch/parsePatch.ts)** - Parse AI patches
2. **[src/lib/patch/applyPatch.ts](src/lib/patch/applyPatch.ts)** - Apply unified diffs
3. **[src/app/[locale]/f0/ide/components/DiffViewer.tsx](src/app/[locale]/f0/ide/components/DiffViewer.tsx)** - Monaco diff viewer

---

## Testing the Patch System

### Test 1: Simple Code Fix

1. Open IDE at http://localhost:3030/en/f0/ide
2. In chat, ask: "Add error handling to the fibonacci function"
3. If AI returns a patch:
   - Diff viewer modal appears
   - Shows side-by-side comparison
   - Click "Apply Patch" to apply
   - Click "Cancel" to reject

### Test 2: Multi-Line Change

1. Select the fibonacci function
2. Ask: "Optimize this with memoization"
3. Review the suggested patch in diff viewer
4. Apply or cancel

### Expected Console Logs

```
[IDE] Patch detected in response, parsing...
[IDE] Parsed patches: [{ filePath: "index.ts", diff: "..." }]
[IDE] Applying patch to: index.ts
[IDE] Patch ready for review
```

After applying:
```
[IDE] Applying patch to: index.ts
[IDE Files] Auto-save scheduled for 1 file(s)...
[IDE Files] Auto-saving 1 file(s)...
[IDE Files] Auto-save complete ✅
```

---

## Notes

- The patch system supports multiple formats from AI (JSON, unified diff, etc.)
- Patches are applied optimistically - you can review before applying
- After applying, files auto-save to Firestore after 2 seconds
- The diff viewer uses Monaco's built-in DiffEditor for professional comparison
- All patch operations are logged to console for debugging

---

## Troubleshooting

**If patch parsing fails:**
- Check console for error details
- AI might have returned patch in unexpected format
- Parser supports JSON and unified diff formats

**If diff viewer doesn't show:**
- Ensure AI response contains `patches`, `patch`, or `diff` field
- Check browser console for errors
- Verify DiffViewer component loaded (check for "Loading diff viewer..." message)

**If apply doesn't work:**
- Ensure `updateFileContent` function accepts file path
- Check that file exists in files array
- Verify Firestore auto-save is working
