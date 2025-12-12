/**
 * Test script for conversational F0 Agent
 * Tests auto language detection and conversational responses
 */

const API_URL = 'http://localhost:3030/api/agent/run';

async function testAgent(message, expectedLang) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: "${message}"`);
  console.log(`Expected language: ${expectedLang}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: 'test-project',
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

      if (data.plan && data.plan.length > 0) {
        console.log('\n📋 Generated Plan:');
        data.plan.forEach((task, idx) => {
          console.log(`  ${idx + 1}. ${task}`);
        });
      }

      console.log(`\n📊 Metadata:`);
      console.log(`   - Ready: ${data.ready}`);
      console.log(`   - Intent: ${data.intent || 'N/A'}`);
      console.log(`   - Clarity Score: ${data.clarity_score || 'N/A'}`);
    } else {
      console.log('❌ Agent returned error:', data.error);
    }
  } catch (err) {
    console.error('❌ Request failed:', err.message);
  }
}

async function runTests() {
  console.log('\n🚀 Starting Conversational Agent Tests\n');
  console.log('Testing auto language detection and conversational personality...\n');

  // Test 1: Arabic message
  await testAgent(
    'عايز أعمل تطبيق حجز مواعيد للدكاترة',
    'ar'
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: English message
  await testAgent(
    'I want to build a booking app for doctors',
    'en'
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Vague Arabic request
  await testAgent(
    'محتاج تطبيق للمطعم',
    'ar'
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 4: Vague English request
  await testAgent(
    'need something for my restaurant',
    'en'
  );

  console.log('\n\n✨ All tests completed!\n');
}

// Run tests
runTests().catch(console.error);
