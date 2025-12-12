"use client";

import { useParams } from "next/navigation";
import F0Shell from "@/components/f0/F0Shell";

const mockActivity = [
  {
    id: "act-1",
    time: "Just now",
    actor: "You",
    summary: 'Opened Live Coding for project "F0 Full-stack"',
    category: "Live Coding",
  },
  {
    id: "act-2",
    time: "30 min ago",
    actor: "F0 Agent",
    summary: "Applied patch: updated Firebase security rules",
    category: "Agent",
  },
  {
    id: "act-3",
    time: "Yesterday",
    actor: "You",
    summary: "Deployed preview build to Vercel",
    category: "Deploy",
  },
];

export default function ActivityHistoryPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const isRTL = locale === "ar";

  const t = {
    titlePrefix:
      locale === "ar" ? "لوحة التحكم · أدوات" : "F0 Panel · Tools",
    title: locale === "ar" ? "سجل النشاط" : "Activity History",
    subtitle:
      locale === "ar"
        ? "تابع كل ما يحدث داخل حسابك: جلسات Live Coding، التعديلات، والنشر."
        : "Track everything happening in your account: live sessions, patches, and deployments.",
    empty:
      locale === "ar"
        ? "لا يوجد نشاط بعد. بمجرد بدء استخدام F0 Panel سيظهر النشاط هنا."
        : "No activity yet. Once you start using F0 Panel, activity will appear here.",
    headerTime: locale === "ar" ? "الوقت" : "Time",
    headerActor: locale === "ar" ? "المستخدم" : "Actor",
    headerSummary: locale === "ar" ? "الملخص" : "Summary",
    headerCategory: locale === "ar" ? "الفئة" : "Category",
  };

  return (
    <F0Shell>
      <div className={`space-y-3 mb-4 ${isRTL ? "text-right" : ""}`}>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
          {t.titlePrefix} · Activity
        </p>
        <h1 className="text-2xl font-semibold text-white">{t.title}</h1>
        <p className="text-sm text-slate-400">{t.subtitle}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/70 shadow-[0_0_25px_rgba(15,23,42,0.9)] overflow-hidden">
        {mockActivity.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            {t.empty}
          </div>
        ) : (
          <ul className={`divide-y divide-white/5 text-xs ${isRTL ? "text-right" : ""}`}>
            {mockActivity.map((item) => (
              <li
                key={item.id}
                className="px-5 py-4 hover:bg-slate-900/60 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      {item.time}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      • {t.headerActor}:{" "}
                      <span className="text-slate-100">{item.actor}</span>
                    </span>
                  </div>
                  <div className="mt-1 text-slate-100">{item.summary}</div>
                </div>
                <div className={isRTL ? "sm:pl-4" : "sm:pl-4 sm:text-right"}>
                  <span className="inline-flex items-center rounded-full border border-sky-300/40 bg-sky-900/30 px-2 py-0.5 text-[10px] text-sky-100">
                    {item.category}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </F0Shell>
  );
}
