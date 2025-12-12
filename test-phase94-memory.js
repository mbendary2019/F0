/**
 * Test Phase 94.1: Project Memory System
 *
 * This script tests the memory system by:
 * 1. Making first request (should initialize empty memory)
 * 2. Making second request (should include memory from first request)
 * 3. Verifying memory persistence
 */

const API_URL = 'http://localhost:3030/api/agent/run';

async function testMemorySystem() {
  console.log('\n🧠 Phase 94.1: Testing Project Memory System\n');
  console.log('=' .repeat(80));

  const testProjectId = `test-memory-${Date.now()}`;

  // Test 1: First message (should create memory)
  console.log('\n📝 Test 1: First Agent Call (Memory Initialization)');
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
        message: 'عايز أعمل منصة SaaS لإدارة المشاريع مع Firebase و Stripe',
      }),
    });

    const data1 = await response1.json();

    if (data1.ok) {
      console.log('✅ First request successful');
      console.log(`\nResponse Preview (first 300 chars):`);
      console.log(data1.reply.substring(0, 300) + '...\n');
    } else {
      console.log('❌ First request failed:', data1.error);
      return;
    }
  } catch (err) {
    console.error('❌ Request 1 failed:', err.message);
    return;
  }

  // Wait a bit before second request
  console.log('\n⏳ Waiting 2 seconds before second request...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Second message (should remember first one)
  console.log('📝 Test 2: Second Agent Call (Memory Recall)');
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
        message: 'طيب ايه التقنيات اللي اتفقنا عليها؟',
      }),
    });

    const data2 = await response2.json();

    if (data2.ok) {
      console.log('✅ Second request successful');
      console.log(`\nResponse Preview (first 400 chars):`);
      console.log(data2.reply.substring(0, 400) + '...\n');

      // Check if response mentions Firebase/Stripe (memory recall)
      const reply = data2.reply.toLowerCase();
      const mentionsFirebase = reply.includes('firebase');
      const mentionsStripe = reply.includes('stripe');

      console.log('🧠 Memory Recall Analysis:');
      console.log(`   - Mentions Firebase: ${mentionsFirebase ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Mentions Stripe: ${mentionsStripe ? '✅ YES' : '❌ NO'}`);

      if (mentionsFirebase && mentionsStripe) {
        console.log('\n🎉 SUCCESS: Agent remembered previous decisions!\n');
      } else {
        console.log('\n⚠️  WARNING: Agent may not have recalled memory correctly\n');
      }
    } else {
      console.log('❌ Second request failed:', data2.error);
    }
  } catch (err) {
    console.error('❌ Request 2 failed:', err.message);
  }

  console.log('=' .repeat(80));
  console.log('\n✨ Phase 94.1 Test Complete!');
  console.log(`\nTest Project ID: ${testProjectId}`);
  console.log('You can inspect memory in Firestore at:');
  console.log(`  projects/${testProjectId}/meta/memory\n`);
}

// Run test
testMemorySystem().catch(console.error);
