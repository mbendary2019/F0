// src/app/[locale]/(app)/layout.tsx
import type { ReactNode } from "react";
import { NeonAppShell } from "@/components/neon/NeonAppShell";

export default function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  return <NeonAppShell locale={params.locale}>{children}</NeonAppShell>;
}
