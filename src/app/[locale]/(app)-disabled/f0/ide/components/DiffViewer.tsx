// src/app/[locale]/f0/ide/components/DiffViewer.tsx
"use client";

import dynamic from "next/dynamic";

const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.DiffEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64 text-gray-300">
        Loading diff viewer...
      </div>
    ),
  }
);

interface DiffViewerProps {
  filePath: string;
  original: string;
  modified: string;
  onApply: () => void;
  onCancel: () => void;
}

export function DiffViewer(props: DiffViewerProps) {
  const { filePath, original, modified, onApply, onCancel } = props;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[90vw] h-[80vh] flex flex-col">
        {/* Header */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-gray-700">
          <div>
            <div className="text-sm text-gray-400">Review AI Patch</div>
            <div className="text-sm text-gray-200 font-mono">{filePath}</div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Diff Editor */}
        <div className="flex-1">
          <DiffEditor
            original={original}
            modified={modified}
            language={detectLanguageFromPath(filePath)}
            theme="vs-dark"
            options={{
              renderSideBySide: true,
              readOnly: true,
              minimap: { enabled: false },
            }}
          />
        </div>

        {/* Actions */}
        <div className="h-14 border-t border-gray-700 flex items-center justify-end gap-3 px-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
          >
            Apply Patch
          </button>
        </div>
      </div>
    </div>
  );
}

function detectLanguageFromPath(path: string): string {
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".swift")) return "swift";
  return "plaintext";
}
