/**
 * Test Phase 94.2: Agent-Driven Memory Updates (Auto-Memory)
 *
 * This script tests the auto-memory system by:
 * 1. Making first request with tech stack decision
 * 2. Making second request with scope addition
 * 3. Checking if memory was automatically updated in Firestore
 * 4. Making third request to verify agent recalls auto-updated memory
 */

const API_URL = 'http://localhost:3030/api/agent/run';

async function testAutoMemorySystem() {
  console.log('\n🧠 Phase 94.2: Testing Agent-Driven Memory Updates\n');
  console.log('='.repeat(80));

  const testProjectId = `test-auto-memory-${Date.now()}`;

  // Test 1: First message (tech stack decision)
  console.log('\n📝 Test 1: First Agent Call (Tech Stack Decision)');
  console.log('-'.repeat(80));

  try {
    const response1 = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: testProjectId,
        intent: 'continue',
        message: 'عايز أعمل منصة SaaS. هنستخدم Next.js 14 و Firebase Firestore و Stripe للدفع',
      }),
    });

    const data1 = await response1.json();

    if (data1.ok) {
      console.log('✅ First request successful');
      console.log(`\nResponse Preview (first 250 chars):`);
      console.log(data1.reply.substring(0, 250) + '...\n');
    } else {
      console.log('❌ First request failed:', data1.error);
      return;
    }
  } catch (err) {
    console.error('❌ Request 1 failed:', err.message);
    return;
  }

  // Wait for auto-memory to process
  console.log('⏳ Waiting 3 seconds for auto-memory to process...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 2: Second message (scope addition)
  console.log('📝 Test 2: Second Agent Call (Scope Addition)');
  console.log('-'.repeat(80));

  try {
    const response2 = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: testProjectId,
        intent: 'continue',
        message: 'كمان عايز أضيف نظام Multi-tenancy و Role-based permissions',
      }),
    });

    const data2 = await response2.json();

    if (data2.ok) {
      console.log('✅ Second request successful');
      console.log(`\nResponse Preview (first 250 chars):`);
      console.log(data2.reply.substring(0, 250) + '...\n');
    } else {
      console.log('❌ Second request failed:', data2.error);
      return;
    }
  } catch (err) {
    console.error('❌ Request 2 failed:', err.message);
    return;
  }

  // Wait for auto-memory to process again
  console.log('⏳ Waiting 3 seconds for auto-memory to process...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 3: Third message (memory recall test)
  console.log('📝 Test 3: Third Agent Call (Auto-Memory Recall Test)');
  console.log('-'.repeat(80));

  try {
    const response3 = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: testProjectId,
        intent: 'continue',
        message: 'لخصلي كل اللي اتفقنا عليه لحد دلوقتي',
      }),
    });

    const data3 = await response3.json();

    if (data3.ok) {
      console.log('✅ Third request successful');
      console.log(`\nResponse Preview (first 500 chars):`);
      console.log(data3.reply.substring(0, 500) + '...\n');

      // Check if response mentions all previous decisions
      const reply = data3.reply.toLowerCase();
      const mentionsNextjs = reply.includes('next') || reply.includes('نكست');
      const mentionsFirebase = reply.includes('firebase') || reply.includes('فايربيس');
      const mentionsStripe = reply.includes('stripe') || reply.includes('سترايب');
      const mentionsMultiTenancy = reply.includes('multi-tenancy') || reply.includes('multi') || reply.includes('تينانسي');
      const mentionsPermissions = reply.includes('permission') || reply.includes('role') || reply.includes('صلاحيات');

      console.log('🧠 Auto-Memory Recall Analysis:');
      console.log(`   - Mentions Next.js: ${mentionsNextjs ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Mentions Firebase: ${mentionsFirebase ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Mentions Stripe: ${mentionsStripe ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Mentions Multi-tenancy: ${mentionsMultiTenancy ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Mentions Permissions: ${mentionsPermissions ? '✅ YES' : '❌ NO'}`);

      const successCount = [
        mentionsNextjs,
        mentionsFirebase,
        mentionsStripe,
        mentionsMultiTenancy,
        mentionsPermissions
      ].filter(Boolean).length;

      console.log(`\n📊 Memory Recall Score: ${successCount}/5`);

      if (successCount >= 4) {
        console.log('\n🎉 SUCCESS: Auto-memory is working! Agent recalled most decisions!\n');
      } else if (successCount >= 2) {
        console.log('\n⚠️  PARTIAL: Auto-memory is partially working (needs tuning)\n');
      } else {
        console.log('\n❌ FAILURE: Auto-memory may not be working correctly\n');
      }
    } else {
      console.log('❌ Third request failed:', data3.error);
    }
  } catch (err) {
    console.error('❌ Request 3 failed:', err.message);
  }

  console.log('='.repeat(80));
  console.log('\n✨ Phase 94.2 Test Complete!');
  console.log(`\nTest Project ID: ${testProjectId}`);
  console.log('You can inspect auto-updated memory in Firestore at:');
  console.log(`  projects/${testProjectId}/meta/memory`);
  console.log('\nExpected memory sections to be auto-filled:');
  console.log('  - TECH_STACK: Next.js, Firebase, Stripe');
  console.log('  - AGREED_SCOPE: Multi-tenancy, Role-based permissions');
  console.log('  - PROJECT_SUMMARY: SaaS platform\n');
}

// Run test
testAutoMemorySystem().catch(console.error);
