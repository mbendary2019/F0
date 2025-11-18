/**
 * Timeline Page - Localized Route
 *
 * Route: /[locale]/ops/timeline
 * Examples: /ar/ops/timeline, /en/ops/timeline
 *
 * Phase 62 Day 3 - Timeline UI with i18n support
 */

import TimelinePage from "@/features/ops/timeline/TimelinePage";

export const dynamic = "force-dynamic"; // Always render dynamically for real-time data

export default function Page() {
  return <TimelinePage />;
}

// Metadata for SEO
export async function generateMetadata({ params }: { params: { locale: string } }) {
  const isArabic = params.locale === "ar";

  return {
    title: isArabic ? "الخط الزمني - العمليات" : "Timeline - Ops",
    description: isArabic
      ? "عرض الأحداث والعمليات في الوقت الفعلي"
      : "Real-time operations event timeline",
  };
}
