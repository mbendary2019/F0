// scripts/test-media-agent-image.ts
// Phase 171: Test Media Agent - Image Analysis

import { analyzeImage, analyzeImageUrl, VisionRouter } from '../orchestrator/core/media';

/**
 * Test image analysis with different intents
 */
async function testImageAnalysis() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║        Phase 171: Media Agent - Image Analysis Tests          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Check available providers
  const availableProviders = VisionRouter.getAvailableProviders();
  console.log('📡 Available providers:', availableProviders.join(', ') || 'None');

  if (availableProviders.length === 0) {
    console.log('\n❌ No vision providers configured.');
    console.log('Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_AI_API_KEY');
    process.exit(1);
  }

  // Test 1: Simple 1x1 red pixel PNG (base64)
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('🧪 Test 1: Analyze simple test image (1x1 red pixel)');
  console.log('─────────────────────────────────────────────────────────────────');

  // Minimal valid PNG (1x1 red pixel)
  const testPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

  try {
    const result1 = await analyzeImage(
      testPngBase64,
      'image/png',
      'general_description',
      'What color is this pixel?'
    );

    console.log('\n📊 Result:');
    console.log('  Success:', result1.success);
    console.log('  Model:', result1.modelUsed);
    console.log('  Provider:', result1.providerUsed);
    console.log('  Description:', result1.analysis.description.substring(0, 150));
    console.log('  Confidence:', result1.analysis.confidence);
    console.log('  Latency:', result1.metrics.totalLatencyMs, 'ms');
    console.log('  Tokens:', result1.metrics.tokens?.total);
    console.log('  Cost: $', result1.metrics.estimatedCostUsd?.toFixed(4));
  } catch (error: any) {
    console.log('❌ Test 1 failed:', error.message);
  }

  // Test 2: Test routing for different intents
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('🧪 Test 2: Model routing for different intents');
  console.log('─────────────────────────────────────────────────────────────────\n');

  const intents = [
    'general_description',
    'ui_extraction',
    'code_extraction',
    'error_analysis',
    'design_feedback',
    'accessibility_audit',
  ] as const;

  const tiers = ['free', 'pro', 'enterprise'] as const;

  for (const intent of intents) {
    console.log(`Intent: ${intent}`);
    for (const tier of tiers) {
      const routing = VisionRouter.route({
        mediaType: 'image',
        intent,
        userTier: tier,
      });
      console.log(`  ${tier}: ${routing.primaryModel} (${routing.provider})`);
    }
    console.log('');
  }

  // Test 3: Test with URL (if OpenAI/Anthropic is available)
  if (availableProviders.includes('openai') || availableProviders.includes('anthropic')) {
    console.log('\n─────────────────────────────────────────────────────────────────');
    console.log('🧪 Test 3: Analyze image from URL');
    console.log('─────────────────────────────────────────────────────────────────');

    try {
      // Use a simple placeholder image
      const imageUrl = 'https://via.placeholder.com/100x100/FF0000/FFFFFF?text=TEST';

      console.log('Fetching and analyzing:', imageUrl);

      const result3 = await analyzeImageUrl(
        imageUrl,
        'general_description',
        'Describe what you see in this image'
      );

      console.log('\n📊 Result:');
      console.log('  Success:', result3.success);
      console.log('  Model:', result3.modelUsed);
      console.log('  Description:', result3.analysis.description.substring(0, 150));
      console.log('  Latency:', result3.metrics.totalLatencyMs, 'ms');
    } catch (error: any) {
      console.log('❌ Test 3 failed:', error.message);
    }
  }

  // Test 4: Cost estimation
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('🧪 Test 4: Cost estimation for different models');
  console.log('─────────────────────────────────────────────────────────────────\n');

  const models = [
    'gpt-4o-mini',
    'gpt-4o',
    'claude-3-haiku-20240307',
    'claude-3-5-sonnet-20241022',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ] as const;

  const testTokens = { input: 1000, output: 500 };

  console.log(`Cost for ${testTokens.input} input + ${testTokens.output} output tokens:\n`);

  for (const model of models) {
    try {
      const cost = VisionRouter.estimateCost(model, testTokens.input, testTokens.output);
      console.log(`  ${model}: $${cost.toFixed(4)}`);
    } catch {
      console.log(`  ${model}: Not configured`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ Phase 171 Image Analysis Tests Complete');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Run tests
testImageAnalysis().catch(console.error);
