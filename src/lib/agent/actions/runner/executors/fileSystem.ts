// src/lib/agent/actions/runner/executors/fileSystem.ts

import {
  AnyAction,
  ActionExecutionResult,
} from '@/lib/agent/actions/actionTypes';
import { getFileSystemAdapter } from '@/lib/agent/fs/fileSystemAdapter';

function now() {
  return Date.now();
}

/**
 * Main entry for FILE_SYSTEM actions.
 * Supports:
 * - WRITE_FILE
 * - UPDATE_FILE
 * - DELETE_FILE
 * - MKDIR
 */
export async function runFileSystemAction(
  action: AnyAction
): Promise<ActionExecutionResult> {
  const start = now();
  const logs: string[] = [];
  const fsAdapter = getFileSystemAdapter();

  try {
    switch (action.action) {
      case 'WRITE_FILE':
        return await handleWriteFile(action, fsAdapter, logs, start);

      case 'UPDATE_FILE':
        return await handleUpdateFile(action, fsAdapter, logs, start);

      case 'DELETE_FILE':
        return await handleDeleteFile(action, fsAdapter, logs, start);

      case 'MKDIR':
        return await handleMkdir(action, fsAdapter, logs, start);

      default:
        return {
          status: 'ERROR',
          startedAt: start,
          finishedAt: now(),
          logs: [
            `❌ [FILE_SYSTEM] Unsupported action: ${(action as any).action}`,
          ],
          error: {
            message: `Unsupported FILE_SYSTEM action: ${(action as any).action}`,
          },
        };
    }
  } catch (err: any) {
    logs.push('❌ [FILE_SYSTEM] Exception during execution');
    logs.push(String(err?.message || err));
    return {
      status: 'ERROR',
      startedAt: start,
      finishedAt: now(),
      logs,
      error: {
        message: String(err?.message || 'Unknown file system error'),
        details: err,
      },
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                               Handlers                                     */
/* -------------------------------------------------------------------------- */

async function handleWriteFile(
  action: any,
  fsAdapter: ReturnType<typeof getFileSystemAdapter>,
  logs: string[],
  startedAt: number
): Promise<ActionExecutionResult> {
  const path = action.path;
  const content = action.content ?? '';

  logs.push(`📝 [WRITE_FILE] Path: ${path}`);
  logs.push(`📦 Content length: ${content.length} chars`);

  await fsAdapter.writeFile(path, content);

  logs.push('✅ File written successfully');

  return {
    status: 'SUCCESS',
    startedAt,
    finishedAt: now(),
    logs,
    output: {
      operation: 'WRITE_FILE',
      path,
      bytes: Buffer.byteLength(content, 'utf8'),
    },
  };
}

async function handleUpdateFile(
  action: any,
  fsAdapter: ReturnType<typeof getFileSystemAdapter>,
  logs: string[],
  startedAt: number
): Promise<ActionExecutionResult> {
  const path = action.path;
  const newContent = action.newContent ?? action.content ?? '';

  logs.push(`📝 [UPDATE_FILE] Path: ${path}`);

  const exists = await fsAdapter.pathExists(path);

  if (!exists) {
    logs.push('⚠️ File does not exist, will be created instead.');
  } else {
    logs.push('📂 Existing file found, will overwrite.');
  }

  await fsAdapter.writeFile(path, newContent);

  logs.push('✅ File updated successfully');

  return {
    status: 'SUCCESS',
    startedAt,
    finishedAt: now(),
    logs,
    output: {
      operation: exists ? 'UPDATE_FILE' : 'WRITE_FILE',
      path,
      bytes: Buffer.byteLength(newContent, 'utf8'),
    },
  };
}

async function handleDeleteFile(
  action: any,
  fsAdapter: ReturnType<typeof getFileSystemAdapter>,
  logs: string[],
  startedAt: number
): Promise<ActionExecutionResult> {
  const path = action.path;

  logs.push(`🗑 [DELETE_FILE] Path: ${path}`);

  const exists = await fsAdapter.pathExists(path);
  if (!exists) {
    logs.push('ℹ️ File/dir does not exist, nothing to delete.');
    return {
      status: 'SUCCESS',
      startedAt,
      finishedAt: now(),
      logs,
      output: {
        operation: 'DELETE_FILE',
        path,
        deleted: false,
      },
    };
  }

  await fsAdapter.deletePath(path);
  logs.push('✅ Path deleted successfully.');

  return {
    status: 'SUCCESS',
    startedAt,
    finishedAt: now(),
    logs,
    output: {
      operation: 'DELETE_FILE',
      path,
      deleted: true,
    },
  };
}

async function handleMkdir(
  action: any,
  fsAdapter: ReturnType<typeof getFileSystemAdapter>,
  logs: string[],
  startedAt: number
): Promise<ActionExecutionResult> {
  const path = action.path;

  logs.push(`📁 [MKDIR] Path: ${path}`);

  await fsAdapter.mkdir(path, { recursive: true });

  logs.push('✅ Directory created (recursive).');

  return {
    status: 'SUCCESS',
    startedAt,
    finishedAt: now(),
    logs,
    output: {
      operation: 'MKDIR',
      path,
    },
  };
}
