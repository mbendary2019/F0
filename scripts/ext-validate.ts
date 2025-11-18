// F0 Extensions - Manifest Validation Script
import { readFileSync } from 'fs';
import { validateManifest } from '../orchestrator/src/extensions/validators/jsonschema';

const path = process.argv[2] || 'f0/extensions/examples/firebase.deploy.json';

try {
  const json = JSON.parse(readFileSync(path, 'utf-8'));
  const manifest = validateManifest(json);

  console.log('✅ Manifest OK:', manifest.name, manifest.version, 'provider:', manifest.provider);
  console.log('   Capabilities:', manifest.capabilities.join(', '));
  console.log('   Runner type:', manifest.runner.type);

  if (manifest.inputs) {
    const inputCount = Object.keys(manifest.inputs).length;
    console.log(`   Inputs: ${inputCount} defined`);
  }

  process.exit(0);
} catch (error: any) {
  console.error('❌ Validation failed:', error.message);
  process.exit(1);
}
