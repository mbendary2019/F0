// src/bridge/diffEngine.ts
import { FileDeltaPayload, FileSnapshotPayload } from '../types/ideBridge';

interface FileState {
  path: string;
  lastContent: string;
  languageId?: string;
}

const fileStateMap = new Map<string, FileState>();

/**
 * Compute delta or snapshot for a file
 * Returns:
 * - snapshot if first time seeing the file
 * - delta if small change
 * - empty object if change is too large (caller should use FILE_CHANGED)
 */
export function computeDeltaOrSnapshot(
  path: string,
  languageId: string | undefined,
  newContent: string
): { snapshot?: FileSnapshotPayload; delta?: FileDeltaPayload } {
  const state = fileStateMap.get(path);

  // First time seeing this file
  if (!state) {
    const snapshot: FileSnapshotPayload = {
      path,
      languageId,
      content: newContent,
    };
    fileStateMap.set(path, { path, lastContent: newContent, languageId });
    return { snapshot };
  }

  const oldContent = state.lastContent;

  // No change
  if (oldContent === newContent) {
    return {};
  }

  // Find first index where content differs
  let start = 0;
  while (
    start < oldContent.length &&
    start < newContent.length &&
    oldContent[start] === newContent[start]
  ) {
    start++;
  }

  // Find last common index from the end
  let oldEnd = oldContent.length - 1;
  let newEnd = newContent.length - 1;
  while (
    oldEnd >= start &&
    newEnd >= start &&
    oldContent[oldEnd] === newContent[newEnd]
  ) {
    oldEnd--;
    newEnd--;
  }

  const deleteCount = oldEnd - start + 1;
  const insertText = newContent.slice(start, newEnd + 1);

  // If delta is too large (>30% of file), return empty (caller uses FILE_CHANGED)
  const oldLen = oldContent.length || 1;
  const changedRatio = (deleteCount + insertText.length) / oldLen;

  if (changedRatio > 0.3) {
    fileStateMap.set(path, { path, lastContent: newContent, languageId });
    return {};
  }

  const delta: FileDeltaPayload = {
    path,
    languageId,
    start,
    deleteCount,
    insertText,
  };

  // Update state
  fileStateMap.set(path, { path, lastContent: newContent, languageId });
  return { delta };
}

/**
 * Reset diff engine state (on bridge stop/restart)
 */
export function resetDiffEngine() {
  fileStateMap.clear();
}
