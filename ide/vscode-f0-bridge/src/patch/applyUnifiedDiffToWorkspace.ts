/**
 * applyUnifiedDiffToWorkspace.ts
 * Phase 84.3: Apply unified diff patches to workspace files
 * Uses patch engine from Phase 78 (adapted for VS Code)
 */

import * as vscode from 'vscode';
import { parseUnifiedDiff, applyPatchToContent, Patch, PatchResult } from './patchEngine';

/**
 * Apply a unified diff patch to workspace files
 * @param patchText - The unified diff string (can contain multiple file patches)
 * @param workspaceFolder - The workspace folder to apply patches to
 */
export async function applyUnifiedDiffToWorkspace(
  patchText: string,
  workspaceFolder: vscode.WorkspaceFolder
): Promise<void> {
  console.log('F0: Applying patch to workspace:', workspaceFolder.uri.fsPath);

  try {
    // Parse patch text into structured patches
    const patches = parseUnifiedDiff(patchText);

    if (patches.length === 0) {
      throw new Error('No valid patches found in diff text');
    }

    console.log(`F0: Found ${patches.length} file patch(es)`);

    // Track results
    const results: { file: string; success: boolean; error?: string }[] = [];

    // Apply each patch
    for (const patch of patches) {
      try {
        const result = await applyPatchToFile(patch, workspaceFolder);
        results.push({
          file: patch.filePath,
          success: result.success,
          error: result.error,
        });
      } catch (error: any) {
        results.push({
          file: patch.filePath,
          success: false,
          error: error.message,
        });
      }
    }

    // Show summary
    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    if (failed === 0) {
      vscode.window.showInformationMessage(
        `✅ Applied patches to ${succeeded} file(s)`
      );
    } else {
      const failedFiles = results.filter(r => !r.success).map(r => r.file).join(', ');
      vscode.window.showWarningMessage(
        `⚠️ Applied ${succeeded} patches, but ${failed} failed: ${failedFiles}`
      );
    }

    console.log('F0: Patch application complete', results);
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    vscode.window.showErrorMessage(`Failed to apply patch: ${errorMsg}`);
    throw error;
  }
}

/**
 * Apply a single patch to a file in the workspace
 */
async function applyPatchToFile(
  patch: Patch,
  workspaceFolder: vscode.WorkspaceFolder
): Promise<PatchResult> {
  const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, patch.filePath);

  // Handle new file creation
  if (patch.isNew) {
    // Create new file
    const edit = new vscode.WorkspaceEdit();
    edit.createFile(fileUri, { ignoreIfExists: false });
    await vscode.workspace.applyEdit(edit);

    // Get content from patch (all "add" lines)
    const newContent = patch.hunks
      .flatMap(hunk => hunk.lines.filter(l => l.type === 'add'))
      .map(l => l.content)
      .join('\n');

    const contentEdit = new vscode.WorkspaceEdit();
    contentEdit.insert(fileUri, new vscode.Position(0, 0), newContent);
    await vscode.workspace.applyEdit(contentEdit);

    const doc = await vscode.workspace.openTextDocument(fileUri);
    await doc.save();

    return {
      success: true,
      filePath: patch.filePath,
      content: newContent,
    };
  }

  // Handle file deletion
  if (patch.isDeleted) {
    const edit = new vscode.WorkspaceEdit();
    edit.deleteFile(fileUri);
    await vscode.workspace.applyEdit(edit);

    return {
      success: true,
      filePath: patch.filePath,
    };
  }

  // Handle file modification
  let doc: vscode.TextDocument;
  try {
    doc = await vscode.workspace.openTextDocument(fileUri);
  } catch (error) {
    return {
      success: false,
      filePath: patch.filePath,
      error: `File not found: ${patch.filePath}`,
    };
  }

  const originalContent = doc.getText();

  // Apply patch using patch engine
  const result = applyPatchToContent(originalContent, patch);

  if (!result.success) {
    console.error('F0: Patch application failed', result);
    return result;
  }

  // Apply changes to workspace
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(originalContent.length)
  );
  edit.replace(fileUri, fullRange, result.content!);

  const applied = await vscode.workspace.applyEdit(edit);

  if (!applied) {
    return {
      success: false,
      filePath: patch.filePath,
      error: 'Failed to apply workspace edit',
    };
  }

  // Save the document
  await doc.save();

  return result;
}
