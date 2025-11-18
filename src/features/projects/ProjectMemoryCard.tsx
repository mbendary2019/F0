'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Brain, Clock } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface ProjectMemory {
  summary?: string;
  architectureNotes?: string;
  codingGuidelines?: string;
  uiUxGuidelines?: string;
  knownIssues?: string[];
  importantLinks?: string[];
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
  revision?: number;
}

type Props = {
  projectId: string;
  locale?: string;
};

export function ProjectMemoryCard({ projectId, locale = 'en' }: Props) {
  const isArabic = locale === 'ar';
  const [memory, setMemory] = useState<ProjectMemory | null>(null);
  const [loading, setLoading] = useState(true);

  // Load project memory from Firestore in real-time
  useEffect(() => {
    const projectRef = doc(db, 'projects', projectId);
    const unsubscribe = onSnapshot(projectRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMemory(data.projectMemory || null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectId]);

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4" />
            {isArabic ? 'ذاكرة المشروع' : 'Project Memory'}
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4" />
            {isArabic ? 'ذاكرة المشروع' : 'Project Memory'}
          </CardTitle>
          {memory?.revision && (
            <span className="text-xs text-muted-foreground font-mono">
              Rev {memory.revision}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!memory ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {isArabic
                ? 'لا توجد ذاكرة للمشروع بعد. سيبدأ الـ Agent في بناء الذاكرة تلقائيًا أثناء العمل.'
                : 'No project memory yet. The agent will start building memory automatically as it works on this project.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary */}
            {memory.summary && (
              <section className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  {isArabic ? 'الملخص:' : 'Summary:'}
                </div>
                <p className="text-xs whitespace-pre-wrap leading-relaxed">
                  {memory.summary}
                </p>
              </section>
            )}

            {/* Architecture Notes */}
            {memory.architectureNotes && (
              <section className="space-y-1 pt-2 border-t">
                <div className="text-xs font-medium text-muted-foreground">
                  {isArabic ? 'ملاحظات معمارية:' : 'Architecture Notes:'}
                </div>
                <p className="text-xs whitespace-pre-wrap leading-relaxed">
                  {memory.architectureNotes}
                </p>
              </section>
            )}

            {/* Coding Guidelines */}
            {memory.codingGuidelines && (
              <section className="space-y-1 pt-2 border-t">
                <div className="text-xs font-medium text-muted-foreground">
                  {isArabic ? 'قواعد البرمجة:' : 'Coding Guidelines:'}
                </div>
                <p className="text-xs whitespace-pre-wrap leading-relaxed">
                  {memory.codingGuidelines}
                </p>
              </section>
            )}

            {/* UI/UX Guidelines */}
            {memory.uiUxGuidelines && (
              <section className="space-y-1 pt-2 border-t">
                <div className="text-xs font-medium text-muted-foreground">
                  {isArabic ? 'قواعد التصميم:' : 'UI/UX Guidelines:'}
                </div>
                <p className="text-xs whitespace-pre-wrap leading-relaxed">
                  {memory.uiUxGuidelines}
                </p>
              </section>
            )}

            {/* Known Issues */}
            {memory.knownIssues && memory.knownIssues.length > 0 && (
              <section className="space-y-1 pt-2 border-t">
                <div className="text-xs font-medium text-muted-foreground">
                  {isArabic ? 'المشاكل المعروفة:' : 'Known Issues:'}
                </div>
                <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                  {memory.knownIssues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* Important Links */}
            {memory.importantLinks && memory.importantLinks.length > 0 && (
              <section className="space-y-1 pt-2 border-t">
                <div className="text-xs font-medium text-muted-foreground">
                  {isArabic ? 'روابط مهمة:' : 'Important Links:'}
                </div>
                <ul className="text-xs space-y-1">
                  {memory.importantLinks.map((link, i) => (
                    <li key={i}>
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Last Updated */}
            {memory.lastUpdatedAt && (
              <div className="pt-2 border-t flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>
                  {isArabic ? 'آخر تحديث:' : 'Last updated:'}{' '}
                  {new Date(memory.lastUpdatedAt).toLocaleDateString(
                    isArabic ? 'ar-EG' : 'en-US',
                    {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  )}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
