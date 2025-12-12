'use client';

import Link from "next/link";
import { useParams } from "next/navigation";
import F0Shell from '@/components/f0/F0Shell';

export default function SettingsPage() {
  const params = useParams();
  const locale = params?.locale as string || 'en';
  const isRTL = locale === 'ar';

  return (
    <F0Shell>
      <div className={`space-y-3 mb-4 ${isRTL ? 'text-right' : ''}`}>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
          F0 Panel · {locale === 'ar' ? 'الإعدادات' : 'Settings'}
        </p>
        <h1 className="text-2xl font-semibold text-white">
          {locale === 'ar' ? 'إعدادات التطبيق' : 'Application Settings'}
        </h1>
        <p className="text-sm text-slate-400">
          {locale === 'ar'
            ? 'تخصيص تفضيلاتك وإعدادات F0'
            : 'Customize your preferences and F0 settings'}
        </p>
      </div>

      {/* Features List */}
      <div className="bg-slate-900/40 backdrop-blur-lg border border-white/10 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-violet-200">
          {isRTL ? 'الإعدادات المتاحة قريباً:' : 'Available Settings Soon:'}
        </h2>
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex items-start gap-2">
            <span className="text-violet-400 mt-0.5">•</span>
            <span>{isRTL ? 'اختيار اللغة (عربي / English)' : 'Language selection (Arabic / English)'}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400 mt-0.5">•</span>
            <span>{isRTL ? 'الوضع الليلي والثيمات' : 'Dark mode and themes'}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400 mt-0.5">•</span>
            <span>{isRTL ? 'إعدادات AI Agent والتفضيلات' : 'AI Agent settings and preferences'}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400 mt-0.5">•</span>
            <span>{isRTL ? 'إعدادات الإشعارات والبريد الإلكتروني' : 'Notifications and email settings'}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400 mt-0.5">•</span>
            <span>{isRTL ? 'الخصوصية والأمان' : 'Privacy and security'}</span>
          </li>
        </ul>
      </div>

      {/* Placeholder Info */}
      <div className="text-center py-12 bg-slate-950/30 backdrop-blur border border-white/5 rounded-2xl">
        <div className="text-6xl mb-4">⚙️</div>
        <p className="text-slate-400 mb-4">
          {isRTL
            ? 'صفحة الإعدادات قيد التطوير حالياً'
            : 'Settings page is under development'
          }
        </p>
        <Link
          href={`/${locale}/f0`}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-violet-400/30 text-violet-300 font-medium hover:bg-violet-500/10 transition"
        >
          {isRTL ? '← العودة للوحة التحكم' : '← Back to Dashboard'}
        </Link>
      </div>
    </F0Shell>
  );
}
