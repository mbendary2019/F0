#!/usr/bin/env node

/**
 * Test Script: Phase 95.4 - Real File System Executor
 *
 * This script tests the complete file system execution:
 * 1. Create ActionPlan with file operations
 * 2. Execute using runActionPlan
 * 3. Verify files were created/modified/deleted
 */

const fs = require('fs/promises');
const path = require('path');

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

async function testFileSystemExecutor() {
  // Use a sandbox directory for testing
  const sandboxDir = path.resolve(process.cwd(), 'sandbox-test-fs');

  try {
    // ========================================================================
    // SETUP: Create sandbox directory
    // ========================================================================
    logSection('SETUP: Creating Sandbox Directory');

    log(`Creating sandbox: ${sandboxDir}`, 'cyan');
    await fs.mkdir(sandboxDir, { recursive: true });
    log('✅ Sandbox created', 'green');

    // Set environment variable for workspace root
    process.env.F0_WORKSPACE_ROOT = sandboxDir;

    // Import after setting env variable
    const { runActionPlan } = await import('./src/lib/agent/actions/runner/runActionPlan.ts');

    // ========================================================================
    // TEST 1: WRITE_FILE
    // ========================================================================
    logSection('TEST 1: WRITE_FILE');

    const writePlan = {
      id: 'test-write-plan',
      projectId: 'test-project',
      summary: 'Test WRITE_FILE action',
      createdBy: 'user',
      createdAt: Date.now(),
      userIntent: 'Test file writing',
      autoExecuted: true,
      steps: [
        {
          index: 0,
          status: 'PENDING',
          action: {
            id: 'write-1',
            action: 'WRITE_FILE',
            category: 'FILE_SYSTEM',
            projectId: 'test-project',
            createdBy: 'user',
            createdAt: Date.now(),
            path: 'test-file.txt',
            content: 'Hello from F0 File System Executor!\n\nThis file was created by the action runner.',
          },
        },
      ],
    };

    log('Executing WRITE_FILE action...', 'cyan');
    const writeResult = await runActionPlan(writePlan);

    const writeStep = writeResult.steps[0];
    log(`Status: ${writeStep.status}`, 'blue');
    log(`Logs:`, 'yellow');
    writeStep.result?.logs.forEach(l => log(`   ${l}`, 'blue'));

    // Verify file was created
    const testFilePath = path.join(sandboxDir, 'test-file.txt');
    const fileExists = await fs.access(testFilePath).then(() => true).catch(() => false);
    const fileContent = fileExists ? await fs.readFile(testFilePath, 'utf8') : null;

    if (fileExists && fileContent) {
      log('✅ File created successfully!', 'green');
      log(`   Content length: ${fileContent.length} chars`, 'blue');
      log(`   First line: ${fileContent.split('\n')[0]}`, 'blue');
    } else {
      log('❌ File was not created', 'red');
    }

    // ========================================================================
    // TEST 2: UPDATE_FILE
    // ========================================================================
    logSection('TEST 2: UPDATE_FILE');

    const updatePlan = {
      id: 'test-update-plan',
      projectId: 'test-project',
      summary: 'Test UPDATE_FILE action',
      createdBy: 'user',
      createdAt: Date.now(),
      userIntent: 'Test file updating',
      autoExecuted: true,
      steps: [
        {
          index: 0,
          status: 'PENDING',
          action: {
            id: 'update-1',
            action: 'UPDATE_FILE',
            category: 'FILE_SYSTEM',
            projectId: 'test-project',
            createdBy: 'user',
            createdAt: Date.now(),
            path: 'test-file.txt',
            newContent: 'This file has been UPDATED!\n\nOriginal content replaced.',
          },
        },
      ],
    };

    log('Executing UPDATE_FILE action...', 'cyan');
    const updateResult = await runActionPlan(updatePlan);

    const updateStep = updateResult.steps[0];
    log(`Status: ${updateStep.status}`, 'blue');
    log(`Logs:`, 'yellow');
    updateStep.result?.logs.forEach(l => log(`   ${l}`, 'blue'));

    // Verify file was updated
    const updatedContent = await fs.readFile(testFilePath, 'utf8');
    if (updatedContent.includes('UPDATED')) {
      log('✅ File updated successfully!', 'green');
      log(`   New content: ${updatedContent.split('\n')[0]}`, 'blue');
    } else {
      log('❌ File was not updated', 'red');
    }

    // ========================================================================
    // TEST 3: MKDIR
    // ========================================================================
    logSection('TEST 3: MKDIR');

    const mkdirPlan = {
      id: 'test-mkdir-plan',
      projectId: 'test-project',
      summary: 'Test MKDIR action',
      createdBy: 'user',
      createdAt: Date.now(),
      userIntent: 'Test directory creation',
      autoExecuted: true,
      steps: [
        {
          index: 0,
          status: 'PENDING',
          action: {
            id: 'mkdir-1',
            action: 'MKDIR',
            category: 'FILE_SYSTEM',
            projectId: 'test-project',
            createdBy: 'user',
            createdAt: Date.now(),
            path: 'nested/deep/directory',
          },
        },
      ],
    };

    log('Executing MKDIR action...', 'cyan');
    const mkdirResult = await runActionPlan(mkdirPlan);

    const mkdirStep = mkdirResult.steps[0];
    log(`Status: ${mkdirStep.status}`, 'blue');
    log(`Logs:`, 'yellow');
    mkdirStep.result?.logs.forEach(l => log(`   ${l}`, 'blue'));

    // Verify directory was created
    const dirPath = path.join(sandboxDir, 'nested/deep/directory');
    const dirExists = await fs.access(dirPath).then(() => true).catch(() => false);

    if (dirExists) {
      log('✅ Directory created successfully!', 'green');
      log(`   Path: ${dirPath}`, 'blue');
    } else {
      log('❌ Directory was not created', 'red');
    }

    // ========================================================================
    // TEST 4: DELETE_FILE
    // ========================================================================
    logSection('TEST 4: DELETE_FILE');

    const deletePlan = {
      id: 'test-delete-plan',
      projectId: 'test-project',
      summary: 'Test DELETE_FILE action',
      createdBy: 'user',
      createdAt: Date.now(),
      userIntent: 'Test file deletion',
      autoExecuted: true,
      steps: [
        {
          index: 0,
          status: 'PENDING',
          action: {
            id: 'delete-1',
            action: 'DELETE_FILE',
            category: 'FILE_SYSTEM',
            projectId: 'test-project',
            createdBy: 'user',
            createdAt: Date.now(),
            path: 'test-file.txt',
          },
        },
      ],
    };

    log('Executing DELETE_FILE action...', 'cyan');
    const deleteResult = await runActionPlan(deletePlan);

    const deleteStep = deleteResult.steps[0];
    log(`Status: ${deleteStep.status}`, 'blue');
    log(`Logs:`, 'yellow');
    deleteStep.result?.logs.forEach(l => log(`   ${l}`, 'blue'));

    // Verify file was deleted
    const fileStillExists = await fs.access(testFilePath).then(() => true).catch(() => false);

    if (!fileStillExists) {
      log('✅ File deleted successfully!', 'green');
    } else {
      log('❌ File was not deleted', 'red');
    }

    // ========================================================================
    // TEST 5: Multiple Operations in Sequence
    // ========================================================================
    logSection('TEST 5: Multiple Operations (Sequence)');

    const multiPlan = {
      id: 'test-multi-plan',
      projectId: 'test-project',
      summary: 'Test multiple file operations',
      createdBy: 'user',
      createdAt: Date.now(),
      userIntent: 'Test sequential operations',
      autoExecuted: true,
      steps: [
        {
          index: 0,
          status: 'PENDING',
          action: {
            id: 'multi-1',
            action: 'MKDIR',
            category: 'FILE_SYSTEM',
            projectId: 'test-project',
            createdBy: 'user',
            createdAt: Date.now(),
            path: 'output',
          },
        },
        {
          index: 1,
          status: 'PENDING',
          action: {
            id: 'multi-2',
            action: 'WRITE_FILE',
            category: 'FILE_SYSTEM',
            projectId: 'test-project',
            createdBy: 'user',
            createdAt: Date.now(),
            path: 'output/readme.md',
            content: '# Test Project\n\nThis is a test file created by F0 Agent.',
          },
        },
        {
          index: 2,
          status: 'PENDING',
          action: {
            id: 'multi-3',
            action: 'WRITE_FILE',
            category: 'FILE_SYSTEM',
            projectId: 'test-project',
            createdBy: 'user',
            createdAt: Date.now(),
            path: 'output/config.json',
            content: JSON.stringify({ version: '1.0.0', name: 'F0 Test' }, null, 2),
          },
        },
      ],
    };

    log('Executing multiple operations...', 'cyan');
    const multiResult = await runActionPlan(multiPlan);

    multiResult.steps.forEach((step, idx) => {
      log(`\nStep ${idx + 1}: ${step.action.action}`, 'yellow');
      log(`   Status: ${step.status}`, 'blue');
      if (step.result?.logs) {
        step.result.logs.forEach(l => log(`   ${l}`, 'blue'));
      }
    });

    // Verify all files were created
    const outputReadme = path.join(sandboxDir, 'output/readme.md');
    const outputConfig = path.join(sandboxDir, 'output/config.json');

    const readmeExists = await fs.access(outputReadme).then(() => true).catch(() => false);
    const configExists = await fs.access(outputConfig).then(() => true).catch(() => false);

    if (readmeExists && configExists) {
      log('\n✅ All files created successfully!', 'green');
      const readmeContent = await fs.readFile(outputReadme, 'utf8');
      const configContent = await fs.readFile(outputConfig, 'utf8');
      log(`   readme.md: ${readmeContent.split('\n')[0]}`, 'blue');
      log(`   config.json: ${JSON.parse(configContent).name}`, 'blue');
    } else {
      log('\n❌ Some files were not created', 'red');
    }

    // ========================================================================
    // FINAL RESULT
    // ========================================================================
    logSection('FINAL RESULT');

    const allSuccess =
      writeStep.status === 'SUCCESS' &&
      updateStep.status === 'SUCCESS' &&
      mkdirStep.status === 'SUCCESS' &&
      deleteStep.status === 'SUCCESS' &&
      multiResult.steps.every(s => s.status === 'SUCCESS');

    if (allSuccess) {
      log('🎉 All tests PASSED!', 'green');
      log('\n✅ Phase 95.4 (Real File System Executor) is working correctly!', 'bright');
      log(`\nFiles created in: ${sandboxDir}`, 'blue');
      log('You can inspect the files manually to verify the results.', 'cyan');
    } else {
      log('⚠️  Some tests FAILED. Review results above.', 'yellow');
    }

    return allSuccess;

  } catch (err) {
    log(`\n❌ Test failed with error:`, 'red');
    console.error(err);
    return false;
  } finally {
    // Optional: Clean up sandbox
    log(`\n🧹 To clean up, run: rm -rf ${sandboxDir}`, 'yellow');
  }
}

// Run the test
testFileSystemExecutor()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
