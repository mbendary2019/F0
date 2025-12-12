// src/lib/liveFileDelta.ts
import {
  FileSnapshotPayload,
  FileChangedPayload,
  FileDeltaPayload,
  IdeEventEnvelope,
} from '@/types/ideEvents';

/**
 * Apply delta to current content
 */
export function applyDelta(current: string, delta: FileDeltaPayload): string {
  const before = current.slice(0, delta.start);
  const after = current.slice(delta.start + delta.deleteCount);
  return before + delta.insertText + after;
}

export interface LiveFileState {
  path: string;
  content: string;
  languageId?: string;
}

/**
 * Reduce file events to get current file state
 * Events must be sorted by ts/eventId
 */
export function reduceFileEvents(
  events: IdeEventEnvelope[],
  filePath: string
): LiveFileState | null {
  let content = '';
  let languageId: string | undefined;

  for (const ev of events) {
    const kind = ev.kind;

    // Only process file-related events
    if (
      kind !== 'FILE_SNAPSHOT' &&
      kind !== 'FILE_CHANGED' &&
      kind !== 'FILE_DELTA'
    ) {
      continue;
    }

    const payload = ev.payload as
      | FileSnapshotPayload
      | FileChangedPayload
      | FileDeltaPayload;

    // Skip if not for this file
    if (payload.path !== filePath) continue;

    if (kind === 'FILE_SNAPSHOT') {
      content = (payload as FileSnapshotPayload).content;
      languageId = payload.languageId;
    } else if (kind === 'FILE_CHANGED') {
      content = (payload as FileChangedPayload).content;
      languageId = payload.languageId;
    } else if (kind === 'FILE_DELTA') {
      content = applyDelta(content, payload as FileDeltaPayload);
      languageId = payload.languageId;
    }
  }

  if (!content && !languageId) {
    return null;
  }

  return {
    path: filePath,
    content,
    languageId,
  };
}
