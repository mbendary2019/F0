/**
 * FiltersBar Component (Phase 62 Day 2 + Day 5 Enhancement)
 *
 * Filter controls for the timeline:
 * - Session ID text input
 * - Strategy dropdown (critic, majority, default)
 * - Type dropdown (mesh.start, rag.retrieve, rag.validate, mesh.final)
 * - Date range pickers (from/to)
 * - Preset manager (Day 5: save/load filter presets)
 */

import { useEffect, useState } from "react";
import type { TimelineFilters } from "@/hooks/useTimeline";
import { PresetManager } from "./PresetManager";

export type FiltersBarProps = {
  value: TimelineFilters;
  onChange: (filters: TimelineFilters) => void;
};

export function FiltersBar({ value, onChange }: FiltersBarProps) {
  const [sessionId, setSessionId] = useState(value.sessionId || "");
  const [strategy, setStrategy] = useState(value.strategy || "");
  const [type, setType] = useState(value.type || "");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  /**
   * Update parent when filters change
   */
  useEffect(() => {
    onChange({
      ...value,
      sessionId: sessionId || undefined,
      strategy: strategy || undefined,
      type: type || undefined,
      from: from ? Date.parse(from) : undefined,
      to: to ? Date.parse(to) : undefined,
    });
  }, [sessionId, strategy, type, from, to]);

  /**
   * Clear all filters
   */
  const handleClear = () => {
    setSessionId("");
    setStrategy("");
    setType("");
    setFrom("");
    setTo("");
  };

  /**
   * Load filters from a preset
   */
  const handleLoadPreset = (filters: Partial<TimelineFilters>) => {
    setSessionId(filters.sessionId || "");
    setStrategy(filters.strategy || "");
    setType(filters.type || "");
    setFrom(filters.from ? new Date(filters.from).toISOString().slice(0, 16) : "");
    setTo(filters.to ? new Date(filters.to).toISOString().slice(0, 16) : "");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-2xl border border-white/10 bg-white/5">
        {/* Session ID Input */}
        <div className="flex flex-col min-w-[200px]">
          <label className="text-xs mb-1 opacity-70">Session ID</label>
          <input
            className="px-3 py-2 rounded-lg bg-transparent border border-white/15 focus:border-white/30 focus:outline-none"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="sess_..."
          />
        </div>

        {/* Strategy Select */}
        <div className="flex flex-col min-w-[150px]">
          <label className="text-xs mb-1 opacity-70">Strategy</label>
          <select
            className="px-3 py-2 rounded-lg bg-transparent border border-white/15 focus:border-white/30 focus:outline-none cursor-pointer"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
          >
            <option value="">Any</option>
            <option value="critic">Critic</option>
            <option value="majority">Majority</option>
            <option value="default">Default</option>
          </select>
        </div>

        {/* Type Select */}
        <div className="flex flex-col min-w-[180px]">
          <label className="text-xs mb-1 opacity-70">Event Type</label>
          <select
            className="px-3 py-2 rounded-lg bg-transparent border border-white/15 focus:border-white/30 focus:outline-none cursor-pointer"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Any</option>
            <option value="mesh.start">Mesh Start</option>
            <option value="rag.retrieve">RAG Retrieve</option>
            <option value="rag.validate">RAG Validate</option>
            <option value="mesh.consensus">Mesh Consensus</option>
            <option value="mesh.final">Mesh Final</option>
          </select>
        </div>

        {/* From Date */}
        <div className="flex flex-col min-w-[200px]">
          <label className="text-xs mb-1 opacity-70">From</label>
          <input
            type="datetime-local"
            className="px-3 py-2 rounded-lg bg-transparent border border-white/15 focus:border-white/30 focus:outline-none"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>

        {/* To Date */}
        <div className="flex flex-col min-w-[200px]">
          <label className="text-xs mb-1 opacity-70">To</label>
          <input
            type="datetime-local"
            className="px-3 py-2 rounded-lg bg-transparent border border-white/15 focus:border-white/30 focus:outline-none"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        {/* Clear Button */}
        <button
          onClick={handleClear}
          className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition-colors"
        >
          Clear All
        </button>

        {/* Preset Manager */}
        <PresetManager
          filters={{ sessionId, strategy, type, from: from ? Date.parse(from) : undefined, to: to ? Date.parse(to) : undefined }}
          onLoadPreset={handleLoadPreset}
        />
      </div>

      {/* Active Filters Summary */}
      {(sessionId || strategy || type || from || to) && (
        <div className="flex items-center gap-2 text-xs">
          <span className="opacity-70">Active filters:</span>
          {sessionId && (
            <span className="px-2 py-1 rounded-md bg-blue-500/20 text-blue-300">
              Session: {sessionId}
            </span>
          )}
          {strategy && (
            <span className="px-2 py-1 rounded-md bg-purple-500/20 text-purple-300">
              Strategy: {strategy}
            </span>
          )}
          {type && (
            <span className="px-2 py-1 rounded-md bg-green-500/20 text-green-300">
              Type: {type}
            </span>
          )}
          {from && (
            <span className="px-2 py-1 rounded-md bg-orange-500/20 text-orange-300">
              From: {new Date(from).toLocaleDateString()}
            </span>
          )}
          {to && (
            <span className="px-2 py-1 rounded-md bg-orange-500/20 text-orange-300">
              To: {new Date(to).toLocaleDateString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
