// src/app/admin/layout.tsx
// Admin layout with forced dynamic rendering

// Force dynamic rendering for all admin pages
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
