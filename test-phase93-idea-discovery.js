/**
 * Test Phase 93.4: IDEA_DISCOVERY Mode
 * Tests non-technical user support with idea exploration
 */

const API_URL = 'http://localhost:3030/api/agent/run';

async function testIdeaDiscovery(message, language, testName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Test: ${testName}`);
  console.log(`Message: "${message}"`);
  console.log(`Expected Mode: IDEA_DISCOVERY`);
  console.log(`Language: ${language}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: 'test-idea-discovery',
        intent: 'continue',
        message,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log('✅ Agent responded successfully\n');

      const reply = data.reply.toLowerCase();

      // Check for IDEA_DISCOVERY characteristics
      const hasNoTechJargon =
        !reply.includes('react') &&
        !reply.includes('next.js') &&
        !reply.includes('firebase') &&
        !reply.includes('api') &&
        !reply.includes('typescript');

      const hasQuestions =
        reply.includes('?') ||
        reply.includes('ممكن تقولي') ||
        reply.includes('could you tell') ||
        reply.includes('what');

      const hasIdeasProposal =
        reply.includes('1️⃣') || reply.includes('2️⃣') || reply.includes('3️⃣') ||
        reply.includes('أفكار') || reply.includes('ideas') ||
        reply.includes('اقتراح') || reply.includes('suggest');

      console.log('📝 Response Preview (first 800 chars):');
      console.log('-'.repeat(80));
      console.log(data.reply.substring(0, 800));
      if (data.reply.length > 800) {
        console.log('\n... [' + (data.reply.length - 800) + ' more characters]');
      }
      console.log('-'.repeat(80));

      console.log(`\n📊 IDEA_DISCOVERY Mode Analysis:`);
      console.log(`   - No technical jargon: ${hasNoTechJargon ? '✅ YES' : '❌ NO (found React/Firebase/etc.)'}`);
      console.log(`   - Asks clarifying questions: ${hasQuestions ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Proposes ideas: ${hasIdeasProposal ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Response length: ${data.reply.length} characters`);
      console.log(`   - Ready: ${data.ready}`);

      // Overall assessment
      const isPerfectIdeaDiscovery = hasNoTechJargon && hasQuestions && hasIdeasProposal;
      console.log(`\n${isPerfectIdeaDiscovery ? '🎉' : '⚠️'} Overall: ${isPerfectIdeaDiscovery ? 'Perfect IDEA_DISCOVERY mode!' : 'Needs adjustment'}`);

    } else {
      console.log('❌ Agent returned error:', data.error);
    }
  } catch (err) {
    console.error('❌ Request failed:', err.message);
  }
}

async function runTests() {
  console.log('\n🚀 Starting Phase 93.4 Tests: IDEA_DISCOVERY Mode\n');
  console.log('Testing non-technical user support with idea exploration...\n');

  // Test 1: Arabic - Non-technical user with vague idea
  await testIdeaDiscovery(
    'عندي فكرة جديدة بس مش عارف أبدأ منين، معنديش خلفية تقنية',
    'Arabic',
    'Arabic: Non-technical user exploring new idea'
  );

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 2: English - User wants help organizing idea
  await testIdeaDiscovery(
    'I have a new idea but I don\'t know where to start. No technical background.',
    'English',
    'English: Non-technical user needs help'
  );

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 3: Arabic - User wants idea suggestions
  await testIdeaDiscovery(
    'عايز أعمل مشروع جديد، ساعدني في الفكرة',
    'Arabic',
    'Arabic: User needs idea suggestions'
  );

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 4: English - User exploring domain
  await testIdeaDiscovery(
    'I want to make something useful but not sure what. Help me choose an idea.',
    'English',
    'English: User exploring domain and options'
  );

  console.log('\n\n✨ Phase 93.4 Tests Completed!');
  console.log('\n📊 What to look for in IDEA_DISCOVERY mode:');
  console.log('   ✓ NO technical jargon (React, Firebase, APIs should NOT appear)');
  console.log('   ✓ Asks 2-3 clarifying questions about domain/users/problem');
  console.log('   ✓ Proposes 3 candidate ideas in simple language');
  console.log('   ✓ Focuses on value and benefits, not technology');
  console.log('   ✓ Friendly, enthusiastic, non-technical tone\n');
}

// Run tests
runTests().catch(console.error);
