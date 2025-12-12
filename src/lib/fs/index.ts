// src/lib/fs/index.ts
// =============================================================================
// Phase 151.1 – File System Utilities
// Exports for file tree building and sorting
// =============================================================================

export {
  buildFileTree,
  type FileTreeNode,
  type FileTreeMap,
  type FileInput,
} from './buildFileTree';

export {
  sortFileTree,
  flattenTree,
  type SortedFileTreeNode,
  type FlatFileNode,
} from './sortFileTree';
