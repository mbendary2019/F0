#!/usr/bin/env node

/**
 * Test Script: Phase 97 - Implementation Pipeline Orchestrator
 *
 * This script tests the complete end-to-end orchestrator:
 * 1. Architect Agent → Architecture
 * 2. Task Decomposer → Tasks
 * 3. Code Generator → Code (for selected tasks)
 * 4. (Optional) Action Runner → Execution
 *
 * Tests all three modes:
 * - PLAN_ONLY: Architecture + Tasks only
 * - PLAN_AND_CODE: Architecture + Tasks + Code (no execution)
 * - FULL_AUTO: Complete pipeline with execution
 */

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

async function testOrchestrator() {
  try {
    const { runImplementationPipeline } = await import(
      './src/lib/agent/orchestrator/implementationPipeline.ts'
    );

    // ========================================================================
    // TEST 1: PLAN_ONLY Mode
    // ========================================================================
    logSection('TEST 1: PLAN_ONLY Mode (Architecture + Tasks Only)');

    log('Running orchestrator in PLAN_ONLY mode...', 'cyan');
    log('This will generate architecture and tasks without code generation.', 'blue');

    const planOnlyResult = await runImplementationPipeline({
      projectId: 'test-orchestrator-project',
      userId: 'test-user-123',
      userInput: 'عايز أعمل نظام authentication بسيط مع email و password',
      locale: 'ar',
      mode: 'PLAN_ONLY',
      maxTasks: 5,
      taskSelectionStrategy: 'HIGH_PRIORITY_FIRST',
    });

    log('\n✅ PLAN_ONLY completed!', 'green');
    log(`   • Mode: ${planOnlyResult.mode}`, 'blue');
    log(`   • Modules: ${planOnlyResult.architectPlan.modules?.length || 0}`, 'blue');
    log(`   • APIs: ${planOnlyResult.architectPlan.apis?.length || 0}`, 'blue');
    log(`   • Total Tasks: ${planOnlyResult.taskPlan.allTasks?.length || 0}`, 'blue');
    log(`   • Selected Tasks: ${planOnlyResult.selectedTasks.length}`, 'blue');
    log(`   • Code Plans: ${planOnlyResult.codeGenPlans.length} (expected: 0)`, 'blue');
    log(`   • Action Plans: ${planOnlyResult.actionPlans.length} (expected: 0)`, 'blue');

    // Validation
    const planOnlyValid =
      planOnlyResult.mode === 'PLAN_ONLY' &&
      planOnlyResult.architectPlan.modules?.length > 0 &&
      planOnlyResult.taskPlan.allTasks?.length > 0 &&
      planOnlyResult.selectedTasks.length > 0 &&
      planOnlyResult.codeGenPlans.length === 0 &&
      planOnlyResult.actionPlans.length === 0;

    if (!planOnlyValid) {
      log('❌ PLAN_ONLY validation failed', 'red');
      return false;
    }

    log('✅ PLAN_ONLY validation passed', 'green');

    // ========================================================================
    // TEST 2: PLAN_AND_CODE Mode
    // ========================================================================
    logSection('TEST 2: PLAN_AND_CODE Mode (Architecture + Tasks + Code)');

    log('Running orchestrator in PLAN_AND_CODE mode...', 'cyan');
    log('This will generate architecture, tasks, AND code (but not execute).', 'blue');
    log('⏳ This may take 30-60 seconds...', 'yellow');

    const planAndCodeResult = await runImplementationPipeline({
      projectId: 'test-orchestrator-project-2',
      userId: 'test-user-123',
      userInput: 'عايز أعمل API endpoint للـ signup مع validation',
      locale: 'ar',
      mode: 'PLAN_AND_CODE',
      maxTasks: 2, // Only 2 tasks to speed up test
      taskSelectionStrategy: 'HIGH_PRIORITY_FIRST',
    });

    log('\n✅ PLAN_AND_CODE completed!', 'green');
    log(`   • Mode: ${planAndCodeResult.mode}`, 'blue');
    log(`   • Modules: ${planAndCodeResult.architectPlan.modules?.length || 0}`, 'blue');
    log(`   • APIs: ${planAndCodeResult.architectPlan.apis?.length || 0}`, 'blue');
    log(`   • Total Tasks: ${planAndCodeResult.taskPlan.allTasks?.length || 0}`, 'blue');
    log(`   • Selected Tasks: ${planAndCodeResult.selectedTasks.length}`, 'blue');
    log(`   • Code Plans: ${planAndCodeResult.codeGenPlans.length}`, 'blue');
    log(`   • Action Plans: ${planAndCodeResult.actionPlans.length}`, 'blue');
    log(`   • Executed Plans: ${planAndCodeResult.executedPlans.length} (expected: 0)`, 'blue');

    // Show selected tasks
    log('\nSelected Tasks:', 'yellow');
    planAndCodeResult.selectedTasks.forEach((task, idx) => {
      log(`   ${idx + 1}. [${task.priority}] ${task.title}`, 'cyan');
    });

    // Show generated code summary
    log('\nGenerated Code Summary:', 'yellow');
    planAndCodeResult.codeGenPlans.forEach((plan, idx) => {
      log(`   Task ${idx + 1}:`, 'cyan');
      log(`      Summary: ${plan.summary}`, 'blue');
      log(`      Actions: ${plan.actions?.length || 0}`, 'blue');
      log(`      Diffs: ${plan.diffs?.length || 0}`, 'blue');

      // Show file paths
      if (plan.diffs && plan.diffs.length > 0) {
        log('      Files:', 'blue');
        plan.diffs.forEach((diff) => {
          log(`         - [${diff.operation}] ${diff.path}`, 'cyan');
        });
      }
    });

    // Validation
    const planAndCodeValid =
      planAndCodeResult.mode === 'PLAN_AND_CODE' &&
      planAndCodeResult.selectedTasks.length > 0 &&
      planAndCodeResult.codeGenPlans.length === planAndCodeResult.selectedTasks.length &&
      planAndCodeResult.actionPlans.length === planAndCodeResult.selectedTasks.length &&
      planAndCodeResult.executedPlans.length === 0;

    if (!planAndCodeValid) {
      log('❌ PLAN_AND_CODE validation failed', 'red');
      return false;
    }

    log('✅ PLAN_AND_CODE validation passed', 'green');

    // ========================================================================
    // TEST 3: FULL_AUTO Mode (Optional - commented out by default)
    // ========================================================================
    logSection('TEST 3: FULL_AUTO Mode (SKIPPED - Uncomment to test)');

    log('⚠️  FULL_AUTO mode is commented out by default.', 'yellow');
    log('It would execute real file/Firestore operations.', 'yellow');
    log('To test it, uncomment the code below in the test script.', 'yellow');

    /*
    // UNCOMMENT TO TEST FULL_AUTO MODE:

    log('Running orchestrator in FULL_AUTO mode...', 'cyan');
    log('This will generate architecture, tasks, code, AND EXECUTE actions.', 'blue');
    log('⏳ This may take 60-120 seconds...', 'yellow');

    const fullAutoResult = await runImplementationPipeline({
      projectId: 'test-orchestrator-project-3',
      userId: 'test-user-123',
      userInput: 'عايز أعمل ملف config بسيط في src/config/app.ts',
      locale: 'ar',
      mode: 'FULL_AUTO',
      maxTasks: 1, // Only 1 task to minimize side effects
      taskSelectionStrategy: 'HIGH_PRIORITY_FIRST',
    });

    log('\n✅ FULL_AUTO completed!', 'green');
    log(`   • Mode: ${fullAutoResult.mode}`, 'blue');
    log(`   • Selected Tasks: ${fullAutoResult.selectedTasks.length}`, 'blue');
    log(`   • Code Plans: ${fullAutoResult.codeGenPlans.length}`, 'blue');
    log(`   • Action Plans: ${fullAutoResult.actionPlans.length}`, 'blue');
    log(`   • Executed Plans: ${fullAutoResult.executedPlans.length}`, 'blue');

    // Show execution results
    log('\nExecution Results:', 'yellow');
    fullAutoResult.executedPlans.forEach((execPlan, idx) => {
      log(`   Plan ${idx + 1}:`, 'cyan');
      log(`      Summary: ${execPlan.summary}`, 'blue');
      log(`      Status: ${execPlan.status}`, execPlan.status === 'SUCCESS' ? 'green' : 'yellow');
      log(`      Steps: ${execPlan.successfulSteps}/${execPlan.totalSteps}`, 'blue');
    });

    // Validation
    const fullAutoValid =
      fullAutoResult.mode === 'FULL_AUTO' &&
      fullAutoResult.executedPlans.length > 0;

    if (!fullAutoValid) {
      log('❌ FULL_AUTO validation failed', 'red');
      return false;
    }

    log('✅ FULL_AUTO validation passed', 'green');
    */

    // ========================================================================
    // FINAL RESULT
    // ========================================================================
    logSection('FINAL RESULT');

    log('🎉 All orchestrator tests PASSED!', 'green');
    log('\n✅ Phase 97 (Implementation Pipeline Orchestrator) is working correctly!', 'bright');

    log('\n📊 Test Summary:', 'cyan');
    log(`   ✅ PLAN_ONLY: Generated ${planOnlyResult.selectedTasks.length} tasks`, 'green');
    log(
      `   ✅ PLAN_AND_CODE: Generated code for ${planAndCodeResult.selectedTasks.length} tasks`,
      'green'
    );
    log('   ⚠️  FULL_AUTO: Skipped (uncomment to test execution)', 'yellow');

    log('\n🚀 Next Steps:', 'magenta');
    log('   1. Test the API endpoint:', 'cyan');
    log('      curl -X POST http://localhost:3030/api/agent/implement \\', 'blue');
    log('        -H "Content-Type: application/json" \\', 'blue');
    log('        -d \'{"projectId":"test","userId":"user","userInput":"عايز أعمل auth"}\'', 'blue');
    log('   2. Build a Web UI to visualize the pipeline results', 'cyan');
    log('   3. Add more executor types (ENV, Deploy, etc.)', 'cyan');

    return true;
  } catch (err) {
    log(`\n❌ Test failed with error:`, 'red');
    console.error(err);

    if (err.message?.includes('Cannot find module')) {
      log('\n💡 Tip: Make sure all agent modules are properly implemented:', 'yellow');
      log('   - architectAgent.ts', 'blue');
      log('   - taskDecomposerAgent.ts', 'blue');
      log('   - codeGeneratorAgent.ts', 'blue');
    }

    return false;
  }
}

// Run the test
testOrchestrator()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
