// F0 Extensions - Generate Registry with Checksums

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';

interface RegistryEntry {
  name: string;
  version: string;
  provider: string;
  checksum: string;
  path: string;
  verifiedAt: number;
}

interface Registry {
  version: '1.0.0';
  generatedAt: number;
  extensions: RegistryEntry[];
}

async function generateChecksum(content: string): Promise<string> {
  return createHash('sha256').update(content).digest('hex');
}

async function generateRegistry() {
  console.log('📦 Generating Extension Registry with Checksums...\n');

  const examplesDir = join(process.cwd(), 'f0', 'extensions', 'examples');
  const files = await readdir(examplesDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  const entries: RegistryEntry[] = [];

  for (const file of jsonFiles) {
    const filepath = join(examplesDir, file);
    const content = await readFile(filepath, 'utf-8');
    const manifest = JSON.parse(content);

    const checksum = await generateChecksum(content);

    entries.push({
      name: manifest.name,
      version: manifest.version,
      provider: manifest.provider,
      checksum,
      path: `f0/extensions/examples/${file}`,
      verifiedAt: Date.now(),
    });

    console.log(`✅ ${manifest.name}@${manifest.version}`);
    console.log(`   Checksum: ${checksum}`);
    console.log(`   Provider: ${manifest.provider}\n`);
  }

  const registry: Registry = {
    version: '1.0.0',
    generatedAt: Date.now(),
    extensions: entries,
  };

  const registryPath = join(process.cwd(), 'f0', 'extensions', 'registry.json');
  await writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');

  console.log(`\n📋 Registry saved to: ${registryPath}`);
  console.log(`   Total extensions: ${entries.length}`);
  console.log(`   Version: ${registry.version}`);
  console.log(`   Generated: ${new Date(registry.generatedAt).toISOString()}`);
}

generateRegistry().catch(console.error);
