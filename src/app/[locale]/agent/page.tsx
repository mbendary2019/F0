'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import F0Shell from '@/components/f0/F0Shell';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import Image from 'next/image';
import type { F0Phase, F0Task } from '@/types/project';

type Message = {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  createdAt: number;
};

export default function AgentWorkspacePage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const isRTL = locale === 'ar';

  const search = useSearchParams();
  const router = useRouter();

  const projectId = search.get('projectId') || '';
  const intent = search.get('intent') || 'continue';

  // Phase 104: Redirect to new Continue Workspace page
  useEffect(() => {
    if (projectId && intent === 'continue') {
      router.replace(`/${locale}/f0/projects/${projectId}/continue`);
    }
  }, [projectId, intent, locale, router]);

  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);

  const [project, setProject] = useState<any | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState<boolean>(!!projectId);

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  // Phases & Tasks from Firestore (projects collection - Phase 104)
  const [phases, setPhases] = useState<F0Phase[]>([]);
  const [tasks, setTasks] = useState<Record<string, F0Task[]>>({});
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('mvp');

  // ------- تحميل بيانات المشروع من Firestore -------
  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    async function loadProject() {
      try {
        setIsLoadingProject(true);
        const ref = doc(db, 'ops_projects', projectId);
        const snap = await getDoc(ref);
        if (cancelled) return;

        if (snap.exists()) {
          setProject({ id: snap.id, ...snap.data() });
        } else {
          setProject({ id: projectId, name: projectId });
        }
      } catch (err) {
        console.error('[Agent] Failed to load project', err);
        if (!cancelled) setProject({ id: projectId, name: projectId });
      } finally {
        if (!cancelled) setIsLoadingProject(false);
      }
    }

    loadProject();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const intentMeta = useMemo(() => {
    const name = project?.name ?? projectId ?? t('this project', 'هذا المشروع');

    switch (intent) {
      case 'generate-prd':
        return {
          title: t('Generate PRD', 'توليد مستند المتطلبات PRD'),
          badge: 'PRD',
          description: t(
            'Describe your idea in 2–3 lines and the agent will write a full product requirements document.',
            'اكتب فكرتك في سطرين إلى ثلاثة، والوكيل سيكتب مستند متطلبات كامل.'
          ),
          quickPrompt: t(
            `Generate a complete Product Requirements Document for "${name}".`,
            `قم بتوليد مستند متطلبات منتج كامل للمشروع "${name}".`
          ),
        };
      case 'design-api-db':
        return {
          title: t('Design API & DB', 'تصميم API وقاعدة البيانات'),
          badge: 'API',
          description: t(
            'Ask the agent to design REST/GraphQL endpoints and database schema for your project.',
            'اطلب من الوكيل تصميم واجهات API ومخطط قاعدة البيانات لمشروعك.'
          ),
          quickPrompt: t(
            `Design API endpoints and database schema for "${name}".`,
            `صمّم واجهات API ومخطط قاعدة البيانات للمشروع "${name}".`
          ),
        };
      case 'continue':
      default:
        return {
          title: t('Continue with Agent', 'استكمال العمل مع الوكيل'),
          badge: t('Agent', 'وكيل'),
          description: t(
            'Ask the agent to continue planning, coding, or reviewing this project.',
            'اطلب من الوكيل استكمال التخطيط أو البرمجة أو المراجعة لهذا المشروع.'
          ),
          quickPrompt: t(
            `Continue from where we stopped in "${name}".`,
            `أكمل من حيث توقفنا في المشروع "${name}".`
          ),
        };
    }
  }, [intent, locale, project?.name, projectId, t]);

  // Phase 98 Step 3: تحميل الرسائل من Firestore
  useEffect(() => {
    if (!projectId) return;

    console.log('[Agent UI] Setting up messages listener for project:', projectId);

    const messagesRef = collection(db, 'ops_projects', projectId, 'agent_messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMessages = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          role: data.role === 'assistant' ? 'agent' : data.role,
          content: data.content,
          createdAt: data.createdAt || Date.now(),
        };
      }) as Message[];

      console.log('[Agent UI] Loaded', loadedMessages.length, 'messages from Firestore');
      setMessages(loadedMessages);
    });

    return () => {
      console.log('[Agent UI] Cleaning up messages listener');
      unsubscribe();
    };
  }, [projectId]);

  // Phase 104: Real-time listener for phases
  useEffect(() => {
    if (!projectId) return;

    const phasesRef = collection(db, 'projects', projectId, 'phases');
    const q = query(phasesRef, orderBy('order', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const phasesData: F0Phase[] = [];
      snapshot.forEach((doc) => {
        phasesData.push(doc.data() as F0Phase);
      });
      setPhases(phasesData);
    });

    return () => unsubscribe();
  }, [projectId]);

  // Phase 104: Real-time listener for tasks
  useEffect(() => {
    if (!projectId) return;

    const tasksRef = collection(db, 'projects', projectId, 'tasks');

    const unsubscribe = onSnapshot(tasksRef, (snapshot) => {
      const tasksData: Record<string, F0Task[]> = {};
      snapshot.forEach((doc) => {
        const task = doc.data() as F0Task;
        if (!tasksData[task.phaseId]) {
          tasksData[task.phaseId] = [];
        }
        tasksData[task.phaseId].push(task);
      });
      setTasks(tasksData);
    });

    return () => unsubscribe();
  }, [projectId]);

  // اضبط الـ input الافتراضي بناءً على الـ intent
  useEffect(() => {
    setInput(intentMeta.quickPrompt);
  }, [intentMeta.quickPrompt]);

  // Helper functions for tasks
  const getPhaseProgress = (phaseId: string): number => {
    const phaseTasks = tasks[phaseId] || [];
    if (phaseTasks.length === 0) return 0;
    const completed = phaseTasks.filter((t) => t.status === 'completed').length;
    return Math.round((completed / phaseTasks.length) * 100);
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'completed':
        return locale === 'ar' ? 'مكتمل' : 'Done';
      case 'in_progress':
        return locale === 'ar' ? 'قيد التنفيذ' : 'In Progress';
      case 'blocked':
        return locale === 'ar' ? 'محظور' : 'Blocked';
      default:
        return locale === 'ar' ? 'معلق' : 'Pending';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'in_progress':
        return 'text-blue-400';
      case 'blocked':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  // ------- إرسال الرسالة للـ Agent API -------
  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;
    if (!projectId) {
      alert(
        t(
          'No project selected. Please open this page from a project.',
          'لا يوجد مشروع محدد. من فضلك افتح هذه الصفحة من داخل مشروع.'
        )
      );
      return;
    }

    // Phase 98: Don't add messages manually - Firestore onSnapshot will handle it
    setInput(''); // Clear input immediately
    setIsSending(true);

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          intent,
          message: text,
        }),
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Agent error');
      }

      // Phase 98: Messages are already saved in Firestore by API route
      // onSnapshot listener will update the UI automatically
      console.log('[Agent UI] Message sent successfully, waiting for Firestore update');
    } catch (err) {
      console.error('[Agent] send error', err);
      // Show error in messages
      const errorMessage: Message = {
        id: `sys-${Date.now()}`,
        role: 'system',
        content: t(
          'Something went wrong while talking to the agent. Please try again.',
          'حدث خطأ أثناء التواصل مع الوكيل. الرجاء المحاولة مرة أخرى.'
        ),
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      // Restore input on error
      setInput(text);
    } finally {
      setIsSending(false);
    }
  }

  const projectName = project?.name ?? projectId ?? t('Untitled project', 'مشروع بدون اسم');

  return (
    <F0Shell>
      <div
        className={`flex flex-col gap-6 ${
          isRTL ? 'text-right' : 'text-left'
        } max-w-5xl mx-auto`}
      >
        {/* Breadcrumb + عنوان */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
            {t('F0 Agent Workspace', 'مساحة عمل وكيل F0')}
          </p>
          <div
            className={`flex items-center justify-between ${
              isRTL ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div>
              <h1 className="text-2xl font-semibold text-white">
                {intentMeta.title}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {intentMeta.description}
              </p>
            </div>

            {/* ملصق المشروع المختار */}
            {projectId && (
              <div
                className={`rounded-full bg-slate-900/70 border border-white/10 px-4 py-2 text-xs text-slate-200 flex items-center gap-2 ${
                  isRTL ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-fuchsia-500/80 shadow-[0_0_15px_rgba(217,70,239,0.7)]">
                  <Image
                    src="/mascots/f0-mascot-login.png"
                    alt="F0 Agent"
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                </span>
                <div className="flex flex-col">
                  <span className="font-medium truncate max-w-[160px]">
                    {projectName}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {t('Project ID:', 'معرّف المشروع:')}{' '}
                    <span className="font-mono text-slate-300">{projectId}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* كرت الـ Intent */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-fuchsia-500/20">
          <div
            className={`flex items-center justify-between ${
              isRTL ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.25em] text-fuchsia-300/80">
                {t('Agent Ready', 'الوكيل جاهز')}
              </p>
              <p className="text-sm text-slate-300">
                {t('Ready to work on', 'جاهز للعمل على')}{' '}
                <span className="font-semibold text-slate-100">
                  "{projectName}"
                </span>
              </p>
              {isLoadingProject && (
                <p className="text-[11px] text-slate-500">
                  {t('Loading project details…', 'جاري تحميل بيانات المشروع…')}
                </p>
              )}
            </div>
            <span className="inline-flex items-center rounded-full bg-fuchsia-500/15 px-3 py-1 text-[11px] text-fuchsia-200 border border-fuchsia-400/40">
              {intentMeta.badge}
            </span>
          </div>
        </div>

        {/* Phase 99: Project Context Banner */}
        {project && (project.projectType || project.platforms || project.framework) && (
          <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
            <div className={isRTL ? 'text-right' : 'text-left'}>
              {t(
                '👋 You are now talking to the agent about:',
                '👋 إنت دلوقتي بتتكلم مع الوكيل بخصوص:'
              )}
              <div className="mt-1 font-semibold text-white">
                {project.name || t('Untitled project', 'مشروع بدون اسم')} –{' '}
                {project.projectType === 'mobile-app'
                  ? t('Mobile App', 'تطبيق موبايل')
                  : project.projectType === 'web-app'
                  ? t('Web App', 'تطبيق ويب')
                  : project.projectType === 'desktop-app'
                  ? t('Desktop App', 'تطبيق ديسكتوب')
                  : project.projectType === 'backend-api'
                  ? t('Backend API', 'خدمة API')
                  : project.projectType === 'mixed'
                  ? t('Multi-platform App', 'تطبيق متعدد المنصّات')
                  : t('Software Project', 'مشروع برمجي')}
              </div>
              {project.platforms && project.platforms.length > 0 && (
                <div className="text-xs opacity-80 mt-1">
                  {t('Platforms:', 'المنصّات:')}{' '}
                  {project.platforms
                    .map((p: string) =>
                      p === 'ios'
                        ? 'iOS'
                        : p === 'android'
                        ? 'Android'
                        : p === 'web'
                        ? 'Web'
                        : p === 'windows'
                        ? 'Windows'
                        : p === 'mac'
                        ? 'macOS'
                        : p === 'linux'
                        ? 'Linux'
                        : p
                    )
                    .join(' + ')}
                </div>
              )}
              {project.framework && (
                <div className="text-xs opacity-80 mt-0.5">
                  {t('Tech:', 'التقنية:')}{' '}
                  {project.framework === 'nextjs'
                    ? 'Next.js'
                    : project.framework === 'react-native'
                    ? 'React Native'
                    : project.framework === 'electron'
                    ? 'Electron'
                    : project.framework === 'tauri'
                    ? 'Tauri'
                    : project.framework === 'node-api'
                    ? 'Node.js API'
                    : project.framework}
                </div>
              )}
            </div>
          </div>
        )}

        {/* منطقة الرسائل */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-white/5 bg-slate-950/70 min-h-[260px] p-4 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-xs text-slate-500">
                  {t(
                    'Chat history will appear here once you start talking to the agent.',
                    'سيسجّل هنا تاريخ المحادثة بعد أن تبدأ التحدث مع الوكيل.'
                  )}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`text-sm ${
                      msg.role === 'user'
                        ? 'text-slate-100'
                        : msg.role === 'agent'
                        ? 'text-emerald-100'
                        : 'text-amber-200'
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">
                      {msg.role === 'user'
                        ? t('You', 'أنت')
                        : msg.role === 'agent'
                        ? t('F0 Agent', 'وكيل F0')
                        : t('System', 'النظام')}
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* الفورم */}
          <form
            onSubmit={handleSend}
            className="rounded-full border border-fuchsia-500/50 bg-slate-950/80 px-3 py-2 flex items-center gap-2"
          >
            <input
              type="text"
              className={`flex-1 bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-500 ${
                isRTL ? 'text-right' : 'text-left'
              }`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t(
                'Ask the agent to plan, design, or build…',
                'اطلب من الوكيل أن يخطط أو يصمّم أو يطوّر…'
              )}
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-4 py-1.5 text-xs font-semibold text-white shadow-[0_0_18px_rgba(236,72,153,0.7)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSending
                ? t('Sending…', 'جاري الإرسال…')
                : t('Send', 'إرسال')}
            </button>
          </form>

          {/* رجوع لصفحة المشروع */}
          {projectId && (
            <div
              className={`text-[11px] text-slate-500 ${
                isRTL ? 'text-right' : 'text-left'
              }`}
            >
              <Link
                href={`/${locale}/projects/${projectId}`}
                className="underline underline-offset-4 hover:text-slate-300"
              >
                {t('← Back to project overview', '← رجوع لصفحة المشروع')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </F0Shell>
  );
}
