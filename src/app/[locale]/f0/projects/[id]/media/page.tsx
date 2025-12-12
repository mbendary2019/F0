'use client';

/**
 * Phase 100.3: AI Media Studio UI
 * Voice → Prompt → Image → Preview
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { F0MediaAsset, F0MediaKind } from '@/types/media';

const MEDIA_KINDS: { id: F0MediaKind; label: string; labelAr: string }[] = [
  { id: 'logo', label: 'Logo', labelAr: 'لوجو' },
  { id: 'app-icon', label: 'App Icon', labelAr: 'أيقونة التطبيق' },
  { id: 'splash', label: 'Splash Screen', labelAr: 'شاشة البداية' },
  { id: 'hero', label: 'Landing Hero', labelAr: 'صورة رئيسية' },
  { id: 'background', label: 'Background', labelAr: 'خلفية' },
  { id: 'illustration', label: 'Illustration', labelAr: 'رسم توضيحي' },
];

export default function ProjectMediaPage() {
  const params = useParams();
  const projectId = params.id as string;
  const locale = (params.locale as string) || 'en';
  const isRTL = locale === 'ar';

  const [prompt, setPrompt] = useState('');
  const [kind, setKind] = useState<F0MediaKind>('logo');
  const [isGenerating, setIsGenerating] = useState(false);
  const [assets, setAssets] = useState<F0MediaAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<F0MediaAsset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Phase 100.3: Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Load media assets from Firestore
  useEffect(() => {
    if (!projectId) return;

    const q = query(
      collection(db, 'projects', projectId, 'media_assets'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: F0MediaAsset[] = [];
      snap.forEach((doc) => list.push(doc.data() as F0MediaAsset));
      setAssets(list);
      console.log('[Media Studio] Loaded', list.length, 'assets');
    });

    return unsub;
  }, [projectId]);

  async function handleGenerate() {
    if (!prompt.trim() || !projectId) return;

    setIsGenerating(true);
    try {
      const res = await fetch('/api/media/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          kind,
          prompt,
          autoInsertTarget:
            kind === 'logo'
              ? 'navbar-logo'
              : kind === 'splash'
              ? 'splash-screen'
              : undefined,
        }),
      });

      const data = await res.json();
      console.log('[Media Studio] Generate result:', data);

      if (data.ok) {
        // Clear prompt on success
        setPrompt('');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('[Media Studio] Error:', err);
      alert('Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDownload(asset: F0MediaAsset) {
    try {
      // Use proxy API to bypass CORS restrictions
      const proxyUrl = `/api/media/download?url=${encodeURIComponent(asset.url)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${asset.kind}-${asset.id}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('[Media Studio] Download error:', err);
      alert(t('Failed to download image', 'فشل تحميل الصورة'));
    }
  }

  async function handleDelete(asset: F0MediaAsset) {
    if (!confirm(t('Delete this image?', 'مسح هذه الصورة؟'))) return;

    setIsDeleting(true);
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(
        doc(db, 'projects', projectId, 'media_assets', asset.id)
      );
      setSelectedAsset(null);
    } catch (err) {
      console.error('[Media Studio] Delete error:', err);
      alert(t('Failed to delete image', 'فشل مسح الصورة'));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleApplyToProject(asset: F0MediaAsset) {
    // Map kind to slot (simplified: logo→logo, splash→splash, hero→hero, others→hero as fallback)
    const kindToSlot: Record<F0MediaKind, 'logo' | 'splash' | 'hero'> = {
      logo: 'logo',
      'app-icon': 'logo', // fallback to logo
      splash: 'splash',
      hero: 'hero',
      background: 'hero', // fallback to hero
      illustration: 'hero', // fallback to hero
    };

    const slot = kindToSlot[asset.kind] || 'logo';

    const labels: Record<F0MediaKind, { en: string; ar: string }> = {
      logo: { en: 'Logo', ar: 'اللوجو' },
      'app-icon': { en: 'App Icon', ar: 'أيقونة التطبيق' },
      splash: { en: 'Splash Screen', ar: 'شاشة البداية' },
      hero: { en: 'Hero Image', ar: 'الصورة الرئيسية' },
      background: { en: 'Background', ar: 'الخلفية' },
      illustration: { en: 'Illustration', ar: 'الرسم التوضيحي' },
    };

    const label = labels[asset.kind]?.[locale === 'ar' ? 'ar' : 'en'] || asset.kind;
    const confirmMsg = t(
      `Use this image as project ${label}?`,
      `استخدام هذه الصورة كـ${label} للمشروع؟`
    );

    if (!confirm(confirmMsg)) return;

    setIsApplying(true);
    try {
      const response = await fetch('/api/projects/apply-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          mediaId: asset.id, // Changed from assetId to mediaId
          slot, // Changed from kind to slot
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to apply media: ${response.status}`);
      }

      console.log('[Media Studio] Successfully applied to project');
      alert(t('Image applied to project!', 'تم تطبيق الصورة على المشروع!'));
      setSelectedAsset(null);
    } catch (err) {
      console.error('[Media Studio] Apply error:', err);
      alert(t('Failed to apply image to project', 'فشل تطبيق الصورة على المشروع'));
    } finally {
      setIsApplying(false);
    }
  }

  // Phase 100.3: Voice recording functions
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        setIsTranscribing(true);
        try {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          formData.append('language', locale === 'ar' ? 'ar' : 'en');

          console.log('[Media Studio] Sending audio to API...');
          const response = await fetch('/api/media/voice', {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();
          console.log('[Media Studio] Transcription result:', data);

          if (data.ok && data.transcript) {
            setPrompt(data.transcript);
          } else {
            alert(t('Failed to transcribe audio', 'فشل تحويل الصوت إلى نص'));
          }
        } catch (err) {
          console.error('[Media Studio] Transcription error:', err);
          alert(t('Failed to transcribe audio', 'فشل تحويل الصوت إلى نص'));
        } finally {
          setIsTranscribing(false);
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error('[Media Studio] Microphone error:', err);
      alert(t('Could not access microphone', 'لا يمكن الوصول للميكروفون'));
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  }

  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);

  return (
    <div
      className={`p-6 text-white max-w-7xl mx-auto ${
        isRTL ? 'text-right' : 'text-left'
      }`}
    >
      {/* Back Button */}
      <div className="mb-4">
        <Link
          href={`/${locale}/projects/${projectId}`}
          className={`inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition ${
            isRTL ? 'flex-row-reverse' : ''
          }`}
        >
          <span>{isRTL ? '→' : '←'}</span>
          <span>{t('Back to Project', 'رجوع للمشروع')}</span>
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">
          🎨 {t('AI Media Studio', 'استوديو الوسائط بالذكاء الاصطناعي')}
        </h1>
        <p className="text-sm text-slate-400">
          {t(
            'Generate logos, icons, backgrounds, and more using AI',
            'أنشئ لوجوهات، أيقونات، خلفيات، وغيرها باستخدام الذكاء الاصطناعي'
          )}
        </p>
      </div>

      {/* Generation Form */}
      <div className="mb-8 rounded-2xl border border-white/10 bg-slate-900/70 p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t('Media Type', 'نوع الوسائط')}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {MEDIA_KINDS.map((k) => (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                className={`rounded-full px-3 py-1.5 text-xs border transition-all ${
                  kind === k.id
                    ? 'bg-purple-600/80 border-purple-400 text-white shadow-lg shadow-purple-500/30'
                    : 'border-white/20 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {isRTL ? k.labelAr : k.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t('Describe your image', 'اوصف الصورة المطلوبة')}
            </label>
            {/* Phase 100.3: Voice Input Button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
              className={`rounded-full p-2 transition-all ${
                isRecording
                  ? 'bg-red-500/80 hover:bg-red-600 animate-pulse'
                  : isTranscribing
                  ? 'bg-purple-500/50 cursor-wait'
                  : 'bg-purple-500/20 hover:bg-purple-500/40 border border-purple-400/30'
              }`}
              title={
                isRecording
                  ? t('Stop Recording', 'إيقاف التسجيل')
                  : isTranscribing
                  ? t('Transcribing...', 'جاري التحويل...')
                  : t('Voice Input', 'إدخال صوتي')
              }
            >
              {isTranscribing ? (
                <span className="text-xs">⏳</span>
              ) : isRecording ? (
                <span className="text-sm">⏹️</span>
              ) : (
                <span className="text-sm">🎤</span>
              )}
            </button>
          </div>
          <textarea
            className="w-full rounded-xl bg-black/40 border border-white/15 p-3 text-sm outline-none focus:border-purple-400 transition-colors"
            rows={3}
            placeholder={t(
              'Describe what you want the logo or image to look like...',
              'احكي للـ F0 إنت عايز اللوجو أو الصورة تكون عاملة إزاي...'
            )}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            dir={isRTL ? 'rtl' : 'ltr'}
            disabled={isTranscribing}
          />
          {isTranscribing && (
            <p className="text-xs text-purple-300 animate-pulse">
              {t('✨ Transcribing your voice...', '✨ جاري تحويل صوتك إلى نص...')}
            </p>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full rounded-xl px-4 py-2.5 bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all"
        >
          {isGenerating
            ? t('Generating...', 'جاري التوليد...')
            : t('🪄 Generate with AI', '🪄 توليد بالذكاء الاصطناعي')}
        </button>
      </div>

      {/* Assets Grid */}
      <div className="space-y-3">
        <h2 className="text-sm uppercase tracking-[0.2em] text-slate-400">
          {t('Generated Assets', 'الوسائط المولّدة')} ({assets.length})
        </h2>

        {assets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-12 text-center">
            <div className="text-4xl mb-3">🎨</div>
            <p className="text-sm text-slate-400">
              {t(
                'No assets yet. Generate your first logo or image above!',
                'لا توجد وسائط بعد. أنشئ أول لوجو أو صورة من الأعلى!'
              )}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col gap-2 hover:bg-white/10 hover:border-white/20 transition-all group"
              >
                <div className="relative aspect-square rounded-lg overflow-hidden bg-black/40">
                  <img
                    src={asset.url}
                    alt={asset.prompt}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setSelectedAsset(asset)}
                  />
                  {/* أزرار صغيرة على الصورة */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(asset);
                      }}
                      className="rounded-full bg-black/70 hover:bg-black/90 p-1.5 text-white text-xs transition"
                      title={t('Download', 'تنزيل')}
                    >
                      ⬇️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(asset);
                      }}
                      disabled={isDeleting}
                      className="rounded-full bg-red-600/70 hover:bg-red-600/90 p-1.5 text-white text-xs transition disabled:opacity-50"
                      title={t('Delete', 'مسح')}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-[10px] text-purple-200">
                    {MEDIA_KINDS.find((k) => k.id === asset.kind)?.[
                      isRTL ? 'labelAr' : 'label'
                    ] || asset.kind}
                  </span>
                  {asset.autoInserted && (
                    <span className="inline-flex items-center rounded-full bg-green-500/20 border border-green-400/30 px-2 py-0.5 text-[10px] text-green-200">
                      ✅ {t('In use', 'مستخدم')}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500">
                    {new Date(asset.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div
                  className="text-xs line-clamp-2 text-slate-300"
                  title={asset.prompt}
                >
                  {asset.prompt}
                </div>

                {asset.autoInsertTarget && (
                  <div className="text-[10px] text-amber-400/80 flex items-center gap-1">
                    <span>🔁</span>
                    <span>{asset.autoInsertTarget}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal للصورة */}
      {selectedAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedAsset(null)}
        >
          <div
            className="relative bg-slate-900 rounded-2xl border border-white/10 max-w-3xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedAsset(null)}
              className="absolute top-3 right-3 z-10 rounded-full bg-black/70 hover:bg-black/90 w-8 h-8 flex items-center justify-center text-white transition"
            >
              ✕
            </button>

            {/* Image */}
            <div className="w-full bg-black/40">
              <img
                src={selectedAsset.url}
                alt={selectedAsset.prompt}
                className="w-full max-h-[70vh] object-contain"
              />
            </div>

            {/* Info & Actions */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-purple-500/20 border border-purple-400/30 px-3 py-1 text-xs text-purple-200">
                  {MEDIA_KINDS.find((k) => k.id === selectedAsset.kind)?.[
                    isRTL ? 'labelAr' : 'label'
                  ] || selectedAsset.kind}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(selectedAsset.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="text-sm text-slate-300">
                {selectedAsset.prompt}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                {/* Use in Project Button (Primary Action) */}
                <button
                  onClick={() => handleApplyToProject(selectedAsset)}
                  disabled={isApplying || selectedAsset.autoInserted}
                  className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-bold text-white transition flex items-center justify-center gap-2"
                >
                  {selectedAsset.autoInserted ? (
                    <>
                      <span>✅</span>
                      <span>{t('Already in use', 'مستخدم بالفعل')}</span>
                    </>
                  ) : isApplying ? (
                    <>
                      <span>⏳</span>
                      <span>{t('Applying...', 'جاري التطبيق...')}</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>{t('Use in Project', 'استخدام في المشروع')}</span>
                    </>
                  )}
                </button>

                {/* Secondary Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(selectedAsset)}
                    className="flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 px-4 py-2 text-sm font-semibold text-white transition flex items-center justify-center gap-2"
                  >
                    <span>⬇️</span>
                    <span>{t('Download', 'تنزيل')}</span>
                  </button>
                  <button
                    onClick={() => handleDelete(selectedAsset)}
                    disabled={isDeleting}
                    className="flex-1 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition flex items-center justify-center gap-2"
                  >
                    <span>🗑️</span>
                    <span>{isDeleting ? t('Deleting...', 'جاري المسح...') : t('Delete', 'مسح')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
