/**
 * Phase 53 Day 4 - Chat & Comments Thread
 * Inline comment button - appears above editor to capture a comment
 * bound to current selection
 */

'use client';

import { useState } from 'react';

export default function CommentPin({
  canComment,
  onSubmit,
}: {
  canComment: boolean;
  onSubmit: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  if (!canComment) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSubmit(text.trim());
      setText('');
      setOpen(false);
    }
  };

  return (
    <div className="absolute right-3 top-3 z-50">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 rounded-md border border-white/20 text-sm bg-neutral-950/70 backdrop-blur text-white hover:border-white/40 transition-colors"
        >
          Add comment
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="p-2 rounded-lg border border-white/20 bg-neutral-950/80 backdrop-blur w-72"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-md bg-neutral-900 border border-white/10 px-2 py-1.5 text-sm outline-none focus:border-white/30 text-white"
            placeholder="Leave a comment bound to selection…"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-2 py-1 text-xs rounded-md border border-white/20 text-white hover:border-white/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-2 py-1 text-xs rounded-md border border-white/20 text-white hover:border-white/40"
            >
              Save
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
