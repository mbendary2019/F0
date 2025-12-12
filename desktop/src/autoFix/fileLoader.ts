// desktop/src/autoFix/fileLoader.ts
// Phase 144.1 – File Loader for Auto-Fix patches

export type FileContentSource = 'editor' | 'cache' | 'fs';

export interface LoadedFile {
  filePath: string; // absolute or project-relative path
  content: string;
  source: FileContentSource;
}

export interface FileLoaderDeps {
  // 1) من الـ editor (لو الملف مفتوح)
  getEditorContent?: (filePath: string) => string | null;

  // 2) من أي cache جوه Zustand / project state (اختياري)
  getCachedFileContent?: (filePath: string) => string | null;

  // 3) من الـ File System – **لازم تتوصّل**
  // مثال في preload.ts: window.f0Desktop.readFile(path)
  readFileFromFs: (filePath: string) => Promise<string | null>;
}

/**
 * Load file content for Auto-Fix patches.
 * Will try: editor → cache → file system.
 */
export async function loadFileForPatch(
  filePath: string,
  deps: FileLoaderDeps
): Promise<LoadedFile | null> {
  const { getEditorContent, getCachedFileContent, readFileFromFs } = deps;

  // 1) Editor
  if (getEditorContent) {
    const editorContent = getEditorContent(filePath);
    if (editorContent != null) {
      console.log('[FileLoader] Loaded from editor:', filePath);
      return {
        filePath,
        content: editorContent,
        source: 'editor',
      };
    }
  }

  // 2) Cache / project state
  if (getCachedFileContent) {
    const cached = getCachedFileContent(filePath);
    if (cached != null) {
      console.log('[FileLoader] Loaded from cache:', filePath);
      return {
        filePath,
        content: cached,
        source: 'cache',
      };
    }
  }

  // 3) File System (bridge من preload)
  try {
    const fsContent = await readFileFromFs(filePath);
    if (fsContent != null) {
      console.log('[FileLoader] Loaded from fs:', filePath);
      return {
        filePath,
        content: fsContent,
        source: 'fs',
      };
    }
  } catch (err) {
    console.warn('[FileLoader] Failed to read from FS', filePath, err);
  }

  console.warn('[FileLoader] No content found for file', filePath);
  return null;
}

/**
 * Batch load multiple files
 */
export async function loadFilesForPatch(
  filePaths: string[],
  deps: FileLoaderDeps
): Promise<Map<string, LoadedFile>> {
  const results = new Map<string, LoadedFile>();

  await Promise.all(
    filePaths.map(async (filePath) => {
      const loaded = await loadFileForPatch(filePath, deps);
      if (loaded) {
        results.set(filePath, loaded);
      }
    })
  );

  return results;
}
