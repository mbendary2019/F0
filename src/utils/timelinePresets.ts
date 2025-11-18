/**
 * Timeline Filter Presets Utility (Phase 62 Day 5)
 *
 * Manages saved filter presets with localStorage persistence.
 * Optional cloud sync via Firestore for cross-device access.
 */

import { TimelineFilters } from "@/hooks/useTimeline";

export interface TimelinePreset {
  id: string;
  name: string;
  filters: Partial<TimelineFilters>;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "timeline_presets";

/**
 * Loads all presets from localStorage
 *
 * @returns Array of saved presets, sorted by updatedAt (most recent first)
 *
 * @example
 * const presets = loadPresets();
 * console.log(presets); // [{ id: "abc", name: "My Preset", filters: {...} }]
 */
export function loadPresets(): TimelinePreset[] {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return [];

    const presets = JSON.parse(json) as TimelinePreset[];
    return presets.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.error("[timelinePresets] Failed to load presets:", err);
    return [];
  }
}

/**
 * Saves a new preset or updates an existing one
 *
 * @param name - Preset name
 * @param filters - Filter configuration to save
 * @param existingId - Optional: ID of preset to update
 * @returns The saved preset object
 *
 * @example
 * const preset = savePreset("High Priority", { severity: "error", from: Date.now() - 86400000 });
 */
export function savePreset(
  name: string,
  filters: Partial<TimelineFilters>,
  existingId?: string
): TimelinePreset {
  const now = Date.now();
  const presets = loadPresets();

  // Update existing preset
  if (existingId) {
    const index = presets.findIndex((p) => p.id === existingId);
    if (index >= 0) {
      presets[index] = {
        ...presets[index],
        name,
        filters,
        updatedAt: now,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
      return presets[index];
    }
  }

  // Create new preset
  const newPreset: TimelinePreset = {
    id: `preset_${now}_${Math.random().toString(36).slice(2, 9)}`,
    name,
    filters,
    createdAt: now,
    updatedAt: now,
  };

  presets.push(newPreset);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));

  return newPreset;
}

/**
 * Deletes a preset by ID
 *
 * @param id - Preset ID to delete
 * @returns true if deleted, false if not found
 *
 * @example
 * deletePreset("preset_123");
 */
export function deletePreset(id: string): boolean {
  const presets = loadPresets();
  const filtered = presets.filter((p) => p.id !== id);

  if (filtered.length === presets.length) {
    return false; // Not found
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

/**
 * Gets a single preset by ID
 *
 * @param id - Preset ID
 * @returns Preset object or null if not found
 *
 * @example
 * const preset = getPreset("preset_123");
 * if (preset) applyFilters(preset.filters);
 */
export function getPreset(id: string): TimelinePreset | null {
  const presets = loadPresets();
  return presets.find((p) => p.id === id) || null;
}

/**
 * Exports all presets as JSON string
 *
 * @returns JSON string of all presets
 *
 * @example
 * const json = exportPresets();
 * downloadFile("timeline-presets.json", json);
 */
export function exportPresets(): string {
  const presets = loadPresets();
  return JSON.stringify(presets, null, 2);
}

/**
 * Imports presets from JSON string (merges with existing)
 *
 * @param json - JSON string containing preset array
 * @returns Number of presets imported
 *
 * @example
 * const count = importPresets(jsonString);
 * console.log(`Imported ${count} presets`);
 */
export function importPresets(json: string): number {
  try {
    const imported = JSON.parse(json) as TimelinePreset[];
    if (!Array.isArray(imported)) {
      throw new Error("Invalid preset format");
    }

    const existing = loadPresets();
    const existingIds = new Set(existing.map((p) => p.id));

    // Only import new presets (avoid duplicates)
    const newPresets = imported.filter((p) => !existingIds.has(p.id));

    if (newPresets.length > 0) {
      const merged = [...existing, ...newPresets];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    }

    return newPresets.length;
  } catch (err) {
    console.error("[timelinePresets] Failed to import presets:", err);
    throw new Error("Failed to import presets: Invalid JSON format");
  }
}

/**
 * Clears all presets from localStorage
 *
 * @example
 * clearAllPresets();
 */
export function clearAllPresets(): void {
  localStorage.removeItem(STORAGE_KEY);
}
