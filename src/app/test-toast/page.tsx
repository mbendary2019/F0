// src/app/test-toast/page.tsx
'use client';

import { toast } from 'sonner';
import { useState } from 'react';

export default function TestToastPage() {
  const [logCount, setLogCount] = useState(0);

  const testSuccess = () => {
    toast.success('تم الحفظ بنجاح ✅', {
      description: 'تم حفظ البيانات في قاعدة البيانات',
      duration: 3000,
    });
  };

  const testError = () => {
    toast.error('حدث خطأ 😅', {
      description: 'حاول مرة أخرى بعد قليل',
      duration: 5000,
    });
  };

  const testWarning = () => {
    toast.warning('تحذير ⚠️', {
      description: 'يرجى التحقق من البيانات المدخلة',
    });
  };

  const testInfo = () => {
    toast.info('معلومة ℹ️', {
      description: 'هذه رسالة معلوماتية',
    });
  };

  const testLoading = () => {
    const id = toast.loading('جاري التحميل...', {
      description: 'يرجى الانتظار',
    });

    setTimeout(() => {
      toast.success('تم التحميل!', { id });
    }, 2000);
  };

  const testPromise = () => {
    const promise = new Promise((resolve) =>
      setTimeout(() => resolve({ data: 'Success!' }), 2000)
    );

    toast.promise(promise, {
      loading: 'جاري المعالجة...',
      success: 'تمت المعالجة بنجاح!',
      error: 'فشلت المعالجة',
    });
  };

  const sendLogError = async () => {
    try {
      setLogCount(prev => prev + 1);
      const response = await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          service: 'web',
          code: 500,
          message: `Test error from browser #${logCount + 1}`,
          context: { page: '/test-toast', timestamp: Date.now() },
        }),
      });

      const data = await response.json();

      if (data.ok) {
        toast.success('تم إرسال الخطأ!', {
          description: `Event ID: ${data.eventId?.slice(0, 8)}...`,
        });
      } else {
        toast.error('فشل الإرسال', {
          description: data.error || 'Unknown error',
        });
      }
    } catch (error) {
      toast.error('خطأ في الشبكة', {
        description: String(error),
      });
    }
  };

  const sendMultipleErrors = async () => {
    const count = 15;
    toast.info(`جاري إرسال ${count} خطأ...`, {
      description: 'لاختبار severity escalation',
    });

    let success = 0;
    for (let i = 0; i < count; i++) {
      try {
        const response = await fetch('/api/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: 'error',
            service: 'test',
            code: 500,
            message: `Spike test error ${i + 1}`,
            fingerprint: 'test-spike-toast',
          }),
        });

        if (response.ok) success++;
      } catch (e) {
        console.error('Failed to send error', e);
      }
    }

    toast.success(`تم إرسال ${success}/${count} خطأ!`, {
      description: 'افتح /ops/incidents لمشاهدة النتيجة',
      duration: 5000,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">🎯 Toast Testing Dashboard</h1>
          <p className="text-slate-300">
            اختبر جميع أنواع الـ Toast notifications من Sonner
          </p>
        </div>

        {/* Basic Toasts */}
        <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
          <h2 className="text-2xl font-semibold mb-4">📢 Basic Toasts</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={testSuccess}
              className="bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg transition"
            >
              ✅ Success
            </button>
            <button
              onClick={testError}
              className="bg-red-600 hover:bg-red-700 px-4 py-3 rounded-lg transition"
            >
              ❌ Error
            </button>
            <button
              onClick={testWarning}
              className="bg-yellow-600 hover:bg-yellow-700 px-4 py-3 rounded-lg transition"
            >
              ⚠️ Warning
            </button>
            <button
              onClick={testInfo}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded-lg transition"
            >
              ℹ️ Info
            </button>
          </div>
        </div>

        {/* Advanced Toasts */}
        <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
          <h2 className="text-2xl font-semibold mb-4">🚀 Advanced Toasts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={testLoading}
              className="bg-purple-600 hover:bg-purple-700 px-4 py-3 rounded-lg transition"
            >
              ⏳ Loading Toast
            </button>
            <button
              onClick={testPromise}
              className="bg-indigo-600 hover:bg-indigo-700 px-4 py-3 rounded-lg transition"
            >
              🔄 Promise Toast
            </button>
          </div>
        </div>

        {/* API Testing */}
        <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
          <h2 className="text-2xl font-semibold mb-4">📡 API Log Testing</h2>
          <div className="space-y-4">
            <button
              onClick={sendLogError}
              className="w-full bg-orange-600 hover:bg-orange-700 px-4 py-3 rounded-lg transition"
            >
              📝 Send Single Error to /api/log
            </button>
            <button
              onClick={sendMultipleErrors}
              className="w-full bg-pink-600 hover:bg-pink-700 px-4 py-3 rounded-lg transition"
            >
              ⚡ Send 15 Errors (Test Spike Detection)
            </button>
            {logCount > 0 && (
              <p className="text-center text-slate-400">
                Total errors sent: {logCount}
              </p>
            )}
          </div>
        </div>

        {/* Links */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-2xl font-semibold mb-4">🔗 Quick Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/ops/incidents"
              className="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-lg text-center transition"
            >
              📊 Incidents Dashboard
            </a>
            <a
              href="/ar/ops/incidents"
              className="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-lg text-center transition"
            >
              📊 لوحة الحوادث (AR)
            </a>
            <a
              href="/en/ops/incidents"
              className="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-lg text-center transition"
            >
              📊 Incidents (EN)
            </a>
          </div>
        </div>

        {/* Console Commands */}
        <div className="bg-slate-800 rounded-lg p-6 mt-6 border border-slate-700">
          <h2 className="text-2xl font-semibold mb-4">💻 Console Commands</h2>
          <p className="text-slate-400 mb-3">افتح Console (F12) وجرّب:</p>
          <div className="bg-slate-900 rounded p-4 font-mono text-sm space-y-3">
            <div>
              <p className="text-green-400 mb-1">// Success toast</p>
              <code className="text-cyan-300">
                {`import('sonner').then(({ toast }) => toast.success('✅ تم بنجاح'));`}
              </code>
            </div>
            <div>
              <p className="text-red-400 mb-1">// Error toast</p>
              <code className="text-cyan-300">
                {`import('sonner').then(({ toast }) => toast.error('❌ خطأ'));`}
              </code>
            </div>
            <div>
              <p className="text-blue-400 mb-1">// Send log error</p>
              <code className="text-cyan-300">
                {`fetch('/api/log', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ level: 'error', message: 'Console test' }) })`}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
