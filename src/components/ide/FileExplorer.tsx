// src/components/ide/FileExplorer.tsx
// =============================================================================
// Phase 151.2 – Web IDE File Explorer
// VS Code-style sidebar with folder tree, expand/collapse, and file selection
// =============================================================================
'use client';

import { useMemo, useState, useEffect, type MouseEvent } from 'react';
import {
  buildFileTree,
  sortFileTree,
  flattenTree,
  type FileInput,
  type FlatFileNode,
} from '@/lib/fs';
import { cn } from '@/lib/utils';

type IssuesMap = Record<string, { errors: number; warnings: number }>;

export type FileExplorerProps = {
  files: FileInput[];
  selectedPath?: string | null;
  onSelect: (path: string) => void;
  issuesByFile?: IssuesMap;
  locale?: 'en' | 'ar';
};

export function FileExplorer({
  files,
  selectedPath,
  onSelect,
  issuesByFile,
  locale = 'en',
}: FileExplorerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Default expanded folders: src, src/app
    return new Set(['src', 'src/app']);
  });

  // Log file count on load
  useEffect(() => {
    if (files && files.length > 0) {
      console.log('[151.2][WEB][FILES] Loaded', files.length, 'files');
    }
  }, [files]);

  // Build tree -> sort -> flatten
  const flatNodes: FlatFileNode[] = useMemo(() => {
    if (!files || files.length === 0) return [];
    const tree = buildFileTree(files);
    const sorted = sortFileTree(tree);
    return flattenTree(sorted, 0, expanded);
  }, [files, expanded]);

  const toggleFolder = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleItemClick = (node: FlatFileNode, e: MouseEvent) => {
    e.stopPropagation();
    if (node.isFolder) {
      toggleFolder(node.path);
    } else {
      onSelect(node.path);
    }
  };

  const isRtl = locale === 'ar';

  return (
    <aside
      className={cn(
        'h-full w-64 bg-[#050415] border-r border-white/10 text-xs text-white/80 select-none flex flex-col',
        isRtl ? 'direction-rtl' : 'direction-ltr'
      )}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-white/10 flex items-center justify-between shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
          {isRtl ? 'ملفات المشروع' : 'PROJECT FILES'}
        </span>
        <span className="text-[10px] text-white/40">
          {files?.length ?? 0} {isRtl ? 'ملف' : 'files'}
        </span>
      </div>

      {/* File List */}
      <div className="overflow-auto flex-1 py-1">
        {flatNodes.map((node) => (
          <FileExplorerRow
            key={node.path}
            node={node}
            selected={node.path === selectedPath}
            onClick={handleItemClick}
            issues={issuesByFile?.[node.path]}
            isRtl={isRtl}
          />
        ))}

        {flatNodes.length === 0 && (
          <div className="px-3 py-4 text-[11px] text-white/40 leading-relaxed">
            {isRtl
              ? 'لا توجد ملفات متاحة بعد. تأكد من فتح المشروع في نسخة الـ Desktop.'
              : 'No files available yet. Make sure the project is open in the Desktop IDE.'}
          </div>
        )}
      </div>
    </aside>
  );
}

// =============================================================================
// FileExplorerRow - Individual row for file/folder
// =============================================================================
type FileExplorerRowProps = {
  node: FlatFileNode;
  selected: boolean;
  onClick: (node: FlatFileNode, e: MouseEvent) => void;
  issues?: { errors: number; warnings: number };
  isRtl: boolean;
};

function FileExplorerRow({
  node,
  selected,
  onClick,
  issues,
  isRtl,
}: FileExplorerRowProps) {
  const hasIssues = issues && (issues.errors > 0 || issues.warnings > 0);
  const paddingInline = 8 + node.depth * 12; // indentation

  const ext = getFileExtension(node.name);
  const icon = node.isFolder ? getFolderIcon(node.isExpanded, isRtl) : getFileIcon(ext);

  return (
    <button
      type="button"
      onClick={(e) => onClick(node, e)}
      className={cn(
        'w-full flex items-center gap-1.5 text-[11px] py-1.5 pr-2 rounded-md',
        'hover:bg-white/5 transition-colors',
        selected && 'bg-purple-600/30 text-white'
      )}
      style={
        isRtl
          ? { paddingRight: paddingInline }
          : { paddingLeft: paddingInline }
      }
    >
      {/* Folder/File icon */}
      <span className="w-4 flex items-center justify-center text-white/60 shrink-0">
        {icon}
      </span>

      {/* Name */}
      <span className={cn('truncate flex-1', isRtl ? 'text-right' : 'text-left')}>
        {node.name}
      </span>

      {/* Issues pill */}
      {hasIssues && (
        <span className="shrink-0 text-[9px] rounded-full px-1.5 py-0.5 bg-red-500/20 text-red-200">
          {issues.errors > 0 && <span>{issues.errors}e</span>}
          {issues.warnings > 0 && (
            <span className="ml-0.5">{issues.warnings}w</span>
          )}
        </span>
      )}
    </button>
  );
}

// =============================================================================
// Helper functions
// =============================================================================
function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx === -1) return '';
  return name.slice(idx + 1).toLowerCase();
}

function getFileIcon(ext: string): JSX.Element {
  switch (ext) {
    case 'tsx':
      return <span className="text-sky-400 text-[9px] font-bold">TSX</span>;
    case 'ts':
      return <span className="text-sky-300 text-[9px] font-bold">TS</span>;
    case 'jsx':
      return <span className="text-yellow-300 text-[9px] font-bold">JSX</span>;
    case 'js':
      return <span className="text-yellow-400 text-[9px] font-bold">JS</span>;
    case 'json':
      return <span className="text-emerald-300 text-[9px]">{'{}'}</span>;
    case 'css':
    case 'scss':
    case 'sass':
      return <span className="text-pink-300 text-[9px]">#</span>;
    case 'md':
    case 'mdx':
      return <span className="text-white/60 text-[9px]">M</span>;
    case 'html':
      return <span className="text-orange-300 text-[9px]">&lt;&gt;</span>;
    case 'svg':
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return <span className="text-purple-300 text-[9px]">IMG</span>;
    default:
      return <span className="text-white/40 text-[9px]">*</span>;
  }
}

function getFolderIcon(isExpanded: boolean, isRtl: boolean): JSX.Element {
  // Chevron: expanded = down, collapsed = right (or left for RTL)
  if (isExpanded) {
    return <span className="text-white/50 text-[10px]">&#9662;</span>; // ▾
  }
  // Collapsed
  if (isRtl) {
    return <span className="text-white/50 text-[10px]">&#9666;</span>; // ◂
  }
  return <span className="text-white/50 text-[10px]">&#9656;</span>; // ▸
}

export default FileExplorer;
