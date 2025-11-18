"use client";

import { AlertTriangle, Info } from "lucide-react";

interface CommunityBannerProps {
  locale?: "ar" | "en";
}

export default function CommunityBanner({ locale = "ar" }: CommunityBannerProps) {
  const isRTL = locale === "ar";

  const content = {
    ar: {
      title: "صفحة مجتمعية • معلوماتية فقط",
      subtitle: "هذه الصفحة للمعلومات فقط. لا توجد روابط شراء أو بيع. لا تعاملات مالية.",
      warning: "تحذير",
      warningText: "لسنا منصة تداول. المعلومات المقدمة للأغراض التعليمية فقط.",
      note: "ملاحظة",
      noteText: "قم بالبحث الخاص بك (DYOR) قبل أي قرارات استثمارية.",
    },
    en: {
      title: "Community Page • Informational Only",
      subtitle: "This page is informational only. No purchase or sale links. No financial transactions.",
      warning: "Warning",
      warningText: "We are not a trading platform. Information provided for educational purposes only.",
      note: "Note",
      noteText: "Do Your Own Research (DYOR) before any investment decisions.",
    },
  };

  const t = content[locale];

  return (
    <div
      className="w-full border-b bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Main Banner */}
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-3">
          <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <h2 className="text-sm font-bold text-amber-900 dark:text-amber-100">
              {t.title}
            </h2>
            <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
              {t.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Warning Strip */}
      <div className="border-t border-amber-200 dark:border-amber-800 bg-amber-100/50 dark:bg-amber-900/20">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-start gap-2 text-xs">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-red-900 dark:text-red-100">
                {t.warning}:
              </span>{" "}
              <span className="text-red-800 dark:text-red-200">
                {t.warningText}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Note Strip */}
      <div className="border-t border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-start gap-2 text-xs">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-blue-900 dark:text-blue-100">
                {t.note}:
              </span>{" "}
              <span className="text-blue-800 dark:text-blue-200">
                {t.noteText}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
