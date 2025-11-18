'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Code, RefreshCw, CheckCircle2, Circle } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProjectAnalysis } from '@/types/projectAnalyzer';

type Props = {
  projectId: string;
  locale?: string;
};

export function ProjectTechStackCard({ projectId, locale = 'en' }: Props) {
  const isArabic = locale === 'ar';
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  // Load project analysis from Firestore in real-time
  useEffect(() => {
    const projectRef = doc(db, 'projects', projectId);
    const unsubscribe = onSnapshot(projectRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAnalysis(data.projectAnalysis || null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectId]);

  async function handleScan() {
    setScanning(true);
    try {
      // Note: In the future, this will trigger the desktop agent to scan
      // For now, we show a placeholder message
      alert(
        isArabic
          ? 'المسح الآلي للتقنيات قريباً!\nحالياً يجب تشغيل Desktop Agent للمسح.'
          : 'Auto-scan coming soon!\nCurrently requires Desktop Agent to scan.'
      );
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setScanning(false);
    }
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Code className="w-4 h-4" />
            {isArabic ? 'التقنيات المستخدمة' : 'Tech Stack'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {isArabic ? 'جاري التحميل...' : 'Loading...'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Code className="w-4 h-4" />
          {isArabic ? 'التقنيات المستخدمة' : 'Tech Stack'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!analysis ? (
          // No analysis yet
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {isArabic
                ? 'لم يتم تحليل المشروع بعد. اضغط للمسح:'
                : 'Project not analyzed yet. Click to scan:'}
            </p>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="text-xs px-3 py-2 rounded-lg border bg-white hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2"
            >
              <RefreshCw className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />
              {scanning
                ? isArabic
                  ? 'جاري المسح...'
                  : 'Scanning...'
                : isArabic
                ? 'مسح التقنيات (Scan Project)'
                : 'Scan Project'}
            </button>
          </div>
        ) : (
          // Show analysis
          <div className="space-y-3">
            {/* Project Type & Framework */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {isArabic ? 'نوع المشروع:' : 'Project Type:'}
              </span>
              <span className="font-mono font-semibold">{analysis.projectType}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {isArabic ? 'الإطار:' : 'Framework:'}
              </span>
              <span className="font-mono">{analysis.framework.name}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {isArabic ? 'اللغة:' : 'Language:'}
              </span>
              <span className="font-mono">{analysis.framework.language}</span>
            </div>

            {/* Detected Features */}
            <div className="pt-2 border-t space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground mb-1">
                {isArabic ? 'الميزات المكتشفة:' : 'Detected Features:'}
              </p>
              <div className="grid grid-cols-2 gap-1">
                <FeatureItem
                  label="Auth"
                  enabled={analysis.features.hasAuth}
                  isArabic={isArabic}
                />
                <FeatureItem
                  label="Firebase"
                  enabled={analysis.features.hasFirebase}
                  isArabic={isArabic}
                />
                <FeatureItem
                  label="Stripe"
                  enabled={analysis.features.hasStripe}
                  isArabic={isArabic}
                />
                <FeatureItem
                  label="i18n"
                  enabled={analysis.features.hasI18n}
                  isArabic={isArabic}
                />
                <FeatureItem
                  label="Tailwind"
                  enabled={analysis.features.hasTailwind}
                  isArabic={isArabic}
                />
                <FeatureItem
                  label="shadcn/ui"
                  enabled={analysis.features.hasShadcn}
                  isArabic={isArabic}
                />
                <FeatureItem
                  label="Backend API"
                  enabled={analysis.features.hasBackendApi}
                  isArabic={isArabic}
                />
              </div>
            </div>

            {/* File Stats */}
            <div className="pt-2 border-t space-y-1 text-[11px] text-muted-foreground">
              <div className="flex justify-between">
                <span>{isArabic ? 'عدد الملفات:' : 'File count:'}</span>
                <span className="font-mono">{analysis.fileCount}</span>
              </div>
              <div className="flex justify-between">
                <span>{isArabic ? 'الحجم:' : 'Total size:'}</span>
                <span className="font-mono">
                  {(analysis.totalSizeBytes / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              <div className="flex justify-between">
                <span>{isArabic ? 'آخر تحليل:' : 'Last analyzed:'}</span>
                <span className="font-mono text-[10px]">
                  {new Date(analysis.analyzedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Re-scan button */}
            <button
              onClick={handleScan}
              disabled={scanning}
              className="w-full text-xs px-3 py-2 rounded-lg border bg-white hover:bg-slate-50 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />
              {scanning
                ? isArabic
                  ? 'جاري إعادة المسح...'
                  : 'Re-scanning...'
                : isArabic
                ? 'إعادة مسح التقنيات'
                : 'Re-scan Tech Stack'}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeatureItem({
  label,
  enabled,
  isArabic,
}: {
  label: string;
  enabled: boolean;
  isArabic: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      {enabled ? (
        <CheckCircle2 className="w-3 h-3 text-green-600" />
      ) : (
        <Circle className="w-3 h-3 text-gray-300" />
      )}
      <span className={enabled ? 'text-foreground' : 'text-muted-foreground'}>
        {label}
      </span>
    </div>
  );
}
