// F0 Extensions - Simple Sandbox Test (Without Dependencies)
import { randomUUID } from 'crypto';

async function testSandbox() {
  try {
    console.log('🧪 Testing sandbox concept...');

    const id = randomUUID();
    console.log('   Generated sandbox ID:', id);

    // Test whitelist concept
    const whitelist = new Set(['echo', 'node', 'npm']);
    const testCmd = 'echo';

    if (!whitelist.has(testCmd)) {
      throw new Error(`Command not allowed: ${testCmd}`);
    }

    console.log('✅ Whitelist check passed!');
    console.log('   Allowed commands:', Array.from(whitelist).join(', '));

    // Test template replacement
    const inputs = { projectId: 'test-123', region: 'us-central1' };
    const secrets = { apiKey: 'sk_test_xxx' };

    const template = 'deploy --project ${inputs.projectId} --key ${secrets.apiKey}';
    let processed = template;

    processed = processed.replace(/\$\{inputs\.(\w+)\}/g, (_, key) => {
      return inputs[key as keyof typeof inputs] ?? '';
    });

    processed = processed.replace(/\$\{secrets\.(\w+)\}/g, (_, key) => {
      return secrets[key as keyof typeof secrets] ?? '';
    });

    console.log('✅ Template replacement works!');
    console.log('   Original:', template);
    console.log('   Processed:', processed);

    console.log('\n✅ All sandbox concept tests passed!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Sandbox test failed:', error.message);
    process.exit(1);
  }
}

testSandbox();
