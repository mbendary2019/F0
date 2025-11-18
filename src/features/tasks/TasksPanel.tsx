'use client';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useEffect, useState } from 'react';

export default function TasksPanel({ projectId }: { projectId: string }) {
  const [phases, setPhases] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, `projects/${projectId}/phases`), s => {
      setPhases(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.order - b.order));
    });
    const unsub2 = onSnapshot(collection(db, `projects/${projectId}/tasks`), s => {
      setTasks(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, [projectId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--panel-fg)' }}>
          Tasks by Phase
        </h2>
      </div>
      {phases.map(ph => {
        const list = tasks.filter(t => t.phaseId === ph.id);
        const done = list.filter(t => t.status === 'done').length;
        const prog = list.length ? Math.round(100 * done / list.length) : 0;

        return (
          <div
            key={ph.id}
            className="rounded-xl p-3 border"
            style={{ borderColor: 'var(--card-bdr)', background: 'var(--card-bg)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium" style={{ color: 'var(--panel-fg)' }}>
                {ph.title}
              </div>
              <div className="text-sm opacity-70">{prog}%</div>
            </div>
            <div className="space-y-2">
              {list.map(t => (
                <div key={t.id} className="text-sm flex items-start gap-2">
                  <input
                    type="checkbox"
                    defaultChecked={t.status === 'done'}
                    onChange={async (e) => {
                      await updateDoc(doc(db, `projects/${projectId}/tasks/${t.id}`), {
                        status: e.target.checked ? 'done' : 'open',
                        updatedAt: Date.now()
                      });
                    }}
                    className="mt-1"
                  />
                  <div style={{ color: 'var(--panel-fg)' }}>
                    <div className="font-medium">{t.title}</div>
                    {t.desc && <div className="opacity-70 text-xs mt-1">{t.desc}</div>}
                  </div>
                </div>
              ))}
              {!list.length && (
                <div className="text-sm opacity-60" style={{ color: 'var(--panel-fg)' }}>
                  لا توجد مهام بعد.
                </div>
              )}
            </div>
          </div>
        );
      })}
      {!phases.length && (
        <div className="opacity-60 text-sm text-center py-8" style={{ color: 'var(--panel-fg)' }}>
          لم يتم إنشاء مراحل بعد. ابدأ بالدردشة مع الوكيل!
        </div>
      )}
    </div>
  );
}
