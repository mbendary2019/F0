'use client';
import { useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { upsertPhase, upsertTask } from '@/lib/tasks';
import { phaseKey } from '@/lib/ids';
import { usePathname } from 'next/navigation';
import { trackMessageSent, trackProjectCreated } from '@/lib/trackEvent';

const AUTO_THRESHOLD = 0.75; // Only auto-execute with high confidence or explicit command

export function useChatAgent(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();
  const locale = pathname?.startsWith('/en') ? 'en' : 'ar'; // Extract locale from pathname

  async function send(text: string) {
    setError(null);

    // Validate projectId
    if (!projectId) {
      setError('projectId is missing');
      return;
    }

    // Validate text and add locale
    const body = { projectId, text: text?.trim?.() || '', locale };
    if (!body.text) return;

    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-lang': locale, // Send language in header for priority
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || `Request failed (${res.status})`);
        return;
      }

      // Extract metadata
      const meta = data?.meta;
      const plan = data?.plan;

      // 1) Sync plan to Firestore when ready=true using deterministic IDs with transactions
      if (meta?.ready && plan?.phases?.length) {
        // Use upsert functions to prevent duplicates with transaction guarantees
        for (const [index, phase] of plan.phases.entries()) {
          // Upsert phase (creates or updates without overwriting user changes)
          const pKey = await upsertPhase({
            projectId,
            title: phase.title,
            order: index + 1,
            status: 'pending',
            locale,
          });

          // Upsert tasks for this phase
          const tasks = phase.tasks || [];
          for (const task of tasks) {
            const taskTitle = typeof task === 'string' ? task : task.title;
            const taskDesc = typeof task === 'object' ? task.desc : '';
            const taskTags = typeof task === 'object' ? task.tags : [];

            await upsertTask({
              projectId,
              phaseKey: pKey,
              title: taskTitle,
              description: taskDesc || '',
              tags: taskTags || [],
              status: 'todo',
              source: {
                type: 'agent',
                messageId: crypto.randomUUID(),
              },
            });
          }
        }

        console.log(`✅ Plan synced to Firestore with ${plan.phases.length} phases`);

        // Track message sent event (analytics)
        trackMessageSent(projectId, {
          phaseCount: plan.phases.length,
          ready: meta.ready,
          intent: meta.intent,
        });
      }

      // 2) Auto-execute workflow if user says execute command
      const executeCommand = /^(نفذ|نفّذ|ابدأ|execute|run)$/i;
      const saidExecute = executeCommand.test(text.trim());

      if (saidExecute || meta?.intent === 'execute') {
        // Step 1: Run preflight check first
        const preflightRes = await fetch('/api/preflight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        });

        const preflightData = await preflightRes.json();

        // Step 2: If preflight fails, show error and stop
        if (!preflightData.ready) {
          setError(
            preflightData.message ||
            `🚫 لا يمكن التنفيذ:\n${(preflightData.issues || []).map((i: string) => `• ${i}`).join('\n')}\n\n**الحل:** افتح .env.local وأضف المفاتيح الناقصة، ثم أعد تشغيل السيرفر.`
          );
          return data; // Return plan data but don't execute
        }

        // Step 3: Preflight passed - proceed with execution
        console.log('✅ Preflight passed - starting execution');

        // TODO: Implement ordered task execution
        // For now, just return success message
        return {
          ...data,
          message: {
            ...data.message,
            text: `${data.message.text}\n\n✅ Preflight checks passed!\n📋 Plan synced to Firestore\n🚀 Ready for execution (Task runner implementation pending)`
          }
        };
      }

      // Success - return data for UI
      return data;
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return { send, loading, error };
}
