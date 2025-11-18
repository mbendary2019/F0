import type * as monacoNs from 'monaco-editor';

type Pos = { lineNumber: number; column: number };

export function toScreen(editor: monacoNs.editor.IStandaloneCodeEditor, pos: Pos) {
  const sc = editor.getScrolledVisiblePosition(pos);
  if (!sc) return null;
  const { top, left } = sc;
  const dom = editor.getDomNode();
  if (!dom) return null;
  const rect = dom.getBoundingClientRect();
  return { x: left + rect.left, y: top + rect.top };
}

export function toModel(editor: monacoNs.editor.IStandaloneCodeEditor, x: number, y: number) {
  const target = editor.getTargetAtClientPoint(x, y);
  const pos = target?.position;
  if (!pos) return null;
  return { line: pos.lineNumber, column: pos.column };
}

export function screenOfSelection(
  editor: monacoNs.editor.IStandaloneCodeEditor,
  from: Pos,
  to: Pos
) {
  // returns bounding box in client coords
  const a = toScreen(editor, from);
  const b = toScreen(editor, to);
  if (!a || !b) return null;

  // Get line height from editor options
  const lineHeight = editor.getOption(51 as any); // EditorOption.lineHeight

  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x) || 2,
    h: Math.abs(a.y - b.y) + (typeof lineHeight === 'number' ? lineHeight : 20),
  };
}
