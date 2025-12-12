// desktop/src/lib/testing/itg/itgTypes.ts
// Phase 139.0: Intelligent Test Generator Types
// Phase 139.5: Added AI Hybrid support types
// Phase 139.6: Added ITG Debug Snapshot for diagnostics

export type ITGRiskLevel = 'low' | 'medium' | 'high';

export interface ITGFileRisk {
  path: string;                  // "src/app/api/route.ts"
  riskLevel: ITGRiskLevel;
  reasons: string[];             // ["Large file", "Many TODOs", "Low coverage"]
  estimatedImpactScore: number;  // 0–100
}

export type ITGTestKind = 'unit' | 'integration';

export type ITGTestPriority = 'P0' | 'P1' | 'P2';

// Phase 139.5: AI source tracking
export type ITGAiSource = 'static' | 'ai-hybrid' | 'ai-full';

export interface ITGTestSuggestion {
  id: string;                    // stable id for UI list
  filePath: string;              // absolute-from-project root
  symbolName?: string;           // function / component name (optional)
  kind: ITGTestKind;
  description: string;           // "should handle invalid token gracefully"
  priority: ITGTestPriority;
  estimatedCoverageGain?: number; // in percent points (e.g. 5 = +5%)
  snippet?: string;              // optional test template snippet

  // Phase 139.5: AI enhancement metadata
  source?: ITGAiSource;          // 'static' | 'ai-hybrid' | 'ai-full'
  aiNotes?: string;              // "Improved by AI" / "Extra edge case added"
}

// Phase 139.5: AI mode for requests
export type ITGAiMode = 'hybrid' | 'full' | 'off';

export interface ITGGenerateRequest {
  projectId: string;
  files?: string[];              // optional subset of files to focus on
  maxSuggestions?: number;       // default from constants

  // Phase 139.5: AI configuration
  useAI?: boolean;               // true = enable AI enhancement
  aiMode?: ITGAiMode;            // 'hybrid' | 'full' | 'off'
}

// Phase 139.6: Debug Snapshot for diagnostics
export interface ITGDebugSnapshot {
  indexFileCount: number;         // Total files in project index
  analyzableFileCount: number;    // Files that were analyzed
  excludedFileCount: number;      // Files excluded from analysis
  maxFilesConfigured: number;     // Max files setting
  maxSuggestionsConfigured: number; // Max suggestions setting
  riskEntriesCount: number;       // Number of risk entries generated
  suggestionsCount: number;       // Number of suggestions generated
  baselineCoverage?: number;      // Current project coverage
  projectedCoverage?: number;     // Estimated coverage after suggestions
  notes?: string[];               // Additional debug notes
}

export interface ITGGenerateResult {
  risks: ITGFileRisk[];
  suggestions: ITGTestSuggestion[];
  baselineCoverage?: number;     // current project coverage
  projectedCoverage?: number;    // estimated coverage after applying suggestions
  debug?: ITGDebugSnapshot;      // Phase 139.6: Debug snapshot for diagnostics
}

/**
 * Simple status enum to help the UI (Test Lab panel).
 */
export type ITGStatus = 'idle' | 'running' | 'error' | 'success';
