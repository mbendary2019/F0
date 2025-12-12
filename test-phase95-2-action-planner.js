/**
 * Test Phase 95.2: Action Planner Agent
 *
 * This script tests the action planner by:
 * 1. Calling planActions() with a user request
 * 2. Verifying the returned ActionPlan structure
 * 3. Checking that all actions are properly formatted
 * 4. Displaying the plan in a readable format
 */

// Note: This test needs to be run with proper TypeScript/Node setup
// For now, we'll use a simple HTTP test approach

const API_URL = 'http://localhost:3030/api/agent/plan';

async function testActionPlanner() {
  console.log('\n🎯 Phase 95.2: Testing Action Planner Agent\n');
  console.log('='.repeat(80));

  const testProjectId = `test-planner-${Date.now()}`;

  // Test 1: Simple file creation request
  console.log('\n📝 Test 1: Simple File Creation Request');
  console.log('-'.repeat(80));

  try {
    const response1 = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: testProjectId,
        userId: 'test-user-123',
        userInput: 'عايز أعمل ملف جديد اسمه src/lib/stripe.ts فيه Stripe client',
        locale: 'ar',
      }),
    });

    const data1 = await response1.json();

    if (data1.ok && data1.plan) {
      console.log('✅ Planner responded successfully');
      console.log(`\nPlan ID: ${data1.plan.id}`);
      console.log(`Summary: ${data1.plan.summary}`);
      console.log(`Steps Count: ${data1.plan.steps.length}`);
      console.log('\nSteps:');

      data1.plan.steps.forEach((step, idx) => {
        console.log(`  ${idx + 1}. [${step.action.action}] ${step.action.description || step.action.path || step.action.key || 'N/A'}`);
      });

      // Validate structure
      let validationErrors = [];

      if (!data1.plan.id) validationErrors.push('Missing plan.id');
      if (!data1.plan.projectId) validationErrors.push('Missing plan.projectId');
      if (!data1.plan.summary) validationErrors.push('Missing plan.summary');
      if (!Array.isArray(data1.plan.steps)) validationErrors.push('steps is not an array');

      data1.plan.steps.forEach((step, idx) => {
        if (!step.action) validationErrors.push(`Step ${idx}: missing action`);
        if (!step.action.action) validationErrors.push(`Step ${idx}: missing action.action`);
        if (!step.action.id) validationErrors.push(`Step ${idx}: missing action.id`);
        if (!step.action.projectId) validationErrors.push(`Step ${idx}: missing action.projectId`);
        if (!step.action.category) validationErrors.push(`Step ${idx}: missing action.category`);
        if (step.status !== 'PENDING') validationErrors.push(`Step ${idx}: status should be PENDING`);
      });

      if (validationErrors.length > 0) {
        console.log('\n⚠️  Validation Errors:');
        validationErrors.forEach(err => console.log(`   - ${err}`));
      } else {
        console.log('\n✅ Plan structure is valid!');
      }
    } else {
      console.log('❌ Planner failed:', data1.error);
      return;
    }
  } catch (err) {
    console.error('❌ Test 1 failed:', err.message);
    return;
  }

  // Wait before next test
  console.log('\n⏳ Waiting 2 seconds before next test...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Complex multi-action request
  console.log('📝 Test 2: Complex Multi-Action Request (Stripe Integration)');
  console.log('-'.repeat(80));

  try {
    const response2 = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: testProjectId,
        userId: 'test-user-123',
        userInput: 'عايز أضيف Stripe payment processing كامل - ملفات الكود، ENV variables، و تحديث الذاكرة',
        locale: 'ar',
        additionalContext: 'Current tech stack: Next.js 14, Firebase, TypeScript',
      }),
    });

    const data2 = await response2.json();

    if (data2.ok && data2.plan) {
      console.log('✅ Planner responded successfully');
      console.log(`\nPlan ID: ${data2.plan.id}`);
      console.log(`Summary: ${data2.plan.summary}`);
      console.log(`Steps Count: ${data2.plan.steps.length}`);
      console.log('\nDetailed Steps:');

      data2.plan.steps.forEach((step, idx) => {
        console.log(`\n  ${idx + 1}. [${step.action.action}] - ${step.action.category}`);
        console.log(`     Status: ${step.status}`);

        if (step.action.action === 'WRITE_FILE' || step.action.action === 'UPDATE_FILE') {
          console.log(`     Path: ${step.action.path}`);
          console.log(`     Content Length: ${step.action.content?.length || step.action.newContent?.length || 0} chars`);
        } else if (step.action.action === 'UPDATE_ENV') {
          console.log(`     Key: ${step.action.key}`);
          console.log(`     Scope: ${step.action.scope}`);
        } else if (step.action.action === 'APPEND_MEMORY_NOTE' || step.action.action === 'SET_MEMORY_SECTION') {
          console.log(`     Section: ${step.action.sectionId}`);
          console.log(`     Note: ${step.action.note || step.action.content || 'N/A'}`);
        }
      });

      // Check for expected action types
      const actionTypes = data2.plan.steps.map(s => s.action.action);
      const hasFileAction = actionTypes.some(a => a === 'WRITE_FILE' || a === 'UPDATE_FILE');
      const hasEnvAction = actionTypes.includes('UPDATE_ENV');
      const hasMemoryAction = actionTypes.some(a => a === 'APPEND_MEMORY_NOTE' || a === 'SET_MEMORY_SECTION');

      console.log('\n📊 Action Type Analysis:');
      console.log(`   - Has File Action: ${hasFileAction ? '✅' : '❌'}`);
      console.log(`   - Has ENV Action: ${hasEnvAction ? '✅' : '❌'}`);
      console.log(`   - Has Memory Action: ${hasMemoryAction ? '✅' : '❌'}`);

      if (hasFileAction && hasEnvAction && hasMemoryAction) {
        console.log('\n🎉 SUCCESS: Planner generated a complete multi-action plan!');
      } else {
        console.log('\n⚠️  WARNING: Plan may be incomplete (missing some action types)');
      }
    } else {
      console.log('❌ Planner failed:', data2.error);
    }
  } catch (err) {
    console.error('❌ Test 2 failed:', err.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✨ Phase 95.2 Tests Complete!');
  console.log(`\nTest Project ID: ${testProjectId}`);
  console.log('Next step: Implement Phase 95.3 (Action Runner) to execute these plans\n');
}

// Run tests
testActionPlanner().catch(console.error);
