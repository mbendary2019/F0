// desktop/src/views/ProjectTestsView.tsx
// Phase 137.2: Project Tests View - Tests Center Panel for Sidebar
// Phase 137.3: Added Test Coach integration for intelligent test analysis
// Phase 137.4.2: Added Coverage Coach integration for coverage analysis
// Phase 139.3: Added Intelligent Test Generator (ITG) Panel integration
// Phase 140.5: Added Autonomous Test Pipeline (ATP) Panel integration
// Displays test suites and provides actions to fix/improve tests via ACE agent

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useTestLab } from '../state/testLabContext';
import { useDeployQuality } from '../state/deployQualityContext';
// Phase 139.3: Import ITG Panel
import { IntelligentTestGeneratorPanel } from '../components/tests/IntelligentTestGeneratorPanel';
// Phase 140.5: Import ATP Panel
import { AutonomousTestPipelinePanel } from '../components/atp/AutonomousTestPipelinePanel';
import mascotImg from '../../public/mascots/f0-mascot-login.png';
import type { ExternalTestStats } from '../state/deployQualityContext';
import {
  buildTestRecipePrompt,
  getAvailableTestRecipes,
  type TestRecipeId,
  type Locale,
} from '../lib/tests/testRecipes';
import {
  buildTestCoachSummary,
  getTestCoachLabel,
  getTestCoachSubtitle,
  getTestCoachDetails,
  getPrimaryTestRecipe,
} from '../lib/tests/testCoach';
import {
  buildCoverageCoachSummary,
  getCoverageCoachLabel,
  getCoverageCoachSubtitle,
  getCoverageCoachDetails,
  getPrimaryCoverageRecipe,
} from '../lib/tests/coverageCoach';

interface ProjectTestsViewProps {
  /** Locale for labels */
  locale?: Locale;
  /** Project name for context */
  projectName?: string;
  /** Callback when requesting agent action with prompt */
  onOpenAceWithPrompt?: (prompt: string) => void;
  /** Additional class names */
  className?: string;
}

/**
 * ProjectTestsView
 * Tests Center panel for sidebar - displays test status and actions
 * Phase 137.2: Uses Test Recipes for consistent prompt building
 */
export const ProjectTestsView: React.FC<ProjectTestsViewProps> = ({
  locale = 'en',
  projectName,
  onOpenAceWithPrompt,
  className = '',
}) => {
  const {
    state: testLabState,
    // Phase 139.0: ITG state & actions
    itgStatus,
    itgSuggestions,
    generateSmartTests,
  } = useTestLab();
  const { suites, summary, status } = testLabState;
  const { externalTestStats, setExternalTestStats, externalCoverageStats, setExternalCoverageStats } = useDeployQuality();
  const isArabic = locale === 'ar';

  // Phase 137.3: Debug mode state for testing Test Coach
  const [showDebug, setShowDebug] = useState(false);

  // Phase 137.3: Build Test Coach summary
  const testCoach = useMemo(
    () => buildTestCoachSummary(externalTestStats, locale),
    [externalTestStats, locale]
  );

  // Phase 137.4.2: Build Coverage Coach summary
  const coverageCoach = useMemo(
    () => buildCoverageCoachSummary(externalCoverageStats, locale),
    [externalCoverageStats, locale]
  );

  // Get failing suites
  const failingSuites = useMemo(
    () => suites.filter((s) => s.status === 'failed'),
    [suites]
  );

  // Get available recipes
  const recipes = useMemo(() => getAvailableTestRecipes(locale), [locale]);

  // Handle recipe action
  const handleRecipeAction = useCallback(
    (recipeId: TestRecipeId) => {
      if (!onOpenAceWithPrompt) {
        console.log('[ProjectTestsView] No ACE handler provided');
        return;
      }

      // Build context based on recipe
      const failingTests = failingSuites.map((s) => ({
        file: s.testFilePath,
        name: s.suiteName,
        errorMessage: s.errorOutput?.substring(0, 200),
      }));

      const prompt = buildTestRecipePrompt(recipeId, {
        locale,
        targetFiles: failingSuites.map((s) => s.testFilePath),
        failingTests,
        suiteName: null,
        totalTests: summary.totalTests,
        passedTests: summary.passedTests,
        failedCount: summary.failedTests,
      });

      onOpenAceWithPrompt(prompt);
      console.log('[ProjectTestsView] Sent recipe action:', recipeId);
    },
    [onOpenAceWithPrompt, locale, failingSuites, summary]
  );

  // Handle fix single suite
  const handleFixSuite = useCallback(
    (suitePath: string, suiteName: string, errorOutput?: string) => {
      if (!onOpenAceWithPrompt) return;

      const prompt = buildTestRecipePrompt('FIX_FAILING_TESTS', {
        locale,
        targetFiles: [suitePath],
        failingTests: [
          {
            file: suitePath,
            name: suiteName,
            errorMessage: errorOutput?.substring(0, 300),
          },
        ],
      });

      onOpenAceWithPrompt(prompt);
    },
    [onOpenAceWithPrompt, locale]
  );

  // Phase 137.3: Handle "Ask Test Coach" action
  const handleAskTestCoach = useCallback(() => {
    if (!onOpenAceWithPrompt) return;

    const primaryRecipeId = getPrimaryTestRecipe(testCoach);
    const prompt = buildTestRecipePrompt(primaryRecipeId, {
      locale,
      targetFiles: failingSuites.map((s) => s.testFilePath),
      failingTests: failingSuites.map((s) => ({
        file: s.testFilePath,
        name: s.suiteName,
        errorMessage: s.errorOutput?.substring(0, 200),
      })),
      suiteName: null,
      totalTests: testCoach.totalCount,
      passedTests: testCoach.passedCount,
      failedCount: testCoach.failedCount,
    });

    onOpenAceWithPrompt(prompt);
    console.log('[ProjectTestsView] Asked Test Coach with recipe:', primaryRecipeId);
  }, [onOpenAceWithPrompt, testCoach, locale, failingSuites]);

  // Phase 137.4.2: Handle "Ask Coverage Coach" action
  const handleAskCoverageCoach = useCallback(() => {
    if (!onOpenAceWithPrompt) return;

    const primaryRecipeId = getPrimaryCoverageRecipe(coverageCoach);
    const prompt = buildTestRecipePrompt(primaryRecipeId, {
      locale,
      targetFiles: externalCoverageStats?.topHints?.map((h) => h.filePath) || [],
      totalTests: coverageCoach.totalFiles,
      passedTests: coverageCoach.filesWithTests,
    });

    onOpenAceWithPrompt(prompt);
    console.log('[ProjectTestsView] Asked Coverage Coach with recipe:', primaryRecipeId);
  }, [onOpenAceWithPrompt, coverageCoach, locale, externalCoverageStats]);

  // Labels
  const labels = {
    title: isArabic ? '🧪 مركز الاختبارات' : '🧪 Tests Center',
    noSuites: isArabic ? 'لا توجد اختبارات بعد' : 'No test suites found',
    runTestsHint: isArabic
      ? 'شغّل الاختبارات من شريط الجودة'
      : 'Run tests from the Quality bar',
    failingSuites: isArabic ? 'اختبارات فاشلة' : 'Failing Suites',
    fix: isArabic ? 'إصلاح' : 'Fix',
    quickActions: isArabic ? 'إجراءات سريعة' : 'Quick Actions',
    askTestCoach: isArabic ? 'اسأل Test Coach' : 'Ask Test Coach',
    askCoverageCoach: isArabic ? 'تحسين التغطية' : 'Improve Coverage',
    stats: {
      total: isArabic ? 'الإجمالي' : 'Total',
      passed: isArabic ? 'نجح' : 'Passed',
      failed: isArabic ? 'فشل' : 'Failed',
    },
  };

  // Status badge color
  const statusColor =
    status === 'idle'
      ? 'text-gray-400'
      : status === 'running'
        ? 'text-blue-400'
        : status === 'error'
          ? 'text-red-400'
          : 'text-emerald-400';

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#e0dbff]">{labels.title}</h3>
        <span className={`text-xs ${statusColor}`}>
          {status === 'running' ? '⏳' : status === 'error' ? '❌' : ''}
        </span>
      </div>

      {/* Phase 137.3: Test Coach Card */}
      <div className={`rounded-lg p-3 ${testCoach.bgClass} border border-[#251347]/50`}>
        <div className="flex items-start gap-2">
          <span className="text-lg">{testCoach.icon}</span>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-medium ${testCoach.colorClass}`}>
              {getTestCoachLabel(testCoach, locale)}
            </div>
            <div className="text-xs text-[#6b5f8a] mt-0.5">
              {getTestCoachSubtitle(testCoach, locale)}
            </div>
            {/* Detail bullets */}
            <ul className="mt-2 space-y-1">
              {getTestCoachDetails(testCoach, locale).map((detail, idx) => (
                <li key={idx} className="text-[10px] text-[#a89fd4]/70 flex items-start gap-1">
                  <span className="text-[8px] mt-0.5">•</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* Ask Test Coach Button */}
        {onOpenAceWithPrompt && (
          <button
            onClick={handleAskTestCoach}
            className="mt-2 w-full px-3 py-1.5 bg-[#7c3aed]/20 hover:bg-[#7c3aed]/30 border border-[#7c3aed]/30 rounded-lg text-xs text-[#c4b5fd] font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <img src={mascotImg} alt="Test Coach" className="h-4 w-4 rounded-full" />
            <span>{labels.askTestCoach}</span>
          </button>
        )}
      </div>

      {/* Phase 137.4.2: Coverage Coach Card */}
      <div className={`rounded-lg p-3 ${coverageCoach.bgClass} border border-[#251347]/50`}>
        <div className="flex items-start gap-2">
          <span className="text-lg">{coverageCoach.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#6b5f8a]">
              {isArabic ? 'مدرب التغطية' : 'Coverage Coach'}
            </div>
            <div className={`text-sm font-medium ${coverageCoach.colorClass}`}>
              {getCoverageCoachLabel(coverageCoach, locale)}
            </div>
            <div className="text-xs text-[#6b5f8a] mt-0.5">
              {getCoverageCoachSubtitle(coverageCoach, locale)}
            </div>
            {/* Detail bullets */}
            <ul className="mt-2 space-y-1">
              {getCoverageCoachDetails(coverageCoach, locale).slice(0, 2).map((detail, idx) => (
                <li key={idx} className="text-[10px] text-[#a89fd4]/70 flex items-start gap-1">
                  <span className="text-[8px] mt-0.5">•</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* Ask Coverage Coach Button - only show if not HIGH status */}
        {onOpenAceWithPrompt && coverageCoach.status !== 'HIGH' && (
          <button
            onClick={handleAskCoverageCoach}
            className="mt-2 w-full px-3 py-1.5 bg-[#7c3aed]/20 hover:bg-[#7c3aed]/30 border border-[#7c3aed]/30 rounded-lg text-xs text-[#c4b5fd] font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <span>📈</span>
            <span>{labels.askCoverageCoach}</span>
          </button>
        )}
      </div>

      {/* Phase 139.3: ITG Panel - Intelligent Test Generator */}
      <IntelligentTestGeneratorPanel
        className="mt-1"
        onInsertTest={(suggestion) => {
          // Pass the suggested test snippet to ACE
          if (onOpenAceWithPrompt && suggestion.snippet) {
            const prompt = isArabic
              ? `أنشئ اختبار جديد للملف ${suggestion.filePath}:\n\n${suggestion.snippet}`
              : `Create a new test for ${suggestion.filePath}:\n\n${suggestion.snippet}`;
            onOpenAceWithPrompt(prompt);
          }
        }}
      />

      {/* Phase 140.5: ATP Panel - Autonomous Test Pipeline */}
      <AutonomousTestPipelinePanel
        locale={locale}
        className="mt-2 pt-2 border-t border-[#251347]/30"
        onApplyFix={(fix) => {
          // Pass the fix to ACE for application
          if (onOpenAceWithPrompt && fix.patch) {
            const prompt = isArabic
              ? `طبّق الإصلاح التالي على الاختبار "${fix.testName}":\n\n${fix.patch}`
              : `Apply the following fix to test "${fix.testName}":\n\n${fix.patch}`;
            onOpenAceWithPrompt(prompt);
          }
        }}
        onInsertTest={(suggestion) => {
          // Pass the generated test to ACE
          if (onOpenAceWithPrompt && suggestion.content) {
            const prompt = isArabic
              ? `أنشئ اختبار جديد "${suggestion.title}" للملف ${suggestion.testFilePath}:\n\n${suggestion.content}`
              : `Create new test "${suggestion.title}" for ${suggestion.testFilePath}:\n\n${suggestion.content}`;
            onOpenAceWithPrompt(prompt);
          }
        }}
      />

      {/* Stats Summary */}
      {summary.totalSuites > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-[#1a1a2e]/60 rounded-lg p-2">
            <div className="text-lg font-bold text-[#e0dbff]">
              {summary.totalTests ?? 0}
            </div>
            <div className="text-[10px] text-[#6b5f8a]">{labels.stats.total}</div>
          </div>
          <div className="bg-emerald-500/10 rounded-lg p-2">
            <div className="text-lg font-bold text-emerald-400">
              {summary.passedTests ?? 0}
            </div>
            <div className="text-[10px] text-emerald-400/70">
              {labels.stats.passed}
            </div>
          </div>
          <div className="bg-red-500/10 rounded-lg p-2">
            <div className="text-lg font-bold text-red-400">
              {summary.failedTests ?? 0}
            </div>
            <div className="text-[10px] text-red-400/70">{labels.stats.failed}</div>
          </div>
        </div>
      )}

      {/* No suites message */}
      {suites.length === 0 && (
        <div className="text-center py-6 text-[#6b5f8a]">
          <div className="text-2xl mb-2">🧪</div>
          <div className="text-sm">{labels.noSuites}</div>
          <div className="text-xs mt-1 opacity-70">{labels.runTestsHint}</div>
        </div>
      )}

      {/* Failing Suites List */}
      {failingSuites.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-red-400/90 flex items-center gap-1">
            <span>❌</span>
            <span>
              {labels.failingSuites} ({failingSuites.length})
            </span>
          </h4>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {failingSuites.map((suite) => (
              <div
                key={suite.testFilePath}
                className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-red-300 truncate">
                      {suite.suiteName}
                    </div>
                    <div className="text-red-400/60 truncate text-[10px]">
                      {suite.testFilePath.split('/').pop()}
                    </div>
                  </div>
                  {onOpenAceWithPrompt && (
                    <button
                      onClick={() =>
                        handleFixSuite(
                          suite.testFilePath,
                          suite.suiteName,
                          suite.errorOutput
                        )
                      }
                      className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded text-[10px] font-medium transition-colors shrink-0"
                    >
                      🔧 {labels.fix}
                    </button>
                  )}
                </div>
                {suite.errorOutput && (
                  <div className="mt-1 text-[10px] text-red-400/50 line-clamp-2 font-mono">
                    {suite.errorOutput.substring(0, 100)}...
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {onOpenAceWithPrompt && (
        <div className="space-y-2 pt-2 border-t border-[#251347]/50">
          <h4 className="text-xs font-medium text-[#a89fd4]">
            {labels.quickActions}
          </h4>
          <div className="grid grid-cols-2 gap-1.5">
            {recipes.slice(0, 4).map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => handleRecipeAction(recipe.id)}
                className="flex items-center gap-1.5 px-2 py-1.5 bg-[#7c3aed]/10 hover:bg-[#7c3aed]/20 border border-[#7c3aed]/20 rounded-lg text-[10px] text-[#c4b5fd] transition-colors"
                title={recipe.description}
              >
                <span>{recipe.icon}</span>
                <span className="truncate">{recipe.label}</span>
              </button>
            ))}
          </div>
          {/* More actions row */}
          <div className="grid grid-cols-2 gap-1.5">
            {recipes.slice(4).map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => handleRecipeAction(recipe.id)}
                className="flex items-center gap-1.5 px-2 py-1.5 bg-[#1a1a2e]/60 hover:bg-[#7c3aed]/10 border border-[#251347]/50 rounded-lg text-[10px] text-[#6b5f8a] hover:text-[#c4b5fd] transition-colors"
                title={recipe.description}
              >
                <span>{recipe.icon}</span>
                <span className="truncate">{recipe.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Phase 137.3: Debug Controls for Test Coach */}
      <div className="pt-2 border-t border-[#251347]/30">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="text-[10px] text-[#e0dbff] hover:text-white transition-colors drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]"
        >
          {showDebug ? '▼' : '▶'} Debug Test + Coverage Coach
        </button>
        {showDebug && (
          <div className="mt-2 space-y-3">
            {/* Test Coach Debug */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-[#e0dbff] mb-1 drop-shadow-[0_0_3px_rgba(255,255,255,0.3)]">
                Simulate Test States:
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setExternalTestStats(null)}
                  className="px-2 py-1 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 rounded text-[10px] transition-colors"
                >
                  ⏸️ NOT_RUN
                </button>
                <button
                  onClick={() => setExternalTestStats({
                    totalTests: 10,
                    passedTests: 7,
                    failedTests: 3,
                    lastRunAt: new Date().toISOString(),
                  })}
                  className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-[10px] transition-colors"
                >
                  ❌ FAILING
                </button>
                <button
                  onClick={() => setExternalTestStats({
                    totalTests: 10,
                    passedTests: 7,
                    failedTests: 0,
                    lastRunAt: new Date().toISOString(),
                  })}
                  className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded text-[10px] transition-colors"
                >
                  ⚠️ UNSTABLE (70%)
                </button>
                <button
                  onClick={() => setExternalTestStats({
                    totalTests: 20,
                    passedTests: 20,
                    failedTests: 0,
                    lastRunAt: new Date().toISOString(),
                  })}
                  className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded text-[10px] transition-colors"
                >
                  ✅ HEALTHY
                </button>
              </div>
              <div className="text-[9px] text-[#6b5f8a]/60 mt-1">
                Test Coach: {testCoach.status} | Tests: {testCoach.totalCount}
              </div>
            </div>

            {/* Phase 137.4.2: Coverage Coach Debug */}
            <div className="space-y-1.5 pt-2 border-t border-[#251347]/20">
              <div className="text-[10px] text-[#e0dbff] mb-1 drop-shadow-[0_0_3px_rgba(255,255,255,0.3)]">
                Simulate Coverage States:
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setExternalCoverageStats(null)}
                  className="px-2 py-1 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 rounded text-[10px] transition-colors"
                >
                  ⚫ NONE
                </button>
                <button
                  onClick={() => setExternalCoverageStats({
                    summary: {
                      totalSourceFiles: 50,
                      totalTestFiles: 3,
                      filesWithAnyTests: 5,
                      filesWithoutTests: 45,
                      estimatedCoveragePercent: 10,
                      highRiskUntestedCount: 8,
                      mediumRiskUntestedCount: 12,
                      lastAnalyzedAt: new Date().toISOString(),
                    },
                    topHints: [],
                  })}
                  className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-[10px] transition-colors"
                >
                  🔴 LOW (10%)
                </button>
                <button
                  onClick={() => setExternalCoverageStats({
                    summary: {
                      totalSourceFiles: 50,
                      totalTestFiles: 15,
                      filesWithAnyTests: 25,
                      filesWithoutTests: 25,
                      estimatedCoveragePercent: 50,
                      highRiskUntestedCount: 3,
                      mediumRiskUntestedCount: 8,
                      lastAnalyzedAt: new Date().toISOString(),
                    },
                    topHints: [],
                  })}
                  className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded text-[10px] transition-colors"
                >
                  🟡 MEDIUM (50%)
                </button>
                <button
                  onClick={() => setExternalCoverageStats({
                    summary: {
                      totalSourceFiles: 50,
                      totalTestFiles: 40,
                      filesWithAnyTests: 45,
                      filesWithoutTests: 5,
                      estimatedCoveragePercent: 85,
                      highRiskUntestedCount: 0,
                      mediumRiskUntestedCount: 2,
                      lastAnalyzedAt: new Date().toISOString(),
                    },
                    topHints: [],
                  })}
                  className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded text-[10px] transition-colors"
                >
                  🟢 HIGH (85%)
                </button>
              </div>
              <div className="text-[9px] text-[#6b5f8a]/60 mt-1">
                Coverage Coach: {coverageCoach.status} | {coverageCoach.coveragePercent.toFixed(0)}% | Files: {coverageCoach.filesWithTests}/{coverageCoach.totalFiles}
              </div>
            </div>

            {/* Phase 139.0: ITG Debug */}
            <div className="space-y-1.5 pt-2 border-t border-[#251347]/20">
              <div className="text-[10px] text-[#e0dbff] mb-1 drop-shadow-[0_0_3px_rgba(255,255,255,0.3)]">
                ITG (Intelligent Test Generator):
              </div>
              <button
                onClick={() => generateSmartTests({ projectId: 'current-project' })}
                disabled={itgStatus === 'running'}
                className="w-full px-2 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 disabled:opacity-50 border border-purple-500/30 rounded text-[10px] text-purple-300 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>🧠</span>
                <span>
                  {itgStatus === 'running'
                    ? 'Generating...'
                    : 'Run ITG (stub)'}
                </span>
              </button>
              <div className="text-[9px] text-[#6b5f8a]/60 mt-1">
                ITG: {itgStatus} | Suggestions: {itgSuggestions.length}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectTestsView;
