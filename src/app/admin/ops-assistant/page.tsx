/**
 * Ops Assistant Page
 * Autonomous AI Assistant for Operations Management
 * With Voice Recognition & LLM Integration
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { startRecognition, isSpeechRecognitionSupported } from '@/lib/voice/recognition';
import { speak, isSpeechSynthesisSupported } from '@/lib/voice/speak';

type Job = {
  id: string;
  kind: string;
  status: string;
  result?: any;
  createdAt: number;
};

export default function OpsAssistantPage() {
  const [query, setQuery] = useState('Summarize system health and propose actions');
  const [answer, setAnswer] = useState<string>('');
  const [log, setLog] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const busy = useRef(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    loadRecentJobs();
  }, []);

  async function loadRecentJobs() {
    try {
      const res = await fetch('/api/admin/agents/jobs', { cache: 'no-store' });
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      console.error('[OpsAssistant] Failed to load jobs:', err);
    }
  }

  async function ask(question = query) {
    if (busy.current || !question.trim()) return;
    
    busy.current = true;
    setLoading(true);
    setLog((prev) => [`> ${question}`, ...prev]);

    try {
      // Create predict/report job
      const createRes = await fetch('/api/admin/agents/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'predict',
          payload: { question }
        })
      });

      if (!createRes.ok) {
        throw new Error('Failed to create job');
      }

      const { id } = await createRes.json();
      setLog((prev) => [`✓ Job created: ${id}`, ...prev]);

      // Poll for result
      setTimeout(async () => {
        await loadRecentJobs();
        
        const jobsRes = await fetch('/api/admin/agents/jobs');
        const jobsData = await jobsRes.json();
        const completedJob = jobsData.jobs?.find((j: Job) => j.id === id && j.status === 'done');

        if (completedJob?.result) {
          const { summary, confidence, suggestions } = completedJob.result;
          const response = [
            `🤖 ${summary}`,
            ``,
            `🎯 Confidence: ${(confidence * 100).toFixed(0)}%`,
            ``,
            `💡 Recommendations:`,
            ...(suggestions || []).map((s: string) => `  • ${s}`)
          ].join('\n');
          
          setAnswer(summary);
          setLog((prev) => [response, ...prev]);
          
          // Speak the answer (if supported)
          if (isSpeechSynthesisSupported()) {
            speak(summary);
          }
        } else {
          setLog((prev) => [`⏳ Job queued, check back in a moment...`, ...prev]);
        }

        busy.current = false;
        setLoading(false);
      }, 1600);

    } catch (err) {
      console.error('[OpsAssistant] Error:', err);
      setLog((prev) => [`❌ Error: ${err}`, ...prev]);
      busy.current = false;
      setLoading(false);
    }
  }

  function toggleMic() {
    if (recording) {
      recRef.current?.stop?.();
      setRecording(false);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setLog((prev) => ['❌ Speech recognition not supported in this browser. Try Chrome.', ...prev]);
      return;
    }

    try {
      recRef.current = startRecognition((text, isFinal) => {
        setQuery(isFinal ? text : text + ' …');
        if (isFinal) {
          ask(text);
          setRecording(false);
        }
      });
      setRecording(true);
      setLog((prev) => ['🎤 Listening...', ...prev]);
    } catch (err) {
      console.error('[OpsAssistant] Mic error:', err);
      setLog((prev) => [`❌ Mic error: ${err}`, ...prev]);
      setRecording(false);
    }
  }

  async function feedback(vote: 'up' | 'down') {
    if (!answer) return;

    try {
      await fetch('/api/admin/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote, question: query, answer })
      });
      setLog((prev) => [`✓ Feedback (${vote === 'up' ? '👍' : '👎'}) saved`, ...prev]);
    } catch (err) {
      console.error('[OpsAssistant] Feedback error:', err);
    }
  }

  async function oneClickAction(action: string, target?: string) {
    setLog((prev) => [`> Triggering: ${action}${target ? ':' + target : ''}`, ...prev]);

    try {
      const res = await fetch('/api/admin/agents/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'remediate',
          payload: {
            action,
            target: target || null,
            actorUid: 'admin-ui'
          }
        })
      });

      if (res.ok) {
        const { id } = await res.json();
        setLog((prev) => [`✓ Remediation job queued: ${id}`, ...prev]);
        await loadRecentJobs();
      } else {
        setLog((prev) => [`❌ Failed to queue remediation`, ...prev]);
      }
    } catch (err) {
      console.error('[OpsAssistant] Error:', err);
      setLog((prev) => [`❌ Error: ${err}`, ...prev]);
    }
  }


  return (
    <main className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ops Assistant</h1>
          <p className="text-sm opacity-70 mt-1">
            Autonomous AI agent for operations management
          </p>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link href="/admin/ops-copilot" className="underline">
            Copilot
          </Link>
          <Link href="/admin/insights" className="underline">
            Insights
          </Link>
          <Link href="/admin/dashboard" className="underline">
            Dashboard
          </Link>
        </nav>
      </header>

      {/* Query Input */}
      <div className="rounded-2xl border p-4 space-y-3">
        <textarea
          className="w-full border rounded-lg p-3 min-h-28 resize-none"
          placeholder="Ask for analysis, predictions, or request actions... (or click mic 🎤)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={loading || recording}
        />
        
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => ask()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={loading || recording || !query.trim()}
          >
            {loading ? 'Processing...' : 'Ask Agent'}
          </button>

          <button
            onClick={toggleMic}
            className={`px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm ${
              recording ? 'bg-red-500/10 border-red-500' : ''
            }`}
            disabled={loading}
            title={isSpeechRecognitionSupported() ? 'Voice input' : 'Not supported in this browser'}
          >
            {recording ? '⏹️ Stop' : '🎤 Mic'}
          </button>
          
          <div className="border-l pl-2 flex gap-2 flex-wrap">
            <button
              onClick={() => oneClickAction('restart_function', 'workerA')}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm"
              disabled={loading}
            >
              🔄 Restart workerA
            </button>
            
            <button
              onClick={() => oneClickAction('disable_endpoint', '/api/heavy')}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm"
              disabled={loading}
            >
              🚫 Disable /api/heavy
            </button>
            
            <button
              onClick={() => oneClickAction('reduce_rate', 'main_api')}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm"
              disabled={loading}
            >
              ⬇️ Reduce Rate
            </button>
          </div>

          {/* Feedback buttons */}
          {answer && (
            <div className="ml-auto flex gap-2 items-center">
              <span className="text-xs opacity-60">Rate answer:</span>
              <button
                onClick={() => feedback('up')}
                className="px-3 py-2 rounded-lg border hover:bg-green-50 text-sm"
                title="Good answer"
              >
                👍
              </button>
              <button
                onClick={() => feedback('down')}
                className="px-3 py-2 rounded-lg border hover:bg-red-50 text-sm"
                title="Bad answer"
              >
                👎
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Log Output */}
      <div className="rounded-2xl border p-4 min-h-64 max-h-96 overflow-y-auto">
        <h3 className="font-medium mb-3 text-sm opacity-70">Activity Log</h3>
        {log.length === 0 ? (
          <div className="text-center py-8 opacity-60">
            <div className="text-4xl mb-2">🤖</div>
            <p>Ask questions or trigger actions to see activity here</p>
          </div>
        ) : (
          <pre className="text-sm whitespace-pre-wrap font-mono">
            {log.join('\n\n')}
          </pre>
        )}
      </div>

      {/* Recent Jobs */}
      <div className="rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm">Recent Agent Jobs</h3>
          <button
            onClick={loadRecentJobs}
            className="text-xs underline opacity-70 hover:opacity-100"
          >
            Refresh
          </button>
        </div>
        
        <div className="space-y-2">
          {jobs.slice(0, 10).map((job) => (
            <div
              key={job.id}
              className="flex items-center justify-between p-2 rounded-lg border text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs opacity-60">
                  {job.id.slice(0, 8)}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs">
                  {job.kind}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  job.status === 'done' ? 'bg-green-100 text-green-800' :
                  job.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {job.status}
                </span>
              </div>
              <span className="text-xs opacity-60">
                {new Date(job.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
          {jobs.length === 0 && (
            <div className="text-center py-4 opacity-60 text-sm">
              No jobs yet
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

