// src/lib/agent/fs/fileSystemAdapter.ts

import fs from 'fs/promises';
import path from 'path';

/**
 * Abstract interface so we can swap implementation:
 * - Node.js local FS (dev / CLI / server-side)
 * - Remote workspace (Web IDE)
 * - In-memory (tests)
 */
export interface FileSystemAdapter {
  rootDir: string;

  readFile(relPath: string): Promise<string | null>;
  writeFile(relPath: string, content: string): Promise<void>;
  deletePath(relPath: string): Promise<void>;
  mkdir(relPath: string, opts?: { recursive?: boolean }): Promise<void>;
  pathExists(relPath: string): Promise<boolean>;
}

/**
 * Utility: ensure a relative path stays inside rootDir and normalize it.
 */
export function resolveSafePath(rootDir: string, relPath: string): string {
  const cleaned = relPath.replace(/^(\.\/|\/)+/, ''); // remove leading ./ or /
  const full = path.resolve(rootDir, cleaned);

  const normalizedRoot = path.resolve(rootDir);
  if (!full.startsWith(normalizedRoot)) {
    throw new Error(
      `[FileSystemAdapter] Unsafe path outside rootDir: ${relPath}`
    );
  }

  return full;
}

/**
 * Default Node.js implementation using fs/promises.
 * NOTE: This must only run in Node/server environments (NOT on the client).
 */
export class NodeFileSystemAdapter implements FileSystemAdapter {
  rootDir: string;

  constructor(rootDir?: string) {
    this.rootDir =
      rootDir || process.env.F0_WORKSPACE_ROOT || process.cwd();
  }

  async readFile(relPath: string): Promise<string | null> {
    const full = resolveSafePath(this.rootDir, relPath);
    try {
      const buf = await fs.readFile(full, 'utf8');
      return buf.toString();
    } catch (err: any) {
      if (err?.code === 'ENOENT') return null;
      throw err;
    }
  }

  async writeFile(relPath: string, content: string): Promise<void> {
    const full = resolveSafePath(this.rootDir, relPath);
    const dir = path.dirname(full);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(full, content, 'utf8');
  }

  async deletePath(relPath: string): Promise<void> {
    const full = resolveSafePath(this.rootDir, relPath);
    try {
      const stat = await fs.lstat(full);
      if (stat.isDirectory()) {
        // recursive directory delete
        await fs.rm(full, { recursive: true, force: true });
      } else {
        await fs.unlink(full);
      }
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        // already deleted → ignore
        return;
      }
      throw err;
    }
  }

  async mkdir(relPath: string, opts?: { recursive?: boolean }): Promise<void> {
    const full = resolveSafePath(this.rootDir, relPath);
    await fs.mkdir(full, { recursive: opts?.recursive ?? true });
  }

  async pathExists(relPath: string): Promise<boolean> {
    const full = resolveSafePath(this.rootDir, relPath);
    try {
      await fs.access(full);
      return true;
    } catch {
      return false;
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                    Global adapter instance + helpers                       */
/* -------------------------------------------------------------------------- */

let currentAdapter: FileSystemAdapter | null = null;

/**
 * Get current adapter (lazy-init to NodeFileSystemAdapter by default).
 */
export function getFileSystemAdapter(): FileSystemAdapter {
  if (!currentAdapter) {
    currentAdapter = new NodeFileSystemAdapter();
  }
  return currentAdapter;
}

/**
 * Override adapter (for tests, Web IDE, remote FS, etc.).
 */
export function setFileSystemAdapter(adapter: FileSystemAdapter | null) {
  currentAdapter = adapter;
}
