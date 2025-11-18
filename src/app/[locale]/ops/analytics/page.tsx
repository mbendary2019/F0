/**
 * Phase 63 Day 2: Analytics Dashboard Page Route (i18n)
 * Locale-aware route for ops analytics dashboard
 */

import AnalyticsPage from "@/features/ops/analytics/AnalyticsPage";

export default function Page({
  params: { locale },
}: {
  params: { locale: "ar" | "en" };
}) {
  return <AnalyticsPage locale={locale} />;
}

export const metadata = {
  title: "Ops Analytics | From Zero",
  description: "Daily metrics and performance analytics for operations",
};
