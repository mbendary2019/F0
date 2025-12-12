#!/usr/bin/env npx tsx
// scripts/test-agent-router.ts
// Phase 170.2: Test Agent Router with Role-based Routing

import {
  AgentRouter,
  routeAgent,
  resolveWithContext,
  AGENT_MODEL_MAP,
  getRoleDescription,
} from '../orchestrator/core/llm';

async function testIntentResolver() {
  console.log('\n📋 Test 1: Intent Resolver\n');
  console.log('─'.repeat(60));

  const testCases = [
    { message: 'مرحبا!', expected: 'chat_light' },
    { message: 'Hi there', expected: 'chat_light' },
    { message: 'شكرا', expected: 'chat_light' },
    { message: 'عايز خطة لإطلاق SaaS', expected: 'planning' },
    { message: 'I need a GTM strategy for my startup', expected: 'planning' },
    { message: 'اكتب function تعمل validation', expected: 'code_generation' },
    { message: 'Write a React component for user profile', expected: 'code_generation' },
    { message: 'راجع الكود ده وقولي فيه إيه غلط', expected: 'code_review' },
    { message: 'Review this code and find bugs', expected: 'code_review' },
    { message: 'حلل المعمارية دي وقارن بين الخيارات', expected: 'complex_analysis' },
    { message: 'Analyze these trade-offs and recommend the best approach', expected: 'complex_analysis' },
    { message: 'UX flow for onboarding', expected: 'ux_ideation' },
    { message: 'تصميم واجهة المستخدم', expected: 'ux_ideation' },
  ];

  let passed = 0;
  for (const tc of testCases) {
    const result = resolveWithContext(tc.message);
    const match = result.role === tc.expected;
    if (match) passed++;

    console.log(`  ${match ? '✅' : '❌'} "${tc.message.substring(0, 30)}..."`);
    console.log(`     Expected: ${tc.expected}, Got: ${result.role} (${(result.confidence * 100).toFixed(0)}%)`);
    console.log(`     Reason: ${result.reason}`);
  }

  console.log(`\n  Result: ${passed}/${testCases.length} passed`);
  return passed === testCases.length;
}

async function testAgentModelMap() {
  console.log('\n📋 Test 2: Agent Model Map\n');
  console.log('─'.repeat(60));

  const roles = Object.keys(AGENT_MODEL_MAP) as Array<keyof typeof AGENT_MODEL_MAP>;

  for (const role of roles) {
    const config = AGENT_MODEL_MAP[role];
    console.log(`  📍 ${role}`);
    console.log(`     Description: ${getRoleDescription(role)}`);
    console.log(`     Primary: ${config.primary}`);
    console.log(`     Fallbacks: ${config.fallback.join(' → ') || 'none'}`);
    console.log(`     Max latency: ${config.maxLatencyMs}ms`);
    console.log(`     Max cost: $${config.maxCostUSD}`);
    console.log('');
  }

  return true;
}

async function testLiveRouting() {
  console.log('\n📋 Test 3: Live Agent Routing\n');
  console.log('─'.repeat(60));

  const testMessages = [
    {
      message: 'مرحبا، عامل إيه؟',
      expectedRole: 'chat_light',
    },
    {
      message: 'عايز خطة لإطلاق منتج جديد في السوق السعودي',
      expectedRole: 'planning',
    },
    {
      message: 'Write a TypeScript function that validates email addresses',
      expectedRole: 'code_generation',
    },
  ];

  let allPassed = true;

  for (const tc of testMessages) {
    console.log(`\n🔄 Testing: "${tc.message.substring(0, 50)}..."`);

    try {
      const result = await routeAgent(
        tc.message,
        {
          messages: [
            { role: 'system', content: 'Be very brief. One sentence max.' },
            { role: 'user', content: tc.message },
          ],
          maxTokens: 100,
        },
        'test-user'
      );

      if (result.success) {
        console.log(`   ✅ Success!`);
        console.log(`   📍 Role: ${result.role} (expected: ${tc.expectedRole})`);
        console.log(`   🤖 Model: ${result.modelUsed} (${result.providerUsed})`);
        console.log(`   ⏱️  Latency: ${result.latencyMs}ms`);
        console.log(`   🔄 Fallbacks used: ${result.fallbacksUsed}`);
        console.log(`   📝 Response: "${result.response?.content.substring(0, 100)}..."`);

        if (result.intent) {
          console.log(`   🎯 Intent confidence: ${(result.intent.confidence * 100).toFixed(0)}%`);
        }
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
        allPassed = false;
      }
    } catch (err: any) {
      console.log(`   ❌ Error: ${err.message}`);
      allPassed = false;
    }
  }

  return allPassed;
}

async function testFallbackBehavior() {
  console.log('\n📋 Test 4: Fallback Behavior\n');
  console.log('─'.repeat(60));

  // Test with a model that doesn't exist to trigger fallback
  console.log('  Testing fallback chain...');

  const result = await AgentRouter.route({
    message: 'Hello',
    options: {
      messages: [{ role: 'user', content: 'Say hello' }],
      maxTokens: 50,
    },
    userId: 'test-user',
    role: 'chat_light', // Will try mistral first
  });

  console.log(`  Role: ${result.role}`);
  console.log(`  Model used: ${result.modelUsed}`);
  console.log(`  Fallbacks used: ${result.fallbacksUsed}`);
  console.log(`  Success: ${result.success}`);

  return result.success;
}

async function main() {
  console.log('\n🧪 Phase 170.2 - Agent Router Tests\n');
  console.log('═'.repeat(60));

  const results: { name: string; passed: boolean }[] = [];

  // Test 1: Intent Resolver
  results.push({
    name: 'Intent Resolver',
    passed: await testIntentResolver(),
  });

  // Test 2: Agent Model Map
  results.push({
    name: 'Agent Model Map',
    passed: await testAgentModelMap(),
  });

  // Test 3: Live Routing
  results.push({
    name: 'Live Agent Routing',
    passed: await testLiveRouting(),
  });

  // Test 4: Fallback Behavior
  results.push({
    name: 'Fallback Behavior',
    passed: await testFallbackBehavior(),
  });

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Test Results Summary');
  console.log('═'.repeat(60));

  for (const r of results) {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`);
  }

  const passed = results.filter(r => r.passed).length;
  console.log(`\n  Total: ${passed}/${results.length} passed`);

  // Show router stats
  const stats = AgentRouter.getStats();
  console.log('\n📈 Router Stats:');
  console.log(`  Total requests: ${stats.totalRequests}`);
  console.log(`  Fallback rate: ${(stats.fallbackRate * 100).toFixed(1)}%`);
  console.log(`  Avg latency: ${stats.avgLatencyMs.toFixed(0)}ms`);

  console.log('\n' + '═'.repeat(60));
  console.log(passed === results.length ? '🎉 All tests passed!' : '⚠️ Some tests failed');
  console.log('═'.repeat(60) + '\n');
}

main().catch(console.error);
