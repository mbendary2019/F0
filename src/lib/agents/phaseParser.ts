import type { Phase, Task } from '@/types/project';

export function extractPhasesFromText(text: string): Phase[] {
  // يلتقط أسطر تبدأ بـ 1) 2) أو - [Phase]
  const lines = text.split('\n');
  const found: Phase[] = [];
  let order = 1;
  for (const ln of lines) {
    const m = ln.match(/^\s*(?:\d+\)|-\s*\[?phase\]?)\s*(.+)$/i);
    if (m) {
      found.push({
        id: crypto.randomUUID(),
        title: m[1].trim(),
        order: order++,
        status: 'open',
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }
  // fallback: لو مفيش، أنشئ Phase عامة
  if (!found.length) {
    found.push({
      id: crypto.randomUUID(),
      title: 'Phase 1 — Planning',
      order: 1,
      status: 'open',
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  return found;
}

export function draftTasksForPhase(phaseId: string, text: string): Task[] {
  // أي سطر يبدأ بـ • أو - يعتبر مهمة
  const tasks: Task[] = [];
  const lines = text.split('\n');
  for (const ln of lines) {
    const m = ln.match(/^\s*[•\-]\s+(.+)$/);
    if (m) {
      tasks.push({
        id: crypto.randomUUID(),
        phaseId,
        title: m[1].trim(),
        status: 'open',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'agent',
      });
    }
  }
  // fallback مهمة عامة
  if (!tasks.length) {
    tasks.push({
      id: crypto.randomUUID(),
      phaseId,
      title: 'Review agent summary and confirm scope',
      status: 'open',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'agent',
    });
  }
  return tasks;
}
