// F0 Extensions - Sandbox Test Script
import { createSandbox } from '../orchestrator/src/extensions/sandbox';

(async () => {
  try {
    console.log('🧪 Testing sandbox with echo command...');

    const sandbox = createSandbox({
      cwd: process.cwd(),
      env: process.env as any,
      whitelist: ['echo'],
    });

    const result = await sandbox.exec('echo', ['hello-from-sandbox']);

    console.log('✅ Sandbox test passed!');
    console.log('   stdout:', result.stdout.trim());
    console.log('   exitCode:', result.exitCode);

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Sandbox test failed:', error.message);
    process.exit(1);
  }
})();
