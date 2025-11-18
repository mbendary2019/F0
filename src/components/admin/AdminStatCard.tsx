/**
 * Admin Stat Card Component
 * Displays a metric with label, value, and optional hint
 */

export function AdminStatCard({ 
  label, 
  value, 
  hint 
}: { 
  label: string; 
  value: number | string; 
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 hover:border-gray-300 transition-colors">
      <div className="text-sm text-gray-600 font-medium">{label}</div>
      <div className="text-3xl font-semibold mt-2 text-gray-900">{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}

