// src/app/[locale]/f0/ide/hooks/useIdeFiles.ts
"use client";

import { useEffect, useRef, useState } from "react";
import {
  IdeFileRecord,
  loadProjectFiles,
  saveProjectFile,
  deleteProjectFile,
} from "@/lib/ideProjectFiles";

export interface IdeFile extends IdeFileRecord {
  id: string;       // same as path for now
  isDirty: boolean; // not yet saved to Firestore
}

interface UseIdeFilesOptions {
  projectId: string;
}

interface UseIdeFilesResult {
  files: IdeFile[];
  activeFile: IdeFile;
  activeFileId: string;
  setActiveFileId: (id: string) => void;

  createFile: (path: string, template?: string) => Promise<void>;
  renameFile: (id: string, newPath: string) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;

  updateFileContent: (id: string, content: string) => void;

  isLoading: boolean;
  error: string | null;
}

const DEFAULT_FILES: IdeFileRecord[] = [
  {
    path: "index.ts",
    languageId: "typescript",
    content: `// Welcome to F0 Live Cloud IDE!
// Phase 84.9.3 — Firestore Persistence

function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log('Fibonacci(10):', fibonacci(10));

// Files are now saved in Firestore 🚀
`,
    updatedAt: Date.now(),
  },
  {
    path: "utils.ts",
    languageId: "typescript",
    content: `// utils.ts
// Helper utilities (saved in Firestore)

export function greet(name: string) {
  return \`Hello, \${name}!\`;
}
`,
    updatedAt: Date.now(),
  },
  {
    path: "README.md",
    languageId: "markdown",
    content: `# F0 Live Cloud IDE

This project is powered by Phase 84.9.3.

- Files are stored in Firestore
- Auto-save runs every few seconds
- Web IDE is now persistent ✅
`,
    updatedAt: Date.now(),
  },
];

function detectLanguageId(path: string): string {
  if (path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js")) return "javascript";
  if (path.endsWith(".jsx")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  return "plaintext";
}

export function useIdeFiles(
  options: UseIdeFilesOptions
): UseIdeFilesResult {
  const { projectId } = options;
  const [files, setFiles] = useState<IdeFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>("index.ts");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef<boolean>(true);

  // Load files from Firestore on first mount
  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        console.log('[IDE Files] Loading files from Firestore...');
        const loaded = await loadProjectFiles(projectId);

        let baseFiles: IdeFileRecord[];

        if (loaded.length === 0) {
          console.log('[IDE Files] No files found, creating defaults...');
          // No files yet -> create defaults
          baseFiles = DEFAULT_FILES;
          await Promise.all(
            baseFiles.map((f) => saveProjectFile(projectId, f))
          );
          console.log('[IDE Files] Default files created');
        } else {
          console.log(`[IDE Files] Loaded ${loaded.length} files from Firestore`);
          baseFiles = loaded;
        }

        if (cancelled) return;

        const ideFiles: IdeFile[] = baseFiles.map((f) => ({
          ...f,
          id: f.path,
          isDirty: false,
        }));

        setFiles(ideFiles);
        setActiveFileId(baseFiles[0]?.path ?? "index.ts");
      } catch (err: any) {
        console.error("[IDE Files] Failed to load files", err);
        if (!cancelled) setError(err?.message ?? "Failed to load project files");
      } finally {
        if (!cancelled) setIsLoading(false);
        isInitialLoadRef.current = false;
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Auto-save dirty files to Firestore (debounced)
  useEffect(() => {
    if (!projectId) return;
    if (isInitialLoadRef.current) return;

    const dirtyFiles = files.filter((f) => f.isDirty);
    if (dirtyFiles.length === 0) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    console.log(`[IDE Files] Auto-save scheduled for ${dirtyFiles.length} file(s)...`);

    saveTimerRef.current = setTimeout(async () => {
      try {
        console.log(`[IDE Files] Auto-saving ${dirtyFiles.length} file(s)...`);
        await Promise.all(
          dirtyFiles.map((f) =>
            saveProjectFile(projectId, {
              path: f.path,
              languageId: f.languageId,
              content: f.content,
              updatedAt: Date.now(),
            })
          )
        );

        console.log('[IDE Files] Auto-save complete ✅');

        // Clear dirty flags
        setFiles((prev) =>
          prev.map((f) =>
            f.isDirty ? { ...f, isDirty: false } : f
          )
        );
      } catch (err) {
        console.error("[IDE Files] auto-save failed", err);
      }
    }, 2000); // 2s debounce

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [files, projectId]);

  const activeFile =
    files.find((f) => f.id === activeFileId) ??
    files[0] ??
    ({
      id: "index.ts",
      path: "index.ts",
      content: "",
      languageId: "plaintext",
      updatedAt: Date.now(),
      isDirty: false,
    } as IdeFile);

  // --- Mutators -------------------------------------------------------------

  const updateFileContent = (id: string, content: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, content, isDirty: true } : f
      )
    );
  };

  const createFile = async (path: string, template?: string) => {
    const trimmed = path.trim();
    if (!trimmed) return;

    const exists = files.some((f) => f.path === trimmed);
    if (exists) {
      throw new Error("File already exists");
    }

    const record: IdeFileRecord = {
      path: trimmed,
      languageId: detectLanguageId(trimmed),
      content:
        template ??
        `// ${trimmed}\n// Created from F0 Live Cloud IDE (Phase 84.9.3)\n`,
      updatedAt: Date.now(),
    };

    console.log(`[IDE Files] Creating file: ${trimmed}`);

    // Optimistic update
    setFiles((prev) => [
      ...prev,
      {
        ...record,
        id: record.path,
        isDirty: false,
      },
    ]);
    setActiveFileId(record.path);

    try {
      await saveProjectFile(projectId, record);
      console.log(`[IDE Files] File created and saved: ${trimmed}`);
    } catch (err) {
      console.error("[IDE Files] Failed to create file", err);
      setError("Failed to create file");
    }
  };

  const renameFile = async (id: string, newPath: string) => {
    const trimmed = newPath.trim();
    if (!trimmed || trimmed === id) return;

    const existing = files.find((f) => f.id === id);
    if (!existing) return;

    const newRecord: IdeFileRecord = {
      path: trimmed,
      languageId: detectLanguageId(trimmed),
      content: existing.content,
      updatedAt: Date.now(),
    };

    console.log(`[IDE Files] Renaming file: ${id} → ${trimmed}`);

    // Optimistic state update
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              path: trimmed,
              id: trimmed,
              languageId: newRecord.languageId,
              isDirty: false,
            }
          : f
      )
    );
    setActiveFileId(trimmed);

    try {
      await saveProjectFile(projectId, newRecord);
      await deleteProjectFile(projectId, existing.path);
      console.log(`[IDE Files] File renamed: ${id} → ${trimmed}`);
    } catch (err) {
      console.error("[IDE Files] Failed to rename file", err);
      setError("Failed to rename file");
    }
  };

  const deleteFile = async (id: string) => {
    const existing = files.find((f) => f.id === id);
    if (!existing) return;

    // Prevent deleting last file
    if (files.length === 1) {
      setError("Cannot delete the last file");
      return;
    }

    console.log(`[IDE Files] Deleting file: ${id}`);

    // Optimistic removal
    setFiles((prev) => prev.filter((f) => f.id !== id));

    // Pick a new active file if needed
    if (activeFileId === id) {
      const remaining = files.filter((f) => f.id !== id);
      setActiveFileId(remaining[0]?.id ?? "index.ts");
    }

    try {
      await deleteProjectFile(projectId, existing.path);
      console.log(`[IDE Files] File deleted: ${id}`);
    } catch (err) {
      console.error("[IDE Files] Failed to delete file", err);
      setError("Failed to delete file");
    }
  };

  return {
    files,
    activeFile,
    activeFileId,
    setActiveFileId,

    createFile,
    renameFile,
    deleteFile,
    updateFileContent,

    isLoading,
    error,
  };
}
