/**
 * Test script for enhanced F0 Agent responses
 * Tests detailed technical responses with structured sections
 */

const API_URL = 'http://localhost:3030/api/agent/run';

async function testAgent(message, expectedLang, testName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Test: ${testName}`);
  console.log(`Message: "${message}"`);
  console.log(`Expected language: ${expectedLang}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: 'test-enhanced',
        intent: 'continue',
        message,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log('✅ Agent responded successfully');
      console.log('\n📝 Agent Reply:');
      console.log('-'.repeat(80));
      console.log(data.reply);
      console.log('-'.repeat(80));

      // Check if response has structured sections
      const hasStructure =
        data.reply.includes('**') &&  // Has markdown sections
        (data.reply.includes('📱') || data.reply.includes('🔧') || data.reply.includes('✨'));

      console.log(`\n📊 Response Quality:`);
      console.log(`   - Has structured sections: ${hasStructure ? '✅ Yes' : '❌ No'}`);
      console.log(`   - Character count: ${data.reply.length}`);
      console.log(`   - Ready: ${data.ready}`);
      console.log(`   - Intent: ${data.intent || 'N/A'}`);

      if (data.plan && data.plan.length > 0) {
        console.log(`\n📋 Generated Plan (${data.plan.length} items):`);
        data.plan.slice(0, 3).forEach((task, idx) => {
          console.log(`  ${idx + 1}. ${task}`);
        });
        if (data.plan.length > 3) {
          console.log(`  ... and ${data.plan.length - 3} more items`);
        }
      }
    } else {
      console.log('❌ Agent returned error:', data.error);
    }
  } catch (err) {
    console.error('❌ Request failed:', err.message);
  }
}

async function runTests() {
  console.log('\n🚀 Starting Enhanced Agent Response Tests\n');
  console.log('Testing detailed technical responses with structured sections...\n');

  // Test 1: Arabic - Doctor booking app
  await testAgent(
    'عايز أعمل تطبيق حجز مواعيد للدكاترة',
    'ar',
    'Arabic: Doctor Booking App'
  );

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 2: English - Restaurant management
  await testAgent(
    'I want to build a restaurant management system',
    'en',
    'English: Restaurant Management'
  );

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 3: Arabic - Complex SaaS app (the example from user)
  await testAgent(
    'عايز اعمل برنامج ساس يعمل تطبيقات من الموبيل زي برنامج vibecode',
    'ar',
    'Arabic: SaaS Mobile App Builder'
  );

  console.log('\n\n✨ All enhanced tests completed!');
  console.log('\n📊 Look for these improvements in responses:');
  console.log('   ✓ Structured sections (Platforms, Technology, Features, Challenges)');
  console.log('   ✓ Detailed technical justifications');
  console.log('   ✓ More comprehensive plans (6-10 phases)');
  console.log('   ✓ Each phase with specific sub-tasks');
  console.log('   ✓ Expected challenges and solutions\n');
}

// Run tests
runTests().catch(console.error);
