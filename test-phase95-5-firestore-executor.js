#!/usr/bin/env node

/**
 * Test Script: Phase 95.5 - Real Firestore Executor
 *
 * This script tests Firestore operations:
 * 1. CREATE_FIRESTORE_DOC
 * 2. UPDATE_FIRESTORE_DOC
 * 3. DELETE_FIRESTORE_DOC
 * 4. Multiple operations in sequence
 *
 * NOTE: Requires Firebase Emulator running (firestore)
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
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

async function testFirestoreExecutor() {
  try {
    // Check if emulator is running
    log('Checking if Firebase Emulator is running...', 'cyan');

    const testCollection = 'test_action_plans';
    const testDocId = `test-doc-${Date.now()}`;

    // Set emulator host
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

    // Import after setting env
    const { runActionPlan } = await import(
      './src/lib/agent/actions/runner/runActionPlan.ts'
    );

    log('✅ Firebase Emulator environment configured', 'green');

    // ========================================================================
    // TEST 1: CREATE_FIRESTORE_DOC
    // ========================================================================
    logSection('TEST 1: CREATE_FIRESTORE_DOC');

    const now = Date.now();
    const createPlan = {
      id: 'test-create-plan',
      projectId: 'test-project',
      summary: 'Test CREATE_FIRESTORE_DOC action',
      createdBy: 'user',
      createdAt: now,
      userIntent: 'Test Firestore create',
      autoExecuted: true,
      steps: [
        {
          index: 0,
          status: 'PENDING',
          action: {
            id: 'fs-create-1',
            action: 'CREATE_FIRESTORE_DOC',
            category: 'FIRESTORE',
            projectId: 'test-project',
            createdBy: 'user',
            createdAt: now,
            collectionPath: testCollection,
            docId: testDocId,
            data: {
              type: 'TEST',
              createdAt: now,
              status: 'CREATED',
              metadata: {
                source: 'test-script',
                version: '1.0',
              },
            },
          },
        },
      ],
    };

    log(`Executing CREATE_FIRESTORE_DOC for ${testCollection}/${testDocId}...`, 'cyan');
    const createResult = await runActionPlan(createPlan);

    const createStep = createResult.steps[0];
    log(`Status: ${createStep.status}`, 'blue');
    log(`Logs:`, 'yellow');
    createStep.result?.logs.forEach((l) => log(`   ${l}`, 'blue'));

    if (createStep.status === 'SUCCESS') {
      log('✅ Document created successfully!', 'green');
      log(`   Path: ${createStep.result?.output?.path}`, 'blue');
      log(`   Doc ID: ${createStep.result?.output?.docId}`, 'blue');
    } else {
      log('❌ Document creation failed', 'red');
    }

    // ========================================================================
    // TEST 2: UPDATE_FIRESTORE_DOC
    // ========================================================================
    logSection('TEST 2: UPDATE_FIRESTORE_DOC');

    const updatePlan = {
      id: 'test-update-plan',
      projectId: 'test-project',
      summary: 'Test UPDATE_FIRESTORE_DOC action',
      createdBy: 'user',
      createdAt: now,
      userIntent: 'Test Firestore update',
      autoExecuted: true,
      steps: [
        {
          index: 0,
          status: 'PENDING',
          action: {
            id: 'fs-update-1',
            action: 'UPDATE_FIRESTORE_DOC',
            category: 'FIRESTORE',
            projectId: 'test-project',
            createdBy: 'user',
            createdAt: now,
            collectionPath: testCollection,
            docId: testDocId,
            data: {
              status: 'UPDATED',
              updatedAt: now,
              metadata: {
                lastModified: now,
              },
            },
            merge: true,
          },
        },
      ],
    };

    log(`Executing UPDATE_FIRESTORE_DOC for ${testCollection}/${testDocId}...`, 'cyan');
    const updateResult = await runActionPlan(updatePlan);

    const updateStep = updateResult.steps[0];
    log(`Status: ${updateStep.status}`, 'blue');
    log(`Logs:`, 'yellow');
    updateStep.result?.logs.forEach((l) => log(`   ${l}`, 'blue'));

    if (updateStep.status === 'SUCCESS' && updateStep.result?.output?.updated) {
      log('✅ Document updated successfully!', 'green');
    } else {
      log('❌ Document update failed', 'red');
    }

    // ========================================================================
    // TEST 3: DELETE_FIRESTORE_DOC
    // ========================================================================
    logSection('TEST 3: DELETE_FIRESTORE_DOC');

    const deletePlan = {
      id: 'test-delete-plan',
      projectId: 'test-project',
      summary: 'Test DELETE_FIRESTORE_DOC action',
      createdBy: 'user',
      createdAt: now,
      userIntent: 'Test Firestore delete',
      autoExecuted: true,
      steps: [
        {
          index: 0,
          status: 'PENDING',
          action: {
            id: 'fs-delete-1',
            action: 'DELETE_FIRESTORE_DOC',
            category: 'FIRESTORE',
            projectId: 'test-project',
            createdBy: 'user',
            createdAt: now,
            collectionPath: testCollection,
            docId: testDocId,
          },
        },
      ],
    };

    log(`Executing DELETE_FIRESTORE_DOC for ${testCollection}/${testDocId}...`, 'cyan');
    const deleteResult = await runActionPlan(deletePlan);

    const deleteStep = deleteResult.steps[0];
    log(`Status: ${deleteStep.status}`, 'blue');
    log(`Logs:`, 'yellow');
    deleteStep.result?.logs.forEach((l) => log(`   ${l}`, 'blue'));

    if (deleteStep.status === 'SUCCESS' && deleteStep.result?.output?.deleted) {
      log('✅ Document deleted successfully!', 'green');
    } else {
      log('❌ Document deletion failed', 'red');
    }

    // ========================================================================
    // TEST 4: Multiple Operations in Sequence
    // ========================================================================
    logSection('TEST 4: Multiple Operations (Sequence)');

    const multiDocId1 = `multi-doc-1-${Date.now()}`;
    const multiDocId2 = `multi-doc-2-${Date.now()}`;

    const multiPlan = {
      id: 'test-multi-plan',
      projectId: 'test-project',
      summary: 'Test multiple Firestore operations',
      createdBy: 'user',
      createdAt: now,
      userIntent: 'Test sequential Firestore operations',
      autoExecuted: true,
      steps: [
        {
          index: 0,
          status: 'PENDING',
          action: {
            id: 'multi-1',
            action: 'CREATE_FIRESTORE_DOC',
            category: 'FIRESTORE',
            projectId: 'test-project',
            createdBy: 'user',
            createdAt: now,
            collectionPath: testCollection,
            docId: multiDocId1,
            data: {
              name: 'First Document',
              order: 1,
            },
          },
        },
        {
          index: 1,
          status: 'PENDING',
          action: {
            id: 'multi-2',
            action: 'CREATE_FIRESTORE_DOC',
            category: 'FIRESTORE',
            projectId: 'test-project',
            createdBy: 'user',
            createdAt: now,
            collectionPath: testCollection,
            docId: multiDocId2,
            data: {
              name: 'Second Document',
              order: 2,
            },
          },
        },
        {
          index: 2,
          status: 'PENDING',
          action: {
            id: 'multi-3',
            action: 'UPDATE_FIRESTORE_DOC',
            category: 'FIRESTORE',
            projectId: 'test-project',
            createdBy: 'user',
            createdAt: now,
            collectionPath: testCollection,
            docId: multiDocId1,
            data: {
              updated: true,
            },
            merge: true,
          },
        },
        {
          index: 3,
          status: 'PENDING',
          action: {
            id: 'multi-4',
            action: 'DELETE_FIRESTORE_DOC',
            category: 'FIRESTORE',
            projectId: 'test-project',
            createdBy: 'user',
            createdAt: now,
            collectionPath: testCollection,
            docId: multiDocId2,
          },
        },
      ],
    };

    log('Executing multiple Firestore operations...', 'cyan');
    const multiResult = await runActionPlan(multiPlan);

    multiResult.steps.forEach((step, idx) => {
      log(`\nStep ${idx + 1}: ${step.action.action}`, 'yellow');
      log(`   Status: ${step.status}`, 'blue');
      if (step.result?.logs) {
        step.result.logs.forEach((l) => log(`   ${l}`, 'blue'));
      }
    });

    const allMultiSuccess = multiResult.steps.every((s) => s.status === 'SUCCESS');
    if (allMultiSuccess) {
      log('\n✅ All multi-step operations succeeded!', 'green');
    } else {
      log('\n❌ Some multi-step operations failed', 'red');
    }

    // ========================================================================
    // FINAL RESULT
    // ========================================================================
    logSection('FINAL RESULT');

    const allSuccess =
      createStep.status === 'SUCCESS' &&
      updateStep.status === 'SUCCESS' &&
      deleteStep.status === 'SUCCESS' &&
      allMultiSuccess;

    if (allSuccess) {
      log('🎉 All tests PASSED!', 'green');
      log('\n✅ Phase 95.5 (Real Firestore Executor) is working correctly!', 'bright');
      log(
        `\nYou can verify the documents in Firebase Emulator UI:`,
        'cyan'
      );
      log('http://localhost:4000/firestore', 'blue');
      log(`Collection: ${testCollection}`, 'blue');
    } else {
      log('⚠️  Some tests FAILED. Review results above.', 'yellow');
    }

    return allSuccess;
  } catch (err) {
    log(`\n❌ Test failed with error:`, 'red');
    console.error(err);

    if (err.message?.includes('ECONNREFUSED')) {
      log('\n💡 Tip: Make sure Firebase Emulator is running:', 'yellow');
      log('   firebase emulators:start --only firestore', 'blue');
    }

    return false;
  }
}

// Run the test
testFirestoreExecutor()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
