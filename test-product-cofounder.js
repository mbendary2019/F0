#!/usr/bin/env node

/**
 * Test Script: Phase 97.2 - AI Product Co-Founder
 *
 * Tests that the agent:
 * 1. Analyzes competitive apps (when user says "like app X")
 * 2. Suggests MVP approaches
 * 3. Asks product questions BEFORE tech questions
 * 4. Doesn't jump to tech stack prematurely
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
 * Validate product-focused response
 */
function validateProductResponse(reply, appName, testName) {
  const lowerReply = reply.toLowerCase();

  // Bad indicators (should NOT appear in product discovery stage)
  const prematureTechIndicators = [
    'next.js',
    'firebase',
    'stripe للدفع',
    'stripe for payment',
    'admin dashboard',
    'لوحة تحكم للإدارة',
    'folder structure',
    'هيكل المجلدات',
  ];

  const hasPrematureTech = prematureTechIndicators.some((indicator) =>
    lowerReply.includes(indicator)
  );

  // Good indicators (should appear in product discovery)
  const productIndicators = {
    competitiveAnalysis: [
      appName?.toLowerCase(),
      'مميز',
      'strengths',
      'تعقيد',
      'complex',
      'challenges',
      'تحديات',
    ],
    mvpSuggestions: [
      'mvp',
      'ابدأ',
      'start small',
      'نسخة خفيفة',
      'lightweight',
      'بسيط',
      'simple',
    ],
    productQuestions: [
      'المستخدم',
      'user',
      'target',
      'المستهدف',
      'المدينة',
      'city',
      'المنطقة',
      'area',
    ],
  };

  const hasCompetitiveAnalysis = productIndicators.competitiveAnalysis.some(
    (word) => lowerReply.includes(word)
  );

  const hasMvpSuggestions = productIndicators.mvpSuggestions.some((word) =>
    lowerReply.includes(word)
  );

  const hasProductQuestions = productIndicators.productQuestions.some((word) =>
    lowerReply.includes(word)
  );

  log(`\n📊 Analysis for "${testName}":`, 'yellow');
  log(
    `   Competitive Analysis: ${hasCompetitiveAnalysis ? '✅' : '❌'}`,
    hasCompetitiveAnalysis ? 'green' : 'red'
  );
  log(
    `   MVP Suggestions: ${hasMvpSuggestions ? '✅' : '❌'}`,
    hasMvpSuggestions ? 'green' : 'red'
  );
  log(
    `   Product Questions: ${hasProductQuestions ? '✅' : '❌'}`,
    hasProductQuestions ? 'green' : 'red'
  );
  log(
    `   No Premature Tech: ${!hasPrematureTech ? '✅' : '❌'}`,
    !hasPrematureTech ? 'green' : 'red'
  );

  const isGood =
    hasCompetitiveAnalysis &&
    hasMvpSuggestions &&
    hasProductQuestions &&
    !hasPrematureTech;

  return isGood;
}

async function testProductCoFounder() {
  try {
    logSection('TEST 1: Arabic - "عايز زي Talabat"');

    log('Sending: "عايز أعمل حاجة زي Talabat"', 'cyan');
    log('⏳ This may take 20-40 seconds...', 'yellow');

    const response1 = await fetch('http://localhost:3030/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'test-product-talabat',
        userId: 'test-user',
        intent: 'continue',
        message: 'عايز أعمل حاجة زي Talabat',
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

    const isGood1 = validateProductResponse(
      result1.reply,
      'talabat',
      'Arabic - Like Talabat'
    );

    if (!isGood1) {
      log('\n❌ TEST 1 FAILED - Not product-focused', 'red');
      return false;
    }

    log('\n✅ TEST 1 PASSED - Product-focused response', 'green');

    // ========================================================================
    // TEST 2: English - "like Uber"
    // ========================================================================
    logSection('TEST 2: English - "I want to build like Uber"');

    log('Sending: "I want to build something like Uber"', 'cyan');
    log('⏳ This may take 20-40 seconds...', 'yellow');

    const response2 = await fetch('http://localhost:3030/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'test-product-uber',
        userId: 'test-user',
        intent: 'continue',
        message: 'I want to build something like Uber',
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

    const isGood2 = validateProductResponse(
      result2.reply,
      'uber',
      'English - Like Uber'
    );

    if (!isGood2) {
      log('\n❌ TEST 2 FAILED - Not product-focused', 'red');
      return false;
    }

    log('\n✅ TEST 2 PASSED - Product-focused response', 'green');

    // ========================================================================
    // TEST 3: General Idea (No Reference App)
    // ========================================================================
    logSection('TEST 3: General Idea - Education Platform');

    log('Sending: "عايز أعمل منصة للتعليم عن بعد"', 'cyan');
    log('⏳ This may take 20-40 seconds...', 'yellow');

    const response3 = await fetch('http://localhost:3030/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'test-product-education',
        userId: 'test-user',
        intent: 'continue',
        message: 'عايز أعمل منصة للتعليم عن بعد',
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

    // For general idea, should ask product questions
    const lowerReply3 = result3.reply.toLowerCase();
    const asksAboutUsers =
      lowerReply3.includes('مستخدم') ||
      lowerReply3.includes('user') ||
      lowerReply3.includes('target');

    const asksAboutMVP =
      lowerReply3.includes('mvp') ||
      lowerReply3.includes('نسخة') ||
      lowerReply3.includes('ابدأ');

    const noPrematureTech =
      !lowerReply3.includes('next.js') && !lowerReply3.includes('firebase');

    log('\n📊 Analysis:', 'yellow');
    log(`   Asks about users: ${asksAboutUsers ? '✅' : '❌'}`, asksAboutUsers ? 'green' : 'red');
    log(`   Asks about MVP: ${asksAboutMVP ? '✅' : '❌'}`, asksAboutMVP ? 'green' : 'red');
    log(`   No premature tech: ${noPrematureTech ? '✅' : '❌'}`, noPrematureTech ? 'green' : 'red');

    if (!asksAboutUsers || !asksAboutMVP || !noPrematureTech) {
      log('\n❌ TEST 3 FAILED - Should ask product questions', 'red');
      return false;
    }

    log('\n✅ TEST 3 PASSED - Product-focused questions', 'green');

    // ========================================================================
    // FINAL RESULT
    // ========================================================================
    logSection('FINAL RESULT');

    log('🎉 All tests PASSED!', 'green');
    log('\n✅ Phase 97.2 (AI Product Co-Founder) is working correctly!', 'bright');

    log('\n📊 Test Summary:', 'cyan');
    log('   ✅ Competitive analysis (Talabat)', 'green');
    log('   ✅ Competitive analysis (Uber)', 'green');
    log('   ✅ Product-focused questions (general idea)', 'green');

    log('\n💡 What the Agent Now Does:', 'magenta');
    log('   • Analyzes competitive apps intelligently', 'cyan');
    log('   • Suggests MVP approaches', 'cyan');
    log('   • Asks product questions BEFORE tech', 'cyan');
    log('   • Recommends differentiation strategies', 'cyan');
    log('   • Adapts to user\'s technical level', 'cyan');

    log('\n🚀 Try it yourself:', 'yellow');
    log('   curl -X POST http://localhost:3030/api/agent/run \\\\', 'blue');
    log('     -H "Content-Type: application/json" \\\\', 'blue');
    log('     -d \'{"projectId":"my-project","userId":"user-123","intent":"continue","message":"عايز أعمل حاجة زي Airbnb"}\'', 'blue');

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
testProductCoFounder()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
