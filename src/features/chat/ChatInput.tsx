'use client';
import React, { useRef, useState, useEffect } from 'react';

export default function ChatInput({ onSend }: { onSend: (v: string) => Promise<void> }) {
  const [v, setV] = useState('');
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!ta.current) return;
    ta.current.style.height = '0px';
    const h = Math.min(ta.current.scrollHeight, 240); // أقصى ارتفاع = 6~8 أسطر
    ta.current.style.height = h + 'px';
  }, [v]);

  async function handleSend() {
    const text = v.trim();
    if (!text) return;
    setV('');
    await onSend(text);
    // Scroll لآخر سطر — نفّذه في الحاوية الأم
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex gap-2 items-end p-2 border-t border-white/10">
      <textarea
        ref={ta}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={onKey}
        placeholder="اكتب رسالتك…"
        className="flex-1 resize-none rounded-xl bg-white/5 p-3 outline-none"
        rows={1}
      />
      <button onClick={handleSend} className="px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-indigo-500">
        Send
      </button>
    </div>
  );
}
