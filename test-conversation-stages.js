#!/usr/bin/env node

/**
 * Test Script: Phase 97.1 - Conversation Stages System
 *
 * Tests that the agent:
 * 1. Appreciates ideas first
 * 2. Asks clarifying questions before proposing solutions
 * 3. Doesn't jump to generic SaaS templates
 * 4. Follows proper conversation flow
 */

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

/**
 * Check if response follows good conversation flow
 */
function validateConversationFlow(reply, testName) {
  const lowerReply = reply.toLowerCase();

  // Bad indicators (should NOT appear in first response)
  const badIndicators = [
    'next.js',
    'firebase',
    'يبدو أنك محتاج تطبيق عام',
    'it seems you need a general application',
    'خطة شاملة',
    'comprehensive plan',
    'tech stack',
    'technology:',
    'التكنولوجيا:',
  ];

  const hasBadIndicators = badIndicators.some((indicator) =>
    lowerReply.includes(indicator)
  );

  // Good indicators (should appear in first response)
  const goodIndicators = {
    appreciation: [
      'رائع',
      'عظيم',
      'ممتاز',
      'fantastic',
      'great',
      'awesome',
      'excellent',
    ],
    clarification: [
      'محتاج',
      'توضيح',
      'أتأكد',
      'فاهمك',
      'need clarification',
      'make sure',
      'understand',
      'let me confirm',
    ],
    questions: ['؟', '?'],
  };

  const hasAppreciation = goodIndicators.appreciation.some((word) =>
    lowerReply.includes(word)
  );

  const hasClarification = goodIndicators.clarification.some((word) =>
    lowerReply.includes(word)
  );

  const hasQuestions =
    (reply.match(/\?/g) || []).length >= 2 ||
    (reply.match(/؟/g) || []).length >= 2;

  log(`\n📊 Analysis for "${testName}":`, 'yellow');
  log(`   Appreciation: ${hasAppreciation ? '✅' : '❌'}`, hasAppreciation ? 'green' : 'red');
  log(`   Clarification: ${hasClarification ? '✅' : '❌'}`, hasClarification ? 'green' : 'red');
  log(`   Questions (2+): ${hasQuestions ? '✅' : '❌'}`, hasQuestions ? 'green' : 'red');
  log(`   No Tech Stack: ${!hasBadIndicators ? '✅' : '❌'}`, !hasBadIndicators ? 'green' : 'red');

  const isGood = hasAppreciation && hasClarification && hasQuestions && !hasBadIndicators;

  return isGood;
}

async function testConversationStages() {
  try {
    logSection('TEST 1: Arabic Request - Learning Platform');

    log('Sending: "عايز أعمل منصة للتعليم"', 'cyan');
    log('⏳ This may take 20-40 seconds...', 'yellow');

    const response1 = await fetch('http://localhost:3030/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'test-conv-stages-1',
        userId: 'test-user',
        intent: 'continue',
        message: 'عايز أعمل منصة للتعليم',
      }),
    });

    const result1 = await response1.json();

    if (!result1.ok) {
      log('❌ Request failed:', 'red');
      console.error(result1);
      return false;
    }

    log(`\n✅ Response received!`, 'green');
    log(`   Mode: ${result1.mode}`, 'blue');

    log('\n📝 Agent Reply:', 'cyan');
    console.log(result1.reply);

    const isGood1 = validateConversationFlow(result1.reply, 'Arabic Learning Platform');

    if (!isGood1) {
      log('\n❌ TEST 1 FAILED - Agent jumped to solution', 'red');
      return false;
    }

    log('\n✅ TEST 1 PASSED - Good conversation flow', 'green');

    // ========================================================================
    // TEST 2: English Request - E-commerce Platform
    // ========================================================================
    logSection('TEST 2: English Request - E-commerce Platform');

    log('Sending: "I want to build an e-commerce platform"', 'cyan');
    log('⏳ This may take 20-40 seconds...', 'yellow');

    const response2 = await fetch('http://localhost:3030/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'test-conv-stages-2',
        userId: 'test-user',
        intent: 'continue',
        message: 'I want to build an e-commerce platform',
      }),
    });

    const result2 = await response2.json();

    if (!result2.ok) {
      log('❌ Request failed:', 'red');
      console.error(result2);
      return false;
    }

    log(`\n✅ Response received!`, 'green');
    log(`   Mode: ${result2.mode}`, 'blue');

    log('\n📝 Agent Reply:', 'cyan');
    console.log(result2.reply);

    const isGood2 = validateConversationFlow(result2.reply, 'English E-commerce Platform');

    if (!isGood2) {
      log('\n❌ TEST 2 FAILED - Agent jumped to solution', 'red');
      return false;
    }

    log('\n✅ TEST 2 PASSED - Good conversation flow', 'green');

    // ========================================================================
    // TEST 3: Vague Request - Should Ask for Clarification
    // ========================================================================
    logSection('TEST 3: Vague Request - "حاجة"');

    log('Sending: "حاجة"', 'cyan');
    log('⏳ This may take 20-40 seconds...', 'yellow');

    const response3 = await fetch('http://localhost:3030/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'test-conv-stages-3',
        userId: 'test-user',
        intent: 'continue',
        message: 'حاجة',
      }),
    });

    const result3 = await response3.json();

    if (!result3.ok) {
      log('❌ Request failed:', 'red');
      console.error(result3);
      return false;
    }

    log(`\n✅ Response received!`, 'green');
    log(`   Mode: ${result3.mode}`, 'blue');

    log('\n📝 Agent Reply:', 'cyan');
    console.log(result3.reply);

    // For vague request, should NOT trigger Architect Mode
    if (result3.mode === 'ARCHITECT') {
      log('\n❌ TEST 3 FAILED - Should not trigger Architect Mode for vague request', 'red');
      return false;
    }

    // Should ask for clarification
    const hasQuestions =
      (result3.reply.match(/\?/g) || []).length >= 1 ||
      (result3.reply.match(/؟/g) || []).length >= 1;

    if (!hasQuestions) {
      log('\n❌ TEST 3 FAILED - Should ask questions for vague request', 'red');
      return false;
    }

    log('\n✅ TEST 3 PASSED - Handled vague request correctly', 'green');

    // ========================================================================
    // TEST 4: Greeting - Should NOT Trigger Architect Mode
    // ========================================================================
    logSection('TEST 4: Greeting - "صباح الخير"');

    log('Sending: "صباح الخير"', 'cyan');

    const response4 = await fetch('http://localhost:3030/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'test-conv-stages-4',
        userId: 'test-user',
        intent: 'continue',
        message: 'صباح الخير',
      }),
    });

    const result4 = await response4.json();

    if (!result4.ok) {
      log('❌ Request failed:', 'red');
      console.error(result4);
      return false;
    }

    log(`\n✅ Response received!`, 'green');
    log(`   Mode: ${result4.mode}`, 'blue');

    log('\n📝 Agent Reply:', 'cyan');
    console.log(result4.reply);

    if (result4.mode === 'ARCHITECT') {
      log('\n❌ TEST 4 FAILED - Should not trigger Architect Mode for greeting', 'red');
      return false;
    }

    log('\n✅ TEST 4 PASSED - Handled greeting correctly', 'green');

    // ========================================================================
    // FINAL RESULT
    // ========================================================================
    logSection('FINAL RESULT');

    log('🎉 All tests PASSED!', 'green');
    log('\n✅ Phase 97.1 (Conversation Stages) is working correctly!', 'bright');

    log('\n📊 Test Summary:', 'cyan');
    log('   ✅ Arabic request: Asks clarifying questions', 'green');
    log('   ✅ English request: Asks clarifying questions', 'green');
    log('   ✅ Vague request: Doesn\'t jump to solution', 'green');
    log('   ✅ Greeting: Responds naturally without architecture', 'green');

    log('\n💡 What Changed:', 'magenta');
    log('   • Agent now appreciates ideas first', 'cyan');
    log('   • Agent asks 2-3 clarifying questions', 'cyan');
    log('   • Agent doesn\'t jump to tech stack immediately', 'cyan');
    log('   • Agent follows proper conversation stages', 'cyan');

    return true;
  } catch (err) {
    log(`\n❌ Test failed with error:`, 'red');
    console.error(err);

    if (err.message?.includes('fetch failed') || err.code === 'ECONNREFUSED') {
      log('\n💡 Tip: Make sure the dev server is running:', 'yellow');
      log('   PORT=3030 pnpm dev', 'blue');
    }

    return false;
  }
}

// Run the test
testConversationStages()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
