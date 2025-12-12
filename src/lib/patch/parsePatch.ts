// src/lib/patch/parsePatch.ts

export interface FilePatch {
  filePath: string;
  diff: string; // unified diff text for that file
}

/**
 * Try to normalize whatever the AI returns into a list of FilePatch objects.
 *
 * Supports:
 * 1) JSON with { filePath, diff } or { filePath, unifiedDiff }
 * 2) JSON with { patches: [...] }
 * 3) Pure unified diff text (fallback to current filePath)
 */
export function parseAiPatch(
  raw: string,
  fallbackFilePath: string
): FilePatch[] {
  // 1) Try JSON first
  try {
    const json = JSON.parse(raw);

    // Case: { filePath, diff }
    if (json.filePath && (json.diff || json.unifiedDiff || json.patch)) {
      return [
        {
          filePath: json.filePath,
          diff: json.diff ?? json.unifiedDiff ?? json.patch,
        },
      ];
    }

    // Case: { patches: [...] }
    if (Array.isArray(json.patches)) {
      return json.patches
        .map((p: any) => {
          if (!p.filePath) return null;
          const diff = p.diff ?? p.unifiedDiff ?? p.patch;
          if (!diff) return null;
          return {
            filePath: String(p.filePath),
            diff: String(diff),
          } as FilePatch;
        })
        .filter(Boolean) as FilePatch[];
    }

    // Case: { files: [...] }
    if (Array.isArray(json.files)) {
      return json.files
        .map((f: any) => {
          if (!f.path) return null;
          const diff = f.diff ?? f.unifiedDiff ?? f.patch;
          if (!diff) return null;
          return {
            filePath: String(f.path),
            diff: String(diff),
          } as FilePatch;
        })
        .filter(Boolean) as FilePatch[];
    }
  } catch {
    // not JSON – continue to unified diff fallback
  }

  // 2) Fallback: treat entire raw as unified diff for the current file
  return [
    {
      filePath: fallbackFilePath,
      diff: raw,
    },
  ];
}
