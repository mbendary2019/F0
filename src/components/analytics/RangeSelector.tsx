/**
 * Phase 63 Day 2: Range Selector Component
 * Allows users to switch between 7/30/90 day views
 */

"use client";

export default function RangeSelector({
  value,
  onChange,
  locale = "ar",
}: {
  value: number;
  onChange: (v: number) => void;
  locale?: "ar" | "en";
}) {
  const t =
    locale === "ar"
      ? { range: "المدى الزمني", d7: "7 أيام", d30: "30 يوم", d90: "90 يوم" }
      : { range: "Range", d7: "7 days", d30: "30 days", d90: "90 days" };

  const options = [
    { value: 7, label: t.d7 },
    { value: 30, label: t.d30 },
    { value: 90, label: t.d90 },
  ];

  return (
    <div className="flex gap-2 items-center">
      <span className="text-sm opacity-75">{t.range}:</span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded-xl border transition-colors ${
            value === opt.value
              ? "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700"
              : "hover:bg-gray-50 dark:hover:bg-gray-800/50 border-gray-200 dark:border-gray-700"
          }`}
          aria-pressed={value === opt.value}
          aria-label={`${t.range}: ${opt.label}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
