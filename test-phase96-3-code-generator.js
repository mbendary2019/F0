#!/usr/bin/env node

/**
 * Test Script: Phase 96.3 - Code Generator Agent
 *
 * This script tests the complete code generation pipeline:
 * 1. Generate an ArchitectPlan
 * 2. Decompose into tasks
 * 3. Pick one task
 * 4. Generate code for that task
 * 5. Validate the output
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

async function testCodeGenerator() {
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
      userInput: 'عايز أعمل نظام authentication بسيط بـ Firebase',
      locale: 'ar',
      intentType: 'NEW_PROJECT',
    };

    log('Calling POST /api/agent/architect...', 'cyan');
    const architectRes = await fetch(`${BASE_URL}/api/agent/architect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(architectRequest),
    });

    if (!architectRes.ok) {
      throw new Error(`Architect API failed: ${architectRes.status}`);
    }

    const architectData = await architectRes.json();
    if (!architectData.ok) {
      throw new Error(`Architect failed: ${architectData.error}`);
    }

    const architectPlan = architectData.plan;
    log('✅ ArchitectPlan generated!', 'green');
    log(`   • Modules: ${architectPlan.modules.length}`, 'blue');
    log(`   • APIs: ${architectPlan.apis.length}`, 'blue');

    // ========================================================================
    // STEP 2: Decompose into Tasks
    // ========================================================================
    logSection('STEP 2: Decomposing into Tasks (Task Decomposer)');

    const decomposeRequest = {
      projectId: testProjectId,
      userId: testUserId,
      userInput: architectRequest.userInput,
      architectPlan: architectPlan,
      locale: 'ar',
      maxTasks: 20,
    };

    log('Calling POST /api/agent/decompose...', 'cyan');
    const decomposeRes = await fetch(`${BASE_URL}/api/agent/decompose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(decomposeRequest),
    });

    if (!decomposeRes.ok) {
      throw new Error(`Decompose API failed: ${decomposeRes.status}`);
    }

    const decomposeData = await decomposeRes.json();
    if (!decomposeData.ok) {
      throw new Error(`Task Decomposer failed: ${decomposeData.error}`);
    }

    const taskPlan = decomposeData.plan;
    log('✅ TaskDecompositionPlan generated!', 'green');
    log(`   • Total Tasks: ${taskPlan.allTasks.length}`, 'blue');

    // ========================================================================
    // STEP 3: Pick a Task to Implement
    // ========================================================================
    logSection('STEP 3: Selecting Task to Implement');

    // Pick first HIGH priority BACKEND task
    const selectedTask = taskPlan.allTasks.find(
      (t) => t.priority === 'HIGH' && (t.type === 'BACKEND' || t.type === 'FULLSTACK')
    ) || taskPlan.allTasks[0];

    log(`Selected Task:`, 'yellow');
    log(`   • ID: ${selectedTask.id}`, 'blue');
    log(`   • Title: ${selectedTask.title}`, 'blue');
    log(`   • Type: ${selectedTask.type}`, 'blue');
    log(`   • Priority: ${selectedTask.priority}`, 'blue');
    log(`   • Description: ${selectedTask.description.substring(0, 100)}...`, 'blue');

    // ========================================================================
    // STEP 4: Generate Code
    // ========================================================================
    logSection('STEP 4: Generating Code (Code Generator Agent)');

    const codeGenRequest = {
      projectId: testProjectId,
      userId: testUserId,
      userInput: architectRequest.userInput,
      task: selectedTask,
      architectPlan: architectPlan,
      fileTree: [
        'src/lib/firebase.ts',
        'src/lib/firebaseClient.ts',
        'src/app/api/test/route.ts',
      ],
      existingFiles: {},
      locale: 'ar',
    };

    log('Calling POST /api/agent/generate-code...', 'cyan');
    log('This may take 10-30 seconds...', 'yellow');

    const codeGenRes = await fetch(`${BASE_URL}/api/agent/generate-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(codeGenRequest),
    });

    if (!codeGenRes.ok) {
      throw new Error(`Code Generator API failed: ${codeGenRes.status}`);
    }

    const codeGenData = await codeGenRes.json();
    if (!codeGenData.ok) {
      throw new Error(`Code Generator failed: ${codeGenData.error}`);
    }

    const codePlan = codeGenData.plan;
    log('✅ CodeGenerationPlan generated!', 'green');
    log(`   • Summary: ${codePlan.summary}`, 'blue');
    log(`   • Actions: ${codePlan.actions.length}`, 'blue');
    log(`   • Diffs: ${codePlan.diffs.length}`, 'blue');

    // ========================================================================
    // STEP 5: Analyze Generated Code
    // ========================================================================
    logSection('STEP 5: Analyzing Generated Code');

    log('Actions:', 'yellow');
    codePlan.actions.forEach((action, idx) => {
      log(`   ${idx + 1}. ${action.action}`, 'cyan');
      if (action.action === 'WRITE_FILE' || action.action === 'UPDATE_FILE') {
        log(`      Path: ${action.path}`, 'blue');
      }
    });

    log('\nFile Diffs:', 'yellow');
    codePlan.diffs.forEach((diff, idx) => {
      log(`   ${idx + 1}. ${diff.operation} - ${diff.path}`, 'cyan');
      log(`      Language: ${diff.language || 'unknown'}`, 'blue');
      if (diff.newContent) {
        const lines = diff.newContent.split('\n').length;
        log(`      Lines: ${lines}`, 'blue');
      }
    });

    // ========================================================================
    // STEP 6: Show Sample Generated Code
    // ========================================================================
    logSection('STEP 6: Sample Generated Code');

    if (codePlan.diffs.length > 0) {
      const firstDiff = codePlan.diffs[0];
      log(`File: ${firstDiff.path}`, 'magenta');
      log(`Operation: ${firstDiff.operation}`, 'magenta');
      log(`Language: ${firstDiff.language}`, 'magenta');
      log('\nFirst 30 lines:', 'yellow');

      if (firstDiff.newContent) {
        const lines = firstDiff.newContent.split('\n').slice(0, 30);
        lines.forEach((line, idx) => {
          log(`${(idx + 1).toString().padStart(3, ' ')} | ${line}`, 'blue');
        });
        if (firstDiff.newContent.split('\n').length > 30) {
          log('... (truncated)', 'blue');
        }
      }
    }

    // ========================================================================
    // STEP 7: Validation Checks
    // ========================================================================
    logSection('STEP 7: Validation Checks');

    const checks = [];

    // Check 1: Actions match diffs
    checks.push({
      name: 'Number of actions matches diffs',
      pass: codePlan.actions.length === codePlan.diffs.length,
    });

    // Check 2: All diffs have valid paths
    const allHavePaths = codePlan.diffs.every((d) => d.path && d.path !== 'unknown');
    checks.push({
      name: 'All diffs have valid paths',
      pass: allHavePaths,
    });

    // Check 3: All CREATE/UPDATE diffs have content
    const allHaveContent = codePlan.diffs
      .filter((d) => d.operation === 'CREATE' || d.operation === 'UPDATE')
      .every((d) => d.newContent && d.newContent.length > 0);
    checks.push({
      name: 'All CREATE/UPDATE diffs have content',
      pass: allHaveContent,
    });

    // Check 4: Generated code has reasonable length
    const totalLines = codePlan.diffs.reduce((sum, d) => {
      const lines = d.newContent ? d.newContent.split('\n').length : 0;
      return sum + lines;
    }, 0);
    checks.push({
      name: `Generated code has reasonable length (${totalLines} lines total)`,
      pass: totalLines > 10 && totalLines < 2000,
    });

    // Check 5: Code uses TypeScript
    const hasTypeScript = codePlan.diffs.some(
      (d) => d.language === 'typescript' || d.path.endsWith('.ts') || d.path.endsWith('.tsx')
    );
    checks.push({
      name: 'Generated code uses TypeScript',
      pass: hasTypeScript,
    });

    // Check 6: No placeholder code
    const hasPlaceholders = codePlan.diffs.some((d) => {
      if (!d.newContent) return false;
      const lower = d.newContent.toLowerCase();
      return (
        lower.includes('// todo') ||
        lower.includes('// fixme') ||
        lower.includes('placeholder') ||
        lower.includes('implement this')
      );
    });
    checks.push({
      name: 'No placeholder code (// TODO, etc.)',
      pass: !hasPlaceholders,
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
      log(`\n✅ Phase 96.3 (Code Generator Agent) is working correctly!`, 'bright');
      log(`\nGenerated ${codePlan.actions.length} actions with ${totalLines} lines of code for task: ${selectedTask.title}`, 'blue');

      if (codePlan.notes) {
        log(`\nNotes from Code Generator:`, 'yellow');
        log(codePlan.notes, 'blue');
      }
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
testCodeGenerator()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
