#!/usr/bin/env node

/**
 * Test Script: Phase 96.2 - Task Decomposer Agent
 *
 * This script tests the complete Task Decomposer pipeline:
 * 1. Generate an ArchitectPlan using the Architect Agent
 * 2. Pass the plan to Task Decomposer
 * 3. Validate the output
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3030';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

async function testTaskDecomposer() {
  const testProjectId = `test-project-${Date.now()}`;
  const testUserId = 'test-user-123';

  try {
    // ========================================================================
    // STEP 1: Generate ArchitectPlan
    // ========================================================================
    logSection('STEP 1: Generating ArchitectPlan (Architect Agent)');

    const architectRequest = {
      projectId: testProjectId,
      userId: testUserId,
      userInput: 'عايز أعمل نظام إدارة مشاريع بسيط مع Firebase و Stripe للدفع',
      locale: 'ar',
      intentType: 'NEW_PROJECT',
    };

    log('Calling POST /api/agent/architect...', 'cyan');
    log(`Project ID: ${testProjectId}`, 'blue');
    log(`User Input: ${architectRequest.userInput}`, 'blue');

    const architectRes = await fetch(`${BASE_URL}/api/agent/architect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(architectRequest),
    });

    if (!architectRes.ok) {
      const errorText = await architectRes.text();
      throw new Error(
        `Architect API failed (${architectRes.status}): ${errorText}`
      );
    }

    const architectData = await architectRes.json();

    if (!architectData.ok) {
      throw new Error(`Architect failed: ${architectData.error}`);
    }

    const architectPlan = architectData.plan;

    log('✅ ArchitectPlan generated successfully!', 'green');
    log(`   • Summary: ${architectPlan.summary}`, 'blue');
    log(`   • Modules: ${architectPlan.modules.length}`, 'blue');
    log(`   • APIs: ${architectPlan.apis.length}`, 'blue');
    log(`   • Data Models: ${architectPlan.dataModels.length}`, 'blue');
    log(`   • Phases: ${architectPlan.phases.length}`, 'blue');
    log(`   • Complexity: ${architectPlan.complexity}`, 'blue');

    console.log('\nModules:');
    architectPlan.modules.forEach((m) => {
      log(`   - ${m.id} (${m.priority}): ${m.title}`, 'cyan');
    });

    console.log('\nPhases:');
    architectPlan.phases.forEach((p) => {
      log(`   - ${p.id} (Order ${p.order}): ${p.title}`, 'cyan');
    });

    // ========================================================================
    // STEP 2: Decompose into Tasks
    // ========================================================================
    logSection('STEP 2: Decomposing into Tasks (Task Decomposer Agent)');

    const decomposeRequest = {
      projectId: testProjectId,
      userId: testUserId,
      userInput: architectRequest.userInput,
      architectPlan: architectPlan,
      locale: 'ar',
      maxTasks: 40,
    };

    log('Calling POST /api/agent/decompose...', 'cyan');
    log(`Max Tasks: ${decomposeRequest.maxTasks}`, 'blue');

    const decomposeRes = await fetch(`${BASE_URL}/api/agent/decompose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(decomposeRequest),
    });

    if (!decomposeRes.ok) {
      const errorText = await decomposeRes.text();
      throw new Error(
        `Decompose API failed (${decomposeRes.status}): ${errorText}`
      );
    }

    const decomposeData = await decomposeRes.json();

    if (!decomposeData.ok) {
      throw new Error(`Task Decomposer failed: ${decomposeData.error}`);
    }

    const taskPlan = decomposeData.plan;

    log('✅ TaskDecompositionPlan generated successfully!', 'green');
    log(`   • Summary: ${taskPlan.summary}`, 'blue');
    log(`   • Groups: ${taskPlan.groups.length}`, 'blue');
    log(`   • Total Tasks: ${taskPlan.allTasks.length}`, 'blue');

    // ========================================================================
    // STEP 3: Analyze Task Breakdown
    // ========================================================================
    logSection('STEP 3: Analyzing Task Breakdown');

    const priorityCounts = {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    const typeCounts = {};

    taskPlan.allTasks.forEach((task) => {
      priorityCounts[task.priority] = (priorityCounts[task.priority] || 0) + 1;
      typeCounts[task.type] = (typeCounts[task.type] || 0) + 1;
    });

    log('Priority Distribution:', 'yellow');
    Object.entries(priorityCounts).forEach(([priority, count]) => {
      log(`   • ${priority}: ${count}`, 'blue');
    });

    log('\nTask Type Distribution:', 'yellow');
    Object.entries(typeCounts).forEach(([type, count]) => {
      log(`   • ${type}: ${count}`, 'blue');
    });

    log('\nEstimate Hours:', 'yellow');
    const totalHours = taskPlan.allTasks.reduce(
      (sum, t) => sum + (t.estimateHours || 0),
      0
    );
    log(`   • Total: ${totalHours} hours`, 'blue');
    log(
      `   • Average: ${(totalHours / taskPlan.allTasks.length).toFixed(1)} hours/task`,
      'blue'
    );

    // ========================================================================
    // STEP 4: Show Sample Tasks by Group
    // ========================================================================
    logSection('STEP 4: Sample Tasks by Group');

    taskPlan.groups.forEach((group, idx) => {
      log(`\nGroup ${idx + 1}: ${group.title}`, 'bright');
      log(`   Phase ID: ${group.phaseId || 'N/A'}`, 'blue');
      log(`   Module IDs: ${group.moduleIds?.join(', ') || 'N/A'}`, 'blue');
      log(`   Tasks: ${group.tasks.length}`, 'blue');

      // Show first 3 tasks in this group
      const samplesToShow = Math.min(3, group.tasks.length);
      for (let i = 0; i < samplesToShow; i++) {
        const task = group.tasks[i];
        log(`\n   Task ${i + 1}: ${task.title}`, 'cyan');
        log(`      • ID: ${task.id}`, 'blue');
        log(`      • Type: ${task.type}`, 'blue');
        log(`      • Priority: ${task.priority}`, 'blue');
        log(`      • Estimate: ${task.estimateHours || 'N/A'} hours`, 'blue');
        if (task.dependsOn && task.dependsOn.length > 0) {
          log(`      • Depends On: ${task.dependsOn.join(', ')}`, 'blue');
        }
        if (task.actionHints && task.actionHints.length > 0) {
          log(`      • Action Hints: ${task.actionHints.join(', ')}`, 'blue');
        }
        log(`      • Description: ${task.description.substring(0, 100)}...`, 'blue');
      }

      if (group.tasks.length > samplesToShow) {
        log(`\n   ... and ${group.tasks.length - samplesToShow} more tasks`, 'blue');
      }
    });

    // ========================================================================
    // STEP 5: Validation Checks
    // ========================================================================
    logSection('STEP 5: Validation Checks');

    const checks = [];

    // Check 1: All tasks have IDs
    const allHaveIds = taskPlan.allTasks.every((t) => t.id);
    checks.push({
      name: 'All tasks have IDs',
      pass: allHaveIds,
    });

    // Check 2: All tasks have titles
    const allHaveTitles = taskPlan.allTasks.every((t) => t.title);
    checks.push({
      name: 'All tasks have titles',
      pass: allHaveTitles,
    });

    // Check 3: All tasks linked to modules/phases where possible
    const linkedTasks = taskPlan.allTasks.filter(
      (t) => t.moduleId || t.phaseId
    ).length;
    const linkageRate = (linkedTasks / taskPlan.allTasks.length) * 100;
    checks.push({
      name: `Tasks linked to modules/phases (${linkageRate.toFixed(0)}% linked)`,
      pass: linkageRate > 50,
    });

    // Check 4: Dependencies are valid
    const invalidDeps = taskPlan.allTasks.filter((t) => {
      if (!t.dependsOn || t.dependsOn.length === 0) return false;
      return t.dependsOn.some(
        (depId) => !taskPlan.allTasks.find((x) => x.id === depId)
      );
    });
    checks.push({
      name: 'All dependencies reference valid task IDs',
      pass: invalidDeps.length === 0,
    });

    // Check 5: High-priority tasks exist
    const hasHighPriority = taskPlan.allTasks.some((t) => t.priority === 'HIGH');
    checks.push({
      name: 'At least one HIGH priority task',
      pass: hasHighPriority,
    });

    checks.forEach((check) => {
      if (check.pass) {
        log(`✅ ${check.name}`, 'green');
      } else {
        log(`❌ ${check.name}`, 'red');
      }
    });

    const allPassed = checks.every((c) => c.pass);

    // ========================================================================
    // FINAL RESULT
    // ========================================================================
    logSection('FINAL RESULT');

    if (allPassed) {
      log('🎉 All tests PASSED!', 'green');
      log(`\n✅ Phase 96.2 (Task Decomposer Agent) is working correctly!`, 'bright');
      log(`\nGenerated ${taskPlan.allTasks.length} tasks from ${architectPlan.modules.length} modules across ${architectPlan.phases.length} phases.`, 'blue');
    } else {
      log('⚠️  Some tests FAILED. Review validation results above.', 'yellow');
    }

    return allPassed;
  } catch (err) {
    log(`\n❌ Test failed with error:`, 'red');
    console.error(err);
    return false;
  }
}

// Run the test
testTaskDecomposer()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
