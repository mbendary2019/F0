// src/lib/fs/buildFileTree.ts
// =============================================================================
// Phase 151.1.0 – File Tree Builder
// Converts flat file list to nested tree structure for Web IDE file explorer
// =============================================================================

/**
 * File tree node representing a file or folder
 */
export type FileTreeNode = {
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileTreeMap;
};

/**
 * Map of file tree nodes keyed by name
 */
export type FileTreeMap = {
  [key: string]: FileTreeNode;
};

/**
 * Input file type - only requires relativePath
 */
export interface FileInput {
  relativePath: string;
}

/**
 * Build a nested file tree from a flat list of files
 *
 * @param files - Array of files with relativePath property
 * @returns FileTreeMap - Nested tree structure
 *
 * @example
 * ```ts
 * const files = [
 *   { relativePath: 'src/index.ts' },
 *   { relativePath: 'src/utils/helper.ts' },
 *   { relativePath: 'package.json' }
 * ];
 *
 * const tree = buildFileTree(files);
 * // Result:
 * // {
 * //   src: {
 * //     name: 'src',
 * //     path: 'src',
 * //     isFolder: true,
 * //     children: {
 * //       'index.ts': { name: 'index.ts', path: 'src/index.ts', isFolder: false },
 * //       utils: {
 * //         name: 'utils',
 * //         path: 'src/utils',
 * //         isFolder: true,
 * //         children: {
 * //           'helper.ts': { name: 'helper.ts', path: 'src/utils/helper.ts', isFolder: false }
 * //         }
 * //       }
 * //     }
 * //   },
 * //   'package.json': { name: 'package.json', path: 'package.json', isFolder: false }
 * // }
 * ```
 */
export function buildFileTree(files: FileInput[]): FileTreeMap {
  const root: FileTreeMap = {};

  for (const file of files) {
    // Skip empty paths
    if (!file.relativePath) continue;

    // Normalize path: remove leading/trailing slashes
    const normalizedPath = file.relativePath.replace(/^\/+|\/+$/g, '');
    if (!normalizedPath) continue;

    const parts = normalizedPath.split('/');
    let current = root;

    parts.forEach((part, idx) => {
      const isFolder = idx < parts.length - 1;
      const currentPath = parts.slice(0, idx + 1).join('/');

      if (!current[part]) {
        current[part] = {
          name: part,
          path: currentPath,
          isFolder,
          children: isFolder ? {} : undefined,
        };
      } else if (isFolder && !current[part].children) {
        // Edge case: file was added before folder, convert to folder
        current[part].isFolder = true;
        current[part].children = {};
      }

      if (isFolder) {
        current = current[part].children!;
      }
    });
  }

  return root;
}

export default buildFileTree;
