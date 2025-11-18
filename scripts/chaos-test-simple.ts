// F0 Extensions - Chaos Testing (No execa dependency)

import { validateManifest } from '../orchestrator/src/extensions/validators/jsonschema';

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
    name: 'Invalid extension name pattern',
    test: async () => {
      try {
        const badManifest = {
          name: 'My Extension!', // Invalid characters
          version: '1.0.0',
          provider: 'custom',
          capabilities: ['deploy'],
        };

        validateManifest(badManifest);
        throw new Error('Should have rejected invalid name');
      } catch (error: any) {
        if (!error.message.includes('Invalid extension manifest')) {
          throw new Error(`Wrong error: ${error.message}`);
        }
        console.log('   ✓ Rejected invalid extension name');
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

  {
    name: 'Invalid enum value',
    test: async () => {
      try {
        const manifest = {
          name: 'test',
          version: '1.0.0',
          provider: 'custom',
          capabilities: ['deploy'] as any,
          inputs: {
            region: {
              type: 'enum' as const,
              enum: ['us', 'eu'],
              required: true,
            },
          },
        };

        const { validateInputs } = await import(
          '../orchestrator/src/extensions/validators/jsonschema'
        );

        // Invalid enum value
        validateInputs(manifest as any, { region: 'asia' });

        throw new Error('Should have thrown invalid enum error');
      } catch (error: any) {
        if (!error.message.includes('must be one of')) {
          throw new Error(`Wrong error: ${error.message}`);
        }
        console.log('   ✓ Caught invalid enum value');
      }
    },
  },

  {
    name: 'Type mismatch validation',
    test: async () => {
      try {
        const manifest = {
          name: 'test',
          version: '1.0.0',
          provider: 'custom',
          capabilities: ['deploy'] as any,
          inputs: {
            count: {
              type: 'number' as const,
              required: true,
            },
          },
        };

        const { validateInputs } = await import(
          '../orchestrator/src/extensions/validators/jsonschema'
        );

        // Wrong type (string instead of number)
        validateInputs(manifest as any, { count: 'ten' });

        throw new Error('Should have thrown type mismatch error');
      } catch (error: any) {
        if (!error.message.includes('must be a number')) {
          throw new Error(`Wrong error: ${error.message}`);
        }
        console.log('   ✓ Caught type mismatch');
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
