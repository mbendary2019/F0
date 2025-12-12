// src/lib/patch/applyPatch.ts

/**
 * Apply a unified diff to the original content.
 *
 * Supports typical hunks in the form:
 * @@ -start,len +start,len @@
 *  line context
 * -deleted
 * +added
 */
export function applyUnifiedDiff(original: string, diff: string): string {
  const origLines = original.split("\n");
  const newLines: string[] = [];

  let iOrig = 0;

  const lines = diff.split("\n");
  let inHunk = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip file headers
    if (line.startsWith("diff --git") || line.startsWith("--- ") || line.startsWith("+++ ")) {
      continue;
    }

    // Hunk header
    if (line.startsWith("@@")) {
      inHunk = true;

      // Parse "+start,len" from "@@ -a,b +c,d @@"
      const match = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (!match) {
        throw new Error("Invalid hunk header: " + line);
      }

      const startNew = parseInt(match[1], 10);

      // Flush unchanged part from original up to (startNew - 1)
      // Note: we trust diff structure, not startNew fully, but this is good enough for IDE use
      while (newLines.length < startNew - 1 && iOrig < origLines.length) {
        newLines.push(origLines[iOrig++]);
      }

      continue;
    }

    if (!inHunk) {
      // Ignore lines outside hunks
      continue;
    }

    if (line.startsWith(" ")) {
      // Context line
      newLines.push(line.slice(1));
      iOrig++;
    } else if (line.startsWith("-")) {
      // Deletion: skip original line
      iOrig++;
    } else if (line.startsWith("+")) {
      // Addition
      newLines.push(line.slice(1));
    } else if (line.trim() === "") {
      // Blank line inside hunk
      newLines.push("");
      iOrig++;
    } else {
      // Unexpected line – treat as context
      newLines.push(line);
      iOrig++;
    }
  }

  // Flush remaining original lines (if any)
  while (iOrig < origLines.length) {
    newLines.push(origLines[iOrig++]);
  }

  return newLines.join("\n");
}
