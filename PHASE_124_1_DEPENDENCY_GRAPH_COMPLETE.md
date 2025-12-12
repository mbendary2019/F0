# Phase 124.1: Dependency Graph Engine ✅

## Summary
تم إنشاء نظام Dependency Graph كامل. الآن يمكن للـ F0 Desktop IDE بناء "خريطة دماغ المشروع" - من يستورد من، إيه اللي هيتكسر لو غيرت ملف معين، وإيه الملفات الـ orphan.

## Files Created

### 1. Core Dependency Scanner
**File:** `desktop/src/lib/snapshot/dependencyGraph.ts`

Features:
- `buildDependencyGraph()` - Scans all code files and builds import/export map
- `getDependencyStats()` - Returns summary statistics
- `findAffectedFiles()` - Find all files impacted by a change
- `findDependencies()` - Find all dependencies of a file
- `findUsagesOfExport()` - Find files using a specific export

Supports:
- ES6 imports: `import { x } from './file'`
- Default imports: `import x from './file'`
- Namespace imports: `import * as x from './file'`
- Side-effect imports: `import './file'`
- Re-exports: `export { x } from './file'`
- CommonJS: `require('./file')`
- Dynamic imports: `import('./file')`
- Next.js @ aliases: `@/lib/utils`

### 2. Updated Snapshot Generator
**File:** `desktop/src/lib/agent/tools/generateProjectSnapshot.ts`

Added:
- `DependencyStats` - Summary of graph statistics
- `DependencyGraph` - Full graph structure
- `includeDependencyGraph` option - Include full graph (for deep analysis)
- `includeDependencyStats` option - Include stats only (default: true)

### 3. Enhanced Snapshot Button UI
**File:** `desktop/src/components/SnapshotButton.tsx`

Added dependency stats display:
```
🔗 Dependency Graph
┌──────────┬──────────┐
│   542    │   3847   │
│  Files   │  Links   │
├──────────┼──────────┤
│    12    │    38    │
│   Hubs   │ Orphans  │
└──────────┴──────────┘
Avg imports/file: 7.1
```

### 4. Dependency Graph API
**File:** `src/app/api/projects/[projectId]/dependency-graph/route.ts`

Endpoints:
- `GET` - Load cached dependency graph from Firestore
- `POST` - Save dependency graph to Firestore
- `DELETE` - Clear cached graph
- `PUT` - Query the graph:
  - `action: 'affected'` - Find files affected by a change
  - `action: 'dependencies'` - Find all dependencies of a file

## Firestore Structure

```
projects/
  {projectId}/
    meta/
      dependency_graph/
        graph: DependencyGraph
        stats: DependencyStats
        userId: string
        version: number
        createdAt: string
        updatedAt: string
```

## Data Structures

```typescript
interface FileDependency {
  file: string;
  imports: string[];      // Files this file imports
  importedBy: string[];   // Files that import this file
  exports: string[];      // Named exports from this file
}

interface DependencyGraph {
  totalFiles: number;
  edges: number;           // Total import relationships
  nodes: FileDependency[];
  orphans: string[];       // Files with no connections
  entryPoints: string[];   // Files that are imported but don't import others
  hubs: string[];          // Files with 10+ importers
  generatedAt: string;
}

interface DependencyStats {
  totalFiles: number;
  totalEdges: number;
  orphanCount: number;
  hubCount: number;
  avgImportsPerFile: number;
}
```

## Usage Examples

### In Desktop IDE
```tsx
// Generate snapshot with dependency stats
const snapshot = await generateBasicSnapshot({
  projectRoot: '/path/to/project',
  includeDependencyStats: true,
});

console.log(snapshot.dependencyStats);
// { totalFiles: 542, totalEdges: 3847, orphanCount: 38, hubCount: 12, avgImportsPerFile: 7.1 }
```

### Agent Queries
The agent can now answer:
- "الملف ده تابع لإيه؟" → Uses `findDependencies()`
- "لو عدّلت هنا إيه اللي هيتكسر؟" → Uses `findAffectedFiles()`
- "مين بيستورد مين؟" → Uses `graph.nodes`
- "إيه ملفات الـ dead / orphan؟" → Uses `graph.orphans`

### API Query
```bash
# Find affected files
curl -X PUT /api/projects/proj123/dependency-graph \
  -d '{"action":"affected","filePath":"src/lib/auth.ts"}'

# Response
{
  "affectedFiles": [
    "src/app/[locale]/auth/page.tsx",
    "src/components/AuthProvider.tsx",
    "src/hooks/useAuth.ts"
  ],
  "count": 3
}
```

## Testing

1. Open F0 Desktop IDE
2. Open a project (must be indexed)
3. Click "📸 Generate Snapshot" button
4. View the modal - check "🔗 Dependency Graph" section
5. Verify stats show file count, links, hubs, orphans

## Next Steps

- [ ] Visual dependency graph (D3.js visualization)
- [ ] "Impact analysis" quick action button
- [ ] Agent tool to query graph directly
- [ ] Incremental graph updates (watch for file changes)

---
Completed: 2025-11-30
Phase: 124.1 - Dependency Graph Engine
