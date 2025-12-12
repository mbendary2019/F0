#!/usr/bin/env node

/**
 * Test Phase 98 - Step 1: Agent Project Context Awareness
 *
 * This test verifies that the agent:
 * 1. Receives project context (app types, infrastructure, etc.)
 * 2. Acknowledges the app types user already chose
 * 3. Doesn't ask about already-decided settings
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
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70));
}

async function testProjectContext() {
  try {
    // First, create a test project with specific app types
    logSection('SETUP: Creating test project with Web + Mobile (iOS, Android)');

    const admin = await import('firebase-admin');

    // Initialize if not already
    if (!admin.apps.length) {
      admin.initializeApp();
    }

    const db = admin.firestore();

    // Set emulator host
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

    // Create test project
    const testProjectRef = db.collection('ops_projects').doc('test-phase98-context');

    await testProjectRef.set({
      ownerUid: 'test-user-98',
      name: 'Social Media Platform',
      appTypes: ['web', 'mobile'],
      mobileTargets: ['ios', 'android'],
      desktopTargets: [],
      infraType: 'firebase',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    log('✅ Test project created with:', 'green');
    log('   - App Types: Web, Mobile', 'cyan');
    log('   - Mobile Platforms: iOS, Android', 'cyan');
    log('   - Infrastructure: Firebase', 'cyan');

    // Test 1: Agent should acknowledge chosen app types
    logSection('TEST 1: Agent acknowledges app types (Arabic)');

    log('Sending: "عايز تطبيق شبه Facebook"', 'cyan');
    log('⏳ Waiting for agent response (20-40 seconds)...', 'yellow');

    const response1 = await fetch('http://localhost:3030/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'test-phase98-context',
        userId: 'test-user-98',
        intent: 'continue',
        message: 'عايز تطبيق شبه Facebook',
      }),
    });

    if (!response1.ok) {
      throw new Error(`API request failed: ${response1.status}`);
    }

    const result1 = await response1.json();

    if (!result1.ok) {
      throw new Error(`Agent error: ${result1.error || 'Unknown'}`);
    }

    log('\n✅ Agent Response:', 'green');
    console.log(result1.reply);

    // Validation
    const reply = result1.reply.toLowerCase();

    const mentionsWeb = reply.includes('web') || reply.includes('ويب');
    const mentionsMobile = reply.includes('mobile') || reply.includes('موبايل');
    const mentionsIOS = reply.includes('ios') || reply.includes('آي او إس');
    const mentionsAndroid = reply.includes('android') || reply.includes('أندرويد');
    const mentionsFirebase = reply.includes('firebase') || reply.includes('فايربيس');

    // Bad indicators (asking about already-chosen settings)
    const asksAboutPlatform =
      reply.includes('ويب ولا موبايل') ||
      reply.includes('web or mobile') ||
      reply.includes('تطبيق ويب؟') ||
      reply.includes('mobile app?');

    log('\n📊 Validation:', 'yellow');
    log(`   Mentions Web: ${mentionsWeb ? '✅' : '❌'}`, mentionsWeb ? 'green' : 'red');
    log(`   Mentions Mobile: ${mentionsMobile ? '✅' : '❌'}`, mentionsMobile ? 'green' : 'red');
    log(`   Mentions iOS/Android: ${mentionsIOS || mentionsAndroid ? '✅' : '❌'}`,
      (mentionsIOS || mentionsAndroid) ? 'green' : 'red');
    log(`   Mentions Firebase: ${mentionsFirebase ? '✅' : '❌'}`, mentionsFirebase ? 'green' : 'red');
    log(`   Doesn't ask about platform: ${!asksAboutPlatform ? '✅' : '❌'}`,
      !asksAboutPlatform ? 'green' : 'red');

    const passed = (mentionsWeb || mentionsMobile) && !asksAboutPlatform;

    if (!passed) {
      log('\n❌ TEST 1 FAILED', 'red');
      log('Expected: Agent should acknowledge Web + Mobile choice', 'yellow');
      log('Expected: Agent should NOT ask "ويب ولا موبايل؟"', 'yellow');
      return false;
    }

    log('\n✅ TEST 1 PASSED', 'green');

    // Test 2: English version
    logSection('TEST 2: Agent acknowledges app types (English)');

    log('Sending: "I want to build something like Instagram"', 'cyan');
    log('⏳ Waiting for agent response (20-40 seconds)...', 'yellow');

    const response2 = await fetch('http://localhost:3030/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'test-phase98-context',
        userId: 'test-user-98',
        intent: 'continue',
        message: 'I want to build something like Instagram',
      }),
    });

    if (!response2.ok) {
      throw new Error(`API request failed: ${response2.status}`);
    }

    const result2 = await response2.json();

    if (!result2.ok) {
      throw new Error(`Agent error: ${result2.error || 'Unknown'}`);
    }

    log('\n✅ Agent Response:', 'green');
    console.log(result2.reply);

    const reply2 = result2.reply.toLowerCase();

    const mentionsAppType2 = reply2.includes('web') || reply2.includes('mobile');
    const asksAboutPlatform2 =
      reply2.includes('web or mobile') ||
      reply2.includes('what type') ||
      reply2.includes('mobile app?');

    log('\n📊 Validation:', 'yellow');
    log(`   Mentions app type: ${mentionsAppType2 ? '✅' : '❌'}`, mentionsAppType2 ? 'green' : 'red');
    log(`   Doesn't ask about platform: ${!asksAboutPlatform2 ? '✅' : '❌'}`,
      !asksAboutPlatform2 ? 'green' : 'red');

    if (asksAboutPlatform2) {
      log('\n❌ TEST 2 FAILED', 'red');
      log('Expected: Agent should NOT ask about app type', 'yellow');
      return false;
    }

    log('\n✅ TEST 2 PASSED', 'green');

    // Final Result
    logSection('FINAL RESULT');

    log('🎉 All tests PASSED!', 'green');
    log('\n✅ Phase 98 Step 1: Agent Project Context Awareness is working!', 'bright');

    log('\n📊 What the Agent Now Does:', 'cyan');
    log('   • Receives project metadata (app types, infrastructure)', 'cyan');
    log('   • Acknowledges choices user already made', 'cyan');
    log('   • Doesn\'t ask about already-decided settings', 'cyan');
    log('   • Focuses on product discussion instead', 'cyan');

    log('\n🔄 Next Steps (Phase 98):', 'magenta');
    log('   Step 2: Persist chat messages to Firestore', 'yellow');
    log('   Step 3: Load chat history in UI', 'yellow');
    log('   Step 4: Send conversation history to agent', 'yellow');

    // Cleanup
    log('\n🧹 Cleaning up test data...', 'cyan');
    await testProjectRef.delete();
    log('✅ Done!', 'green');

    return true;
  } catch (err) {
    log('\n❌ Test failed with error:', 'red');
    console.error(err);

    if (err.message?.includes('fetch failed') || err.code === 'ECONNREFUSED') {
      log('\n💡 Make sure these are running:', 'yellow');
      log('   1. Firebase Emulators: firebase emulators:start', 'blue');
      log('   2. Dev Server: PORT=3030 pnpm dev', 'blue');
    }

    return false;
  }
}

// Run the test
testProjectContext()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
