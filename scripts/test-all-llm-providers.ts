#!/usr/bin/env npx tsx
// scripts/test-all-llm-providers.ts
// Phase 170: Test all available LLM providers

import {
  instrumentedLLMCall,
  LLMClientFactory,
  aceAutoFix,
  BenchmarkEngine,
} from '../orchestrator/core/llm';

async function testProvider(
  name: string,
  model: string,
  provider: string
): Promise<boolean> {
  console.log(`\n🔄 Testing ${name} (${model})...`);

  try {
    const result = await instrumentedLLMCall({
      taskType: 'CHAT',
      userTier: 'ultimate',
      userId: 'test-user',
      messages: [
        { role: 'system', content: 'Be very brief. One sentence max.' },
        { role: 'user', content: `Say "Hello from ${name}!" exactly.` },
      ],
      temperature: 0,
      maxTokens: 30,
      forceModel: model as any,
    });

    if (result.success) {
      console.log(`   ✅ Success!`);
      console.log(`   📝 Response: "${result.content.trim()}"`);
      console.log(`   ⏱️  Latency: ${result.metrics.latencyMs}ms`);
      console.log(`   💰 Cost: $${result.metrics.estimatedCostUSD?.toFixed(6)}`);
      return true;
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      return false;
    }
  } catch (err: any) {
    console.log(`   ❌ Error: ${err.message}`);
    return false;
  }
}

async function testDevStralCodeFix(): Promise<boolean> {
  console.log(`\n🔄 Testing DevStral AUTO_FIX...`);

  const testCode = `
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  console.log("Debug: total is", total);
  return total;
}
`;

  try {
    const result = await aceAutoFix(
      {
        filePath: 'test.ts',
        code: testCode,
        issues: [
          {
            message: 'Unexpected console statement',
            line: 7,
            severity: 'warning',
            ruleId: 'no-console',
          },
          {
            message: 'Missing return type annotation',
            line: 1,
            severity: 'warning',
            ruleId: '@typescript-eslint/explicit-function-return-type',
          },
        ],
        riskLevel: 'balanced',
        language: 'typescript',
      },
      'pro',
      'test-user'
    );

    if (result.success && result.patches.length > 0) {
      console.log(`   ✅ Success! Generated ${result.patches.length} patches`);
      console.log(`   📝 Summary: ${result.summary}`);
      console.log(`   🤖 Model: ${result.model}`);
      console.log(`   ⏱️  Latency: ${result.metrics?.latencyMs}ms`);
      for (const patch of result.patches) {
        console.log(`   📌 Patch: ${patch.reason} (line ${patch.start.line})`);
      }
      return true;
    } else {
      console.log(`   ❌ Failed: ${result.error || 'No patches generated'}`);
      return false;
    }
  } catch (err: any) {
    console.log(`   ❌ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🧪 Phase 170 - Full Provider Test\n');
  console.log('═'.repeat(60));

  const results: { name: string; success: boolean }[] = [];

  // Test OpenAI
  const openai = await testProvider('OpenAI', 'gpt-4o-mini', 'openai');
  results.push({ name: 'OpenAI (gpt-4o-mini)', success: openai });

  // Test Mistral
  const mistral = await testProvider('Mistral', 'mistral-small-latest', 'mistral');
  results.push({ name: 'Mistral (small)', success: mistral });

  // Test DevStral
  const devstral = await testProvider('DevStral', 'devstral-small-2505', 'devstral');
  results.push({ name: 'DevStral (small)', success: devstral });

  // Test Anthropic Claude (if key available)
  if (process.env.ANTHROPIC_API_KEY) {
    const claude = await testProvider('Claude', 'claude-3-haiku-20240307', 'anthropic');
    results.push({ name: 'Claude (Haiku)', success: claude });
  } else {
    console.log('\n⏭️  Skipping Claude (no ANTHROPIC_API_KEY)');
  }

  // Test Google Gemini (if key available)
  if (process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY) {
    const gemini = await testProvider('Gemini', 'gemini-1.5-flash', 'gemini');
    results.push({ name: 'Gemini (Flash)', success: gemini });
  } else {
    console.log('\n⏭️  Skipping Gemini (no GOOGLE_AI_API_KEY)');
  }

  // Test ACE Auto-Fix with DevStral
  const aceFix = await testDevStralCodeFix();
  results.push({ name: 'ACE Auto-Fix', success: aceFix });

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Test Results Summary');
  console.log('═'.repeat(60));

  for (const r of results) {
    console.log(`  ${r.success ? '✅' : '❌'} ${r.name}`);
  }

  const passed = results.filter(r => r.success).length;
  const total = results.length;

  console.log(`\n  Total: ${passed}/${total} passed`);

  // Benchmark summary
  const summary = BenchmarkEngine.getDashboardSummary();
  console.log('\n📈 Benchmark Summary:');
  console.log(`  Total runs: ${summary.totalRuns}`);
  console.log(`  Success rate: ${(summary.successRate * 100).toFixed(1)}%`);
  console.log(`  Avg latency: ${summary.avgLatencyMs.toFixed(0)}ms`);
  console.log(`  Total cost: $${summary.totalCostUSD.toFixed(6)}`);
  console.log(`  Models used: ${Object.keys(summary.modelBreakdown).join(', ')}`);

  console.log('\n' + '═'.repeat(60));
  console.log(passed === total ? '🎉 All tests passed!' : '⚠️ Some tests failed');
  console.log('═'.repeat(60) + '\n');
}

main().catch(console.error);
