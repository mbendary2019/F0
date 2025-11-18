/**
 * PresetManager Component (Phase 62 Day 5)
 *
 * UI for managing timeline filter presets.
 * - Save current filters as a preset
 * - Load existing presets
 * - Delete presets
 * - Import/Export presets as JSON
 */

"use client";

import { useState, useEffect } from "react";
import { TimelineFilters } from "@/hooks/useTimeline";
import {
  loadPresets,
  savePreset,
  deletePreset,
  exportPresets,
  importPresets,
  TimelinePreset,
} from "@/utils/timelinePresets";

export interface PresetManagerProps {
  /**
   * Current active filters
   */
  filters: Partial<TimelineFilters>;

  /**
   * Callback when a preset is loaded
   */
  onLoadPreset: (filters: Partial<TimelineFilters>) => void;
}

export function PresetManager({ filters, onLoadPreset }: PresetManagerProps) {
  const [presets, setPresets] = useState<TimelinePreset[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [saveMode, setSaveMode] = useState(false);
  const [presetName, setPresetName] = useState("");

  // Load presets on mount
  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  // Refresh presets list
  const refreshPresets = () => {
    setPresets(loadPresets());
  };

  // Save current filters as a new preset
  const handleSave = () => {
    if (!presetName.trim()) {
      alert("Please enter a preset name");
      return;
    }

    try {
      savePreset(presetName.trim(), filters);
      setPresetName("");
      setSaveMode(false);
      refreshPresets();
    } catch (err) {
      console.error("Failed to save preset:", err);
      alert("Failed to save preset");
    }
  };

  // Load a preset
  const handleLoad = (preset: TimelinePreset) => {
    onLoadPreset(preset.filters);
    setIsOpen(false);
  };

  // Delete a preset
  const handleDelete = (id: string) => {
    if (!confirm("Delete this preset?")) return;

    try {
      deletePreset(id);
      refreshPresets();
    } catch (err) {
      console.error("Failed to delete preset:", err);
      alert("Failed to delete preset");
    }
  };

  // Export all presets as JSON
  const handleExport = () => {
    try {
      const json = exportPresets();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timeline-presets-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export presets:", err);
      alert("Failed to export presets");
    }
  };

  // Import presets from JSON file
  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const count = importPresets(text);
        alert(`Imported ${count} new preset(s)`);
        refreshPresets();
      } catch (err: any) {
        console.error("Failed to import presets:", err);
        alert(`Failed to import presets: ${err.message}`);
      }
    };
    input.click();
  };

  return (
    <div className="relative">
      {/* Main button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/60"
        title="Manage filter presets"
      >
        💾 Presets {presets.length > 0 && `(${presets.length})`}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 rounded-xl border border-white/20 bg-[#0b0d10] shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <div className="text-sm font-medium">Filter Presets</div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs opacity-70 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>

          {/* Save section */}
          {saveMode ? (
            <div className="p-3 border-b border-white/10 bg-white/5">
              <div className="text-xs mb-2">Save Current Filters</div>
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="Preset name..."
                className="w-full px-2 py-1.5 rounded-md border border-white/20 bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/60 mb-2"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 px-2 py-1 rounded-md bg-purple-500 hover:bg-purple-600 text-xs transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setSaveMode(false);
                    setPresetName("");
                  }}
                  className="px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-2 border-b border-white/10">
              <button
                onClick={() => setSaveMode(true)}
                className="w-full px-3 py-1.5 rounded-md border border-white/20 hover:bg-white/10 transition-colors text-xs"
              >
                💾 Save Current Filters
              </button>
            </div>
          )}

          {/* Presets list */}
          <div className="max-h-64 overflow-y-auto">
            {presets.length === 0 ? (
              <div className="p-4 text-center text-xs opacity-50">
                No saved presets yet
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-white/5 transition-colors group"
                  >
                    <button
                      onClick={() => handleLoad(preset)}
                      className="flex-1 text-left text-xs truncate"
                      title={`Load preset: ${preset.name}`}
                    >
                      <div className="font-medium">{preset.name}</div>
                      <div className="opacity-50 text-[10px]">
                        {new Date(preset.updatedAt).toLocaleDateString()}
                      </div>
                    </button>
                    <button
                      onClick={() => handleDelete(preset.id)}
                      className="opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded-md border border-white/20 hover:bg-rose-500/20"
                      title="Delete preset"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer actions */}
          {presets.length > 0 && (
            <div className="p-2 border-t border-white/10 flex gap-2">
              <button
                onClick={handleExport}
                className="flex-1 px-2 py-1.5 rounded-md border border-white/20 hover:bg-white/10 transition-colors text-xs"
                title="Export all presets as JSON"
              >
                📤 Export
              </button>
              <button
                onClick={handleImport}
                className="flex-1 px-2 py-1.5 rounded-md border border-white/20 hover:bg-white/10 transition-colors text-xs"
                title="Import presets from JSON file"
              >
                📥 Import
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
