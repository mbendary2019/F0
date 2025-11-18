/**
 * Timeline Page - Non-Localized Route (Fallback)
 *
 * Route: /ops/timeline
 *
 * This is a fallback route for direct access without locale.
 * Users will be redirected to /[locale]/ops/timeline by middleware,
 * but this ensures the page works even if accessed directly.
 *
 * Phase 62 Day 3 - Timeline UI
 */

import TimelinePage from "@/features/ops/timeline/TimelinePage";

export const dynamic = "force-dynamic"; // Always render dynamically for real-time data

export default function Page() {
  return <TimelinePage />;
}

// Metadata for SEO
export const metadata = {
  title: "Timeline - Ops",
  description: "Real-time operations event timeline",
};
