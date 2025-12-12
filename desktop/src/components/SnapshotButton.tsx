// desktop/src/components/SnapshotButton.tsx
// Phase 123: Snapshot Generation Button
// Phase 124.1: Added Dependency Graph display
// Phase 124.2: Added Routes Discovery display
// Purple button that generates and saves project snapshot

import React, { useState } from 'react';
import {
  generateProjectSnapshot,
  generateBasicSnapshot,
  type ProjectSnapshot,
  type DependencyStats,
  type RoutesStats,
} from '../lib/agent/tools/generateProjectSnapshot';
import {
  saveSnapshotToFirestore,
  saveSnapshotLocally,
  loadSnapshotFromFirestore,
  loadSnapshotLocally,
} from '../lib/agent/saveSnapshot';

interface SnapshotButtonProps {
  projectRoot: string;
  projectId?: string;
  userId?: string;
  locale?: 'ar' | 'en';
  onSnapshotGenerated?: (snapshot: ProjectSnapshot) => void;
  onError?: (error: string) => void;
  className?: string;
}

/**
 * SnapshotButton - Generates and saves project snapshot
 *
 * Shows:
 * - "Generate Snapshot" initially
 * - Loading spinner while generating
 * - Success checkmark when done
 * - Error state if failed
 */
export default function SnapshotButton({
  projectRoot,
  projectId,
  userId,
  locale = 'ar',
  onSnapshotGenerated,
  onError,
  className = '',
}: SnapshotButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const isArabic = locale === 'ar';

  const labels = {
    generate: isArabic ? '📸 توليد Snapshot' : '📸 Generate Snapshot',
    generating: isArabic ? '⏳ جاري التحليل...' : '⏳ Analyzing...',
    success: isArabic ? '✅ تم التوليد' : '✅ Generated',
    error: isArabic ? '❌ فشل' : '❌ Failed',
    view: isArabic ? '👁️ عرض' : '👁️ View',
    regenerate: isArabic ? '🔄 إعادة التوليد' : '🔄 Regenerate',
    close: isArabic ? 'إغلاق' : 'Close',
    noIndex: isArabic ? 'لا يوجد فهرس للمشروع' : 'No project index found',
  };

  /**
   * Generate snapshot using basic analysis (no LLM)
   * Phase 124.1: Now includes dependency graph
   * For full LLM analysis, use the agent chat
   */
  const handleGenerate = async () => {
    setStatus('loading');

    try {
      // Try basic snapshot with dependency stats (no LLM required)
      console.log('[SnapshotButton] Generating snapshot for:', projectRoot);
      const basicSnapshot = await generateBasicSnapshot({
        projectRoot,
        locale,
        includeDependencyStats: true, // Phase 124.1
      });

      console.log('[SnapshotButton] Basic snapshot result:', {
        projectName: basicSnapshot?.projectName,
        hasStats: !!basicSnapshot?.dependencyStats,
        stats: basicSnapshot?.dependencyStats,
        fullBasicSnapshot: JSON.stringify(basicSnapshot, null, 2),
      });

      // Debug: Log each field explicitly
      if (basicSnapshot?.dependencyStats) {
        console.log('[SnapshotButton] Stats breakdown:', {
          totalFiles: basicSnapshot.dependencyStats.totalFiles,
          totalEdges: basicSnapshot.dependencyStats.totalEdges,
          hubCount: basicSnapshot.dependencyStats.hubCount,
          orphanCount: basicSnapshot.dependencyStats.orphanCount,
        });
      } else {
        console.warn('[SnapshotButton] NO dependencyStats in basicSnapshot!');
      }

      if (!basicSnapshot) {
        throw new Error(labels.noIndex);
      }

      // Create full snapshot structure
      const fullSnapshot: ProjectSnapshot = {
        projectName: basicSnapshot.projectName || projectRoot.split('/').pop() || 'Unknown',
        stack: basicSnapshot.stack || [],
        authFlow: '',
        billingFlow: '',
        routes: basicSnapshot.routes || [],
        apis: basicSnapshot.apis || [],
        stateManagement: [],
        database: basicSnapshot.stack?.includes('Firebase') ? 'Firebase' : '',
        styling: basicSnapshot.stack?.includes('Tailwind CSS') ? 'Tailwind CSS' : '',
        importantFiles: basicSnapshot.importantFiles || [],
        features: [],
        notes: ['Basic snapshot - use Agent for detailed analysis'],
        generatedAt: new Date().toISOString(),
        // Phase 124.1: Add dependency stats
        dependencyStats: basicSnapshot.dependencyStats,
        // Phase 124.2: Add routes info
        routesInfo: basicSnapshot.routesInfo,
        apiRoutesInfo: basicSnapshot.apiRoutesInfo,
        layoutsInfo: basicSnapshot.layoutsInfo,
        routesStats: basicSnapshot.routesStats,
      };

      console.log('[SnapshotButton] fullSnapshot created:', {
        hasStats: !!fullSnapshot.dependencyStats,
        hasRoutes: !!fullSnapshot.routesStats,
        routesStats: fullSnapshot.routesStats,
      });

      // Save snapshot
      if (projectId && userId) {
        // Save to Firestore
        const result = await saveSnapshotToFirestore({
          projectId,
          userId,
          snapshot: fullSnapshot,
        });

        if (!result.success) {
          // Fallback to local storage
          saveSnapshotLocally(projectRoot, fullSnapshot);
        }
      } else {
        // Save locally
        saveSnapshotLocally(projectRoot, fullSnapshot);
      }

      console.log('[SnapshotButton] Setting state with snapshot. Stats:', fullSnapshot.dependencyStats);
      setSnapshot(fullSnapshot);
      setStatus('success');
      onSnapshotGenerated?.(fullSnapshot);

      // Debug: verify state was set
      console.log('[SnapshotButton] State set, snapshot has stats:', !!fullSnapshot.dependencyStats);

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    } catch (err) {
      console.error('[SnapshotButton] Error:', err);
      setStatus('error');
      onError?.(err instanceof Error ? err.message : 'Failed to generate snapshot');

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    }
  };

  /**
   * Load existing snapshot
   */
  const loadExisting = async () => {
    if (projectId) {
      const loaded = await loadSnapshotFromFirestore(projectId);
      if (loaded) {
        setSnapshot(loaded);
        setShowPreview(true);
        return;
      }
    }

    const local = loadSnapshotLocally(projectRoot);
    if (local) {
      setSnapshot(local);
      setShowPreview(true);
    }
  };

  return (
    <div className={`f0-snapshot-button-container ${className}`}>
      {/* Main Button */}
      <button
        onClick={status === 'success' && snapshot ? () => setShowPreview(true) : handleGenerate}
        disabled={status === 'loading'}
        className={`
          px-3 py-1.5 rounded-lg text-sm font-medium transition-all
          ${status === 'loading' ? 'bg-purple-600/50 cursor-wait' : ''}
          ${status === 'success' ? 'bg-green-600 hover:bg-green-700' : ''}
          ${status === 'error' ? 'bg-red-600 hover:bg-red-700' : ''}
          ${status === 'idle' ? 'bg-purple-600 hover:bg-purple-700' : ''}
          text-white flex items-center gap-2
        `}
      >
        {status === 'loading' && (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        )}
        {status === 'idle' && labels.generate}
        {status === 'loading' && labels.generating}
        {status === 'success' && labels.success}
        {status === 'error' && labels.error}
      </button>

      {/* View button after success */}
      {snapshot && status === 'idle' && (
        <button
          onClick={() => setShowPreview(true)}
          className="ml-2 px-2 py-1.5 rounded-lg text-xs bg-zinc-700 hover:bg-zinc-600 text-white"
        >
          {labels.view}
        </button>
      )}

      {/* Snapshot Preview Modal */}
      {showPreview && snapshot && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
              <h3 className="text-lg font-semibold text-white">
                📸 {snapshot.projectName}
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
              {/* Stack */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-zinc-400 mb-2">Stack</h4>
                <div className="flex flex-wrap gap-2">
                  {snapshot.stack.map((tech, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-purple-600/20 text-purple-300 rounded text-xs"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {/* Routes */}
              {snapshot.routes.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Routes</h4>
                  <div className="bg-zinc-800 rounded p-2 text-xs font-mono text-zinc-300 max-h-32 overflow-y-auto">
                    {snapshot.routes.map((route, i) => (
                      <div key={i}>{route}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* APIs */}
              {snapshot.apis.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">APIs</h4>
                  <div className="bg-zinc-800 rounded p-2 text-xs font-mono text-zinc-300 max-h-32 overflow-y-auto">
                    {snapshot.apis.map((api, i) => (
                      <div key={i}>{api}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Important Files */}
              {snapshot.importantFiles.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Important Files</h4>
                  <div className="bg-zinc-800 rounded p-2 text-xs font-mono text-zinc-300 max-h-32 overflow-y-auto">
                    {snapshot.importantFiles.map((file, i) => (
                      <div key={i}>{file}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Phase 124.2: Routes Stats */}
              {snapshot.routesStats && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">
                    🗺️ {isArabic ? 'خريطة المسارات' : 'Routes Map'}
                  </h4>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-zinc-800 rounded p-2 text-center">
                      <div className="text-xl font-bold text-green-400">
                        {snapshot.routesStats.pageCount}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {isArabic ? 'صفحات' : 'Pages'}
                      </div>
                    </div>
                    <div className="bg-zinc-800 rounded p-2 text-center">
                      <div className="text-xl font-bold text-cyan-400">
                        {snapshot.routesStats.apiCount}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {isArabic ? 'APIs' : 'APIs'}
                      </div>
                    </div>
                    <div className="bg-zinc-800 rounded p-2 text-center">
                      <div className="text-xl font-bold text-orange-400">
                        {snapshot.routesStats.layoutCount}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {isArabic ? 'تخطيطات' : 'Layouts'}
                      </div>
                    </div>
                    <div className="bg-zinc-800 rounded p-2 text-center">
                      <div className="text-xl font-bold text-pink-400">
                        {snapshot.routesStats.dynamicRouteCount}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {isArabic ? 'ديناميكية' : 'Dynamic'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 124.2: Detailed Routes List */}
              {snapshot.routesInfo && snapshot.routesInfo.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">
                    📄 {isArabic ? 'الصفحات' : 'Pages'} ({snapshot.routesInfo.length})
                  </h4>
                  <div className="bg-zinc-800 rounded p-2 text-xs font-mono text-zinc-300 max-h-32 overflow-y-auto">
                    {snapshot.routesInfo.slice(0, 15).map((route, i) => (
                      <div key={i} className="flex justify-between items-center py-0.5">
                        <span className={route.segmentType === 'dynamic' ? 'text-pink-300' : ''}>
                          {route.path}
                        </span>
                        {route.segmentType !== 'static' && (
                          <span className="text-zinc-500 text-[10px]">{route.segmentType}</span>
                        )}
                      </div>
                    ))}
                    {snapshot.routesInfo.length > 15 && (
                      <div className="text-zinc-500 mt-1">
                        +{snapshot.routesInfo.length - 15} {isArabic ? 'المزيد' : 'more'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Phase 124.2: API Routes List */}
              {snapshot.apiRoutesInfo && snapshot.apiRoutesInfo.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">
                    🔌 {isArabic ? 'APIs' : 'API Routes'} ({snapshot.apiRoutesInfo.length})
                  </h4>
                  <div className="bg-zinc-800 rounded p-2 text-xs font-mono text-zinc-300 max-h-32 overflow-y-auto">
                    {snapshot.apiRoutesInfo.slice(0, 10).map((route, i) => (
                      <div key={i} className="flex justify-between items-center py-0.5">
                        <span className={route.segmentType === 'dynamic' ? 'text-pink-300' : ''}>
                          {route.path}
                        </span>
                        <span className="text-cyan-400 text-[10px]">
                          {route.methods?.join(', ')}
                        </span>
                      </div>
                    ))}
                    {snapshot.apiRoutesInfo.length > 10 && (
                      <div className="text-zinc-500 mt-1">
                        +{snapshot.apiRoutesInfo.length - 10} {isArabic ? 'المزيد' : 'more'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Phase 124.1: Dependency Graph Stats */}
              {snapshot.dependencyStats && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">
                    🔗 {isArabic ? 'خريطة الاعتمادية' : 'Dependency Graph'}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-zinc-800 rounded p-3 text-center">
                      <div className="text-2xl font-bold text-purple-400">
                        {snapshot.dependencyStats.totalFiles}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {isArabic ? 'ملفات' : 'Files'}
                      </div>
                    </div>
                    <div className="bg-zinc-800 rounded p-3 text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        {snapshot.dependencyStats.totalEdges}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {isArabic ? 'روابط' : 'Links'}
                      </div>
                    </div>
                    <div className="bg-zinc-800 rounded p-3 text-center">
                      <div className="text-2xl font-bold text-yellow-400">
                        {snapshot.dependencyStats.hubCount}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {isArabic ? 'ملفات مركزية' : 'Hub Files'}
                      </div>
                    </div>
                    <div className="bg-zinc-800 rounded p-3 text-center">
                      <div className="text-2xl font-bold text-red-400">
                        {snapshot.dependencyStats.orphanCount}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {isArabic ? 'ملفات يتيمة' : 'Orphan Files'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500 text-center">
                    {isArabic ? 'معدل الاعتماديات:' : 'Avg imports/file:'} {snapshot.dependencyStats.avgImportsPerFile}
                  </div>
                </div>
              )}

              {/* Generated At */}
              <div className="text-xs text-zinc-500 mt-4">
                Generated: {new Date(snapshot.generatedAt).toLocaleString()}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-700">
              <button
                onClick={handleGenerate}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
              >
                {labels.regenerate}
              </button>
              <button
                onClick={() => setShowPreview(false)}
                className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm"
              >
                {labels.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
