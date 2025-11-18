/**
 * TrendMini Component (Phase 62 Day 5 - Enhanced)
 *
 * Mini chart showing event count trends over the last 24 hours.
 * - Supports multiple binning options (5/15/30/60 min)
 * - Optional stacking by type or severity level
 * - Uses recharts for visualization
 *
 * IMPORTANT: This component is client-only and uses dynamic import for recharts
 * to prevent SSR issues.
 */

"use client";

import { memo, useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Dynamic import for recharts components (no SSR)
const LineChart = dynamic(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false }
);
const Line = dynamic(
  () => import("recharts").then((mod) => mod.Line),
  { ssr: false }
);
const Area = dynamic(
  () => import("recharts").then((mod) => mod.Area),
  { ssr: false }
);
const AreaChart = dynamic(
  () => import("recharts").then((mod) => mod.AreaChart),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((mod) => mod.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((mod) => mod.YAxis),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((mod) => mod.Tooltip),
  { ssr: false }
);
const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);

export interface TrendMiniProps {
  /**
   * Timeline items with timestamps, type, and optional severity
   */
  items: Array<{ ts: number; type: string; severity?: "info" | "warn" | "error" }>;

  /**
   * Initial bucket size in minutes (default: 60 = hourly)
   */
  bucketMinutes?: number;

  /**
   * Enable binning selector (default: true)
   */
  showBinSelector?: boolean;

  /**
   * Enable stack toggle (default: true)
   */
  showStackToggle?: boolean;
}

interface BucketData {
  ts: number;
  count: number;
  byType?: Record<string, number>;
  byLevel?: Record<string, number>;
}

/**
 * Bucketizes events into time intervals with optional grouping
 *
 * @param items - Events to bucketize
 * @param bucketMinutes - Size of each bucket in minutes
 * @param stackBy - Optional: group by "type" or "level"
 * @returns Array of {ts, count, byType?, byLevel?} for each bucket
 */
function bucketize(
  items: TrendMiniProps["items"],
  bucketMinutes = 60,
  stackBy?: "type" | "level"
): BucketData[] {
  const now = Date.now();
  const start = now - 24 * 60 * 60 * 1000; // 24 hours ago
  const bucketMs = bucketMinutes * 60 * 1000;

  // Initialize buckets
  const map = new Map<number, BucketData>();
  for (let t = start; t <= now; t += bucketMs) {
    map.set(t, { ts: t, count: 0, byType: {}, byLevel: {} });
  }

  // Count events in each bucket
  for (const item of items) {
    if (item.ts < start) continue;

    const bucketIndex = Math.floor((item.ts - start) / bucketMs);
    const bucketTs = start + bucketIndex * bucketMs;

    const bucket = map.get(bucketTs);
    if (!bucket) continue;

    bucket.count += 1;

    // Group by type if requested
    if (stackBy === "type" && item.type) {
      bucket.byType![item.type] = (bucket.byType![item.type] || 0) + 1;
    }

    // Group by level if requested
    if (stackBy === "level") {
      const level = item.severity || "info";
      bucket.byLevel![level] = (bucket.byLevel![level] || 0) + 1;
    }
  }

  // Convert to array
  return Array.from(map.values());
}

function TrendMiniComponent({
  items,
  bucketMinutes = 60,
  showBinSelector = true,
  showStackToggle = true,
}: TrendMiniProps) {
  const [mounted, setMounted] = useState(false);
  const [binSize, setBinSize] = useState(bucketMinutes);
  const [stackBy, setStackBy] = useState<"none" | "type" | "level">("none");

  // Only render chart after mount (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Transform data for chart
  const data = useMemo(() => {
    const buckets = bucketize(items, binSize, stackBy === "none" ? undefined : stackBy);

    return buckets.map((bucket) => {
      const hour = new Date(bucket.ts).getHours().toString().padStart(2, "0");
      const minute = new Date(bucket.ts).getMinutes().toString().padStart(2, "0");
      const label = binSize >= 60 ? `${hour}h` : `${hour}:${minute}`;

      const base: any = {
        x: label,
        y: bucket.count,
        timestamp: bucket.ts,
      };

      // Add stacked data if enabled
      if (stackBy === "type" && bucket.byType) {
        Object.assign(base, bucket.byType);
      } else if (stackBy === "level" && bucket.byLevel) {
        Object.assign(base, bucket.byLevel);
      }

      return base;
    });
  }, [items, binSize, stackBy]);

  // Extract unique keys for stacked areas
  const stackKeys = useMemo(() => {
    if (stackBy === "none") return [];

    const keysSet = new Set<string>();
    data.forEach((d) => {
      Object.keys(d).forEach((k) => {
        if (k !== "x" && k !== "y" && k !== "timestamp") {
          keysSet.add(k);
        }
      });
    });

    return Array.from(keysSet);
  }, [data, stackBy]);

  if (!items.length) {
    return (
      <div className="p-3 rounded-2xl border border-white/10 bg-white/5">
        <div className="text-xs opacity-70 mb-2">Events (24h)</div>
        <div className="h-24 flex items-center justify-center opacity-50">
          <div className="text-xs">No data</div>
        </div>
      </div>
    );
  }

  // Show loading state during SSR/hydration
  if (!mounted) {
    return (
      <div className="p-3 rounded-2xl border border-white/10 bg-white/5">
        <div className="text-xs opacity-70 mb-2">
          Events (24h) • {items.length} total
        </div>
        <div className="h-24 flex items-center justify-center">
          <div className="text-xs opacity-50">Loading chart...</div>
        </div>
      </div>
    );
  }

  // Color palette for stacked areas
  const colors = {
    info: "#60a5fa",
    warn: "#fbbf24",
    error: "#f87171",
    default: "#8b5cf6",
  };

  return (
    <div className="p-3 rounded-2xl border border-white/10 bg-white/5">
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs opacity-70">
          Events (24h) • {items.length} total
        </div>

        <div className="flex items-center gap-2">
          {/* Binning selector */}
          {showBinSelector && (
            <select
              value={binSize}
              onChange={(e) => setBinSize(Number(e.target.value))}
              className="px-2 py-0.5 rounded-md border border-white/20 bg-white/5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/60"
              title="Bin size"
            >
              <option value={5}>5m</option>
              <option value={15}>15m</option>
              <option value={30}>30m</option>
              <option value={60}>1h</option>
            </select>
          )}

          {/* Stack toggle */}
          {showStackToggle && (
            <select
              value={stackBy}
              onChange={(e) => setStackBy(e.target.value as "none" | "type" | "level")}
              className="px-2 py-0.5 rounded-md border border-white/20 bg-white/5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/60"
              title="Stack by"
            >
              <option value="none">Total</option>
              <option value="level">By Level</option>
              <option value="type">By Type</option>
            </select>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          {stackBy === "none" ? (
            <LineChart
              data={data}
              margin={{ top: 0, right: 6, bottom: 0, left: 0 }}
            >
              <XAxis
                dataKey="x"
                hide
                domain={["dataMin", "dataMax"]}
              />
              <YAxis
                hide
                domain={[0, "dataMax + 2"]}
              />
              <Tooltip
                formatter={(value: any) => [value, "Events"]}
                labelFormatter={(label) => `Time ${label}`}
                contentStyle={{
                  backgroundColor: "rgba(11, 13, 16, 0.95)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="y"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                animationDuration={300}
              />
            </LineChart>
          ) : (
            <AreaChart
              data={data}
              margin={{ top: 0, right: 6, bottom: 0, left: 0 }}
            >
              <XAxis
                dataKey="x"
                hide
                domain={["dataMin", "dataMax"]}
              />
              <YAxis
                hide
                domain={[0, "dataMax + 2"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(11, 13, 16, 0.95)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              {stackKeys.map((key, idx) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="1"
                  stroke={
                    key === "info" || key === "warn" || key === "error"
                      ? colors[key]
                      : colors.default
                  }
                  fill={
                    key === "info" || key === "warn" || key === "error"
                      ? colors[key]
                      : colors.default
                  }
                  fillOpacity={0.6}
                  animationDuration={300}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(TrendMiniComponent);
