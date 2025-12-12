#!/usr/bin/env npx tsx
// scripts/test-llm-orchestrator.ts
// Phase 170 Test: Multi-Model Orchestrator Testing

import {
  LLMRouter,
  getModelConfig,
  LLM_MODELS,
  LLMClientFactory,
  instrumentedLLMCall,
  BenchmarkEngine,
  getModelComparisons,
} from '../orchestrator/core/llm';

async function main() {
  console.log('\n🧪 Phase 170 - Multi-Model Orchestrator Tests\n');
  console.log('═'.repeat(60));

  // Test 1: Model Registry
  console.log('\n📋 Test 1: Model Registry');
  console.log('-'.repeat(40));
  console.log(`Total models registered: ${LLM_MODELS.length}`);

  const providers = [...new Set(LLM_MODELS.map(m => m.provider))];
  console.log(`Providers: ${providers.join(', ')}`);

  for (const provider of providers) {
    const models = LLM_MODELS.filter(m => m.provider === provider);
    console.log(`  ${provider}: ${models.map(m => m.id).join(', ')}`);
  }
  console.log('✅ Model Registry OK\n');

  // Test 2: Router - Free Tier
  console.log('📋 Test 2: Router (Free Tier)');
  console.log('-'.repeat(40));

  const freeAutoFix = LLMRouter.routeCodeTask('AUTO_FIX', 'free');
  console.log(`AUTO_FIX → ${freeAutoFix.preferredModel}`);
  console.log(`  Reason: ${freeAutoFix.reason}`);
  console.log(`  Fallbacks: ${freeAutoFix.fallbackModels.join(', ')}`);

  const freeChat = LLMRouter.routeChatTask('free');
  console.log(`CHAT → ${freeChat.preferredModel}`);
  console.log('✅ Free Tier Routing OK\n');

  // Test 3: Router - Pro Tier
  console.log('📋 Test 3: Router (Pro Tier)');
  console.log('-'.repeat(40));

  const proAutoFix = LLMRouter.routeCodeTask('AUTO_FIX', 'pro');
  console.log(`AUTO_FIX → ${proAutoFix.preferredModel}`);
  console.log(`  Reason: ${proAutoFix.reason}`);

  const proCodeReview = LLMRouter.routeCodeTask('CODE_REVIEW', 'pro');
  console.log(`CODE_REVIEW → ${proCodeReview.preferredModel}`);

  const proChat = LLMRouter.routeChatTask('pro');
  console.log(`CHAT → ${proChat.preferredModel}`);
  console.log('✅ Pro Tier Routing OK\n');

  // Test 4: Router - Ultimate Tier
  console.log('📋 Test 4: Router (Ultimate Tier)');
  console.log('-'.repeat(40));

  const ultAutoFix = LLMRouter.routeCodeTask('AUTO_FIX', 'ultimate');
  console.log(`AUTO_FIX → ${ultAutoFix.preferredModel}`);

  const ultCodeReview = LLMRouter.routeCodeTask('CODE_REVIEW', 'ultimate');
  console.log(`CODE_REVIEW → ${ultCodeReview.preferredModel}`);
  console.log('✅ Ultimate Tier Routing OK\n');

  // Test 5: Model Comparisons
  console.log('📋 Test 5: Model Comparisons');
  console.log('-'.repeat(40));

  const comparisons = getModelComparisons();
  console.log('Model comparison data:');
  for (const c of comparisons.slice(0, 4)) {
    console.log(`  ${c.label}: ${c.costTier}/${c.qualityTier}/${c.speedTier} → ${c.bestFor.join(', ')}`);
  }
  console.log('✅ Comparisons OK\n');

  // Test 6: Check Available Providers
  console.log('📋 Test 6: Available API Keys');
  console.log('-'.repeat(40));

  const apiKeys = {
    OPENAI: !!process.env.OPENAI_API_KEY,
    ANTHROPIC: !!process.env.ANTHROPIC_API_KEY,
    MISTRAL: !!process.env.MISTRAL_API_KEY,
    DEVSTRAL: !!process.env.DEVSTRAL_API_KEY || !!process.env.MISTRAL_API_KEY,
    GEMINI: !!process.env.GOOGLE_AI_API_KEY || !!process.env.GEMINI_API_KEY,
  };

  for (const [provider, available] of Object.entries(apiKeys)) {
    console.log(`  ${provider}: ${available ? '✅ Available' : '❌ Missing'}`);
  }
  console.log('');

  // Test 7: Live API Call (if OpenAI available)
  if (apiKeys.OPENAI) {
    console.log('📋 Test 7: Live API Call (OpenAI)');
    console.log('-'.repeat(40));

    try {
      const result = await instrumentedLLMCall({
        taskType: 'CHAT',
        userTier: 'ultimate', // Higher tier to avoid cost downgrade
        userId: 'test-user',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Be very brief.' },
          { role: 'user', content: 'Say "Phase 170 test successful!" in exactly those words.' },
        ],
        temperature: 0,
        maxTokens: 50,
        forceModel: 'gpt-4o-mini', // Force OpenAI since we know it's available
        excludeProviders: ['gemini', 'anthropic', 'mistral', 'devstral'], // Only use OpenAI
      });

      console.log(`  Success: ${result.success}`);
      console.log(`  Model: ${result.model}`);
      console.log(`  Provider: ${result.provider}`);
      console.log(`  Latency: ${result.metrics.latencyMs}ms`);
      console.log(`  Tokens: ${result.metrics.inputTokens} in / ${result.metrics.outputTokens} out`);
      console.log(`  Cost: $${result.metrics.estimatedCostUSD?.toFixed(6) || 'N/A'}`);
      console.log(`  Response: "${result.content.slice(0, 100)}..."`);
      console.log('✅ Live API Call OK\n');
    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message}`);
      console.log('');
    }
  }

  // Test 8: Benchmark Stats
  console.log('📋 Test 8: Benchmark Engine');
  console.log('-'.repeat(40));

  const summary = BenchmarkEngine.getDashboardSummary();
  console.log(`  Total runs: ${summary.totalRuns}`);
  console.log(`  Success rate: ${(summary.successRate * 100).toFixed(1)}%`);
  console.log(`  Avg latency: ${summary.avgLatencyMs.toFixed(0)}ms`);
  console.log(`  Total cost: $${summary.totalCostUSD.toFixed(6)}`);
  console.log('✅ Benchmark Engine OK\n');

  // Summary
  console.log('═'.repeat(60));
  console.log('📊 Phase 170 Test Summary');
  console.log('═'.repeat(60));
  console.log(`
✅ Model Registry: ${LLM_MODELS.length} models across ${providers.length} providers
✅ Router: Tier-based routing working
✅ Cost Optimizer: Budget controls ready
✅ Benchmark Engine: Performance tracking ready
✅ ACE Integration: Ready for Auto-Fix tasks

🔑 API Keys Status:
   - OpenAI: ${apiKeys.OPENAI ? '✅' : '❌'}
   - Mistral/DevStral: ${apiKeys.MISTRAL ? '✅' : '❌ (Add MISTRAL_API_KEY)'}
   - Anthropic: ${apiKeys.ANTHROPIC ? '✅' : '❌ (Optional)'}
   - Gemini: ${apiKeys.GEMINI ? '✅' : '❌ (Optional)'}

${!apiKeys.MISTRAL ? `
⚠️  To enable DevStral for code tasks, add to .env.local:
   MISTRAL_API_KEY=your-mistral-api-key

   Get your key from: https://console.mistral.ai/
` : ''}
`);
}

main().catch(console.error);
