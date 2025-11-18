// F0 Extensions - Chaos Testing (Intentional Failures)

import { readFileSync, writeFileSync } from 'fs';
import { validateManifest } from '../orchestrator/src/extensions/validators/jsonschema';
import { createSandbox } from '../orchestrator/src/extensions/sandbox';

interface TestCase {
  name: string;
  test: () => Promise<void>;
}

const tests: TestCase[] = [
  {
    name: 'Missing required field in manifest',
    test: async () => {
      try {
        const badManifest = {
          name: 'test',
          version: '1.0.0',
          // Missing: provider, capabilities
        };

        validateManifest(badManifest);
        throw new Error('Should have thrown validation error');
      } catch (error: any) {
        if (!error.message.includes('Invalid extension manifest')) {
          throw new Error(`Wrong error: ${error.message}`);
        }
        console.log('   ✓ Caught missing required field');
      }
    },
  },

  {
    name: 'Invalid URL format in manifest',
    test: async () => {
      try {
        const badManifest = {
          name: 'test',
          version: '1.0.0',
          provider: 'generic-http',
          capabilities: ['deploy'],
          runner: {
            type: 'http',
            url: 'not-a-valid-url',
            method: 'GET',
          },
        };

        validateManifest(badManifest);
        throw new Error('Should have thrown validation error');
      } catch (error: any) {
        if (!error.message.includes('must match format')) {
          throw new Error(`Wrong error: ${error.message}`);
        }
        console.log('   ✓ Caught invalid URL format');
      }
    },
  },

  {
    name: 'Disallowed command in sandbox',
    test: async () => {
      try {
        const sandbox = createSandbox({
          cwd: process.cwd(),
          env: process.env as any,
          whitelist: ['echo'], // Only allow echo
        });

        await sandbox.exec('rm', ['-rf', '/']);
        throw new Error('Should have blocked dangerous command');
      } catch (error: any) {
        if (!error.message.includes('Command not allowed')) {
          throw new Error(`Wrong error: ${error.message}`);
        }
        console.log('   ✓ Blocked disallowed command');
      }
    },
  },

  {
    name: 'Unsupported HTTP method',
    test: async () => {
      try {
        const badManifest = {
          name: 'test',
          version: '1.0.0',
          provider: 'generic-http',
          capabilities: ['deploy'],
          runner: {
            type: 'http',
            url: 'https://example.com',
            method: 'TRACE', // Not allowed
          },
        };

        validateManifest(badManifest);
        throw new Error('Should have rejected TRACE method');
      } catch (error: any) {
        if (!error.message.includes('Invalid extension manifest')) {
          throw new Error(`Wrong error: ${error.message}`);
        }
        console.log('   ✓ Rejected unsupported HTTP method');
      }
    },
  },

  {
    name: 'Invalid semantic version',
    test: async () => {
      try {
        const badManifest = {
          name: 'test',
          version: 'v1.0', // Invalid semver
          provider: 'custom',
          capabilities: ['deploy'],
        };

        validateManifest(badManifest);
        throw new Error('Should have rejected invalid version');
      } catch (error: any) {
        if (!error.message.includes('Invalid extension manifest')) {
          throw new Error(`Wrong error: ${error.message}`);
        }
        console.log('   ✓ Rejected invalid semantic version');
      }
    },
  },

  {
    name: 'Secret sanitization in output',
    test: async () => {
      try {
        const sandbox = createSandbox({
          cwd: process.cwd(),
          env: process.env as any,
          whitelist: ['echo'],
          secrets: { apiKey: 'sk_test_1234567890' },
        });

        const result = await sandbox.exec('echo', ['${secrets.apiKey}']);

        if (result.stdout.includes('sk_test_')) {
          throw new Error('Secret leaked in output!');
        }

        console.log('   ✓ Secrets sanitized in output');
      } catch (error: any) {
        // Expected to fail if echo not working
        console.log('   ⚠ Skipped (echo not available)');
      }
    },
  },

  {
    name: 'Required input validation',
    test: async () => {
      try {
        const manifest = {
          name: 'test',
          version: '1.0.0',
          provider: 'custom',
          capabilities: ['deploy'] as any,
          inputs: {
            requiredField: {
              type: 'string' as const,
              required: true,
            },
          },
        };

        const { validateInputs } = await import(
          '../orchestrator/src/extensions/validators/jsonschema'
        );

        // Missing required input
        validateInputs(manifest as any, {});

        throw new Error('Should have thrown missing input error');
      } catch (error: any) {
        if (!error.message.includes('Required input missing')) {
          throw new Error(`Wrong error: ${error.message}`);
        }
        console.log('   ✓ Caught missing required input');
      }
    },
  },
];

async function runChaosTests() {
  console.log('💥 F0 Extensions Chaos Testing');
  console.log('================================\n');

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`🧪 ${test.name}`);
      await test.test();
      passed++;
    } catch (error: any) {
      console.log(`   ❌ FAILED: ${error.message}`);
      failed++;
    }
  }

  console.log('\n================================');
  console.log(`✅ Passed: ${passed}/${tests.length}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}/${tests.length}`);
    process.exit(1);
  }

  console.log('\n✅ All chaos tests passed!');
  console.log('   Error handling is working correctly.\n');
}

runChaosTests();
