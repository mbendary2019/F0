#!/usr/bin/env node

/**
 * Test Script: Phase 97.1 - Architect Mode in Conversational Agent
 *
 * Tests the enhanced conversational agent with automatic Architect Mode detection.
 */

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

async function testArchitectMode() {
  try {
    logSection('TEST 1: Regular Conversational Message (No Architect Mode)');

    log('Sending regular message...', 'cyan');
    const response1 = await fetch('http://localhost:3030/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'test-architect-mode',
        userId: 'test-user',
        intent: 'continue',
        message: 'مرحباً، ما أخبارك؟',
      }),
    });

    const result1 = await response1.json();

    if (!result1.ok) {
      log('❌ Request failed:', 'red');
      console.error(result1);
      return false;
    }

    log(`✅ Response received!`, 'green');
    log(`   Mode: ${result1.mode}`, 'blue');
    log(`   Has Architecture: ${!!result1.architectPlan}`, 'blue');
    log(`   Reply length: ${result1.reply?.length || 0} chars`, 'blue');

    if (result1.mode !== 'CONVERSATIONAL') {
      log('❌ Expected CONVERSATIONAL mode for regular message', 'red');
      return false;
    }

    log('✅ TEST 1 PASSED', 'green');

    // ========================================================================
    // TEST 2: Architect Mode (Arabic - Build System)
    // ========================================================================
    logSection('TEST 2: Architect Mode (Arabic - عايز أعمل نظام)');

    log('Sending architecture request in Arabic...', 'cyan');
    log('⏳ This may take 20-40 seconds...', 'yellow');

    const response2 = await fetch('http://localhost:3030/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'test-architect-mode',
        userId: 'test-user',
        intent: 'continue',
        message: 'عايز أعمل نظام authentication بسيط مع email و password',
      }),
    });

    const result2 = await response2.json();

    if (!result2.ok) {
      log('❌ Request failed:', 'red');
      console.error(result2);
      return false;
    }

    log(`✅ Response received!`, 'green');
    log(`   Mode: ${result2.mode}`, 'blue');
    log(`   Has Architecture: ${!!result2.architectPlan}`, 'blue');
    log(`   Reply length: ${result2.reply?.length || 0} chars`, 'blue');

    if (result2.mode !== 'ARCHITECT') {
      log('❌ Expected ARCHITECT mode for system request', 'red');
      return false;
    }

    if (!result2.architectPlan) {
      log('❌ Expected architectPlan in response', 'red');
      return false;
    }

    log('\nArchitecture Details:', 'yellow');
    log(`   Modules: ${result2.architectPlan.modules?.length || 0}`, 'cyan');
    log(`   APIs: ${result2.architectPlan.apis?.length || 0}`, 'cyan');
    log(`   Data Models: ${result2.architectPlan.dataModels?.length || 0}`, 'cyan');
    log(`   Phases: ${result2.architectPlan.phases?.length || 0}`, 'cyan');

    log('\n✅ TEST 2 PASSED', 'green');

    // ========================================================================
    // TEST 3: Force Architect Mode (design-api-db intent)
    // ========================================================================
    logSection('TEST 3: Force Architect Mode (design-api-db intent)');

    log('Sending API/DB design request...', 'cyan');
    log('⏳ This may take 20-40 seconds...', 'yellow');

    const response3 = await fetch('http://localhost:3030/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'test-architect-mode',
        userId: 'test-user',
        intent: 'design-api-db',
        message: 'أحتاج API endpoints لإدارة المستخدمين',
      }),
    });

    const result3 = await response3.json();

    if (!result3.ok) {
      log('❌ Request failed:', 'red');
      console.error(result3);
      return false;
    }

    log(`✅ Response received!`, 'green');
    log(`   Mode: ${result3.mode}`, 'blue');
    log(`   Has Architecture: ${!!result3.architectPlan}`, 'blue');

    if (result3.mode !== 'ARCHITECT') {
      log('❌ Expected ARCHITECT mode for design-api-db intent', 'red');
      return false;
    }

    log('\n✅ TEST 3 PASSED', 'green');

    // ========================================================================
    // TEST 4: English Request
    // ========================================================================
    logSection('TEST 4: Architect Mode (English - Build Platform)');

    log('Sending architecture request in English...', 'cyan');
    log('⏳ This may take 20-40 seconds...', 'yellow');

    const response4 = await fetch('http://localhost:3030/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'test-architect-mode-en',
        userId: 'test-user',
        intent: 'continue',
        message: 'I want to build a simple blog platform with posts and comments',
      }),
    });

    const result4 = await response4.json();

    if (!result4.ok) {
      log('❌ Request failed:', 'red');
      console.error(result4);
      return false;
    }

    log(`✅ Response received!`, 'green');
    log(`   Mode: ${result4.mode}`, 'blue');
    log(`   Has Architecture: ${!!result4.architectPlan}`, 'blue');

    if (result4.mode !== 'ARCHITECT') {
      log('❌ Expected ARCHITECT mode for build platform request', 'red');
      return false;
    }

    log('\n✅ TEST 4 PASSED', 'green');

    // ========================================================================
    // FINAL RESULT
    // ========================================================================
    logSection('FINAL RESULT');

    log('🎉 All tests PASSED!', 'green');
    log('\n✅ Phase 97.1 (Architect Mode) is working correctly!', 'bright');

    log('\n📊 Test Summary:', 'cyan');
    log('   ✅ Regular conversation (no architecture)', 'green');
    log('   ✅ Arabic architecture request', 'green');
    log('   ✅ Force architect mode via intent', 'green');
    log('   ✅ English architecture request', 'green');

    log('\n💡 Try it yourself:', 'magenta');
    log('   curl -X POST http://localhost:3030/api/agent/run \\', 'blue');
    log('     -H "Content-Type: application/json" \\', 'blue');
    log('     -d \'{"projectId":"test","userId":"user","intent":"continue","message":"عايز أعمل تطبيق"}\'', 'blue');

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
testArchitectMode()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
