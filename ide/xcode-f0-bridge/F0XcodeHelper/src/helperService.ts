#!/usr/bin/env node
/**
 * F0 Xcode Helper Service
 * Phase 84.8.2: Node.js helper daemon for Xcode Source Editor Extension
 */

import { handleXcodeMessage } from './router';

async function main() {
  const raw = process.argv[2];

  if (!raw) {
    console.error(JSON.stringify({
      error: 'Missing JSON argument from Xcode extension'
    }));
    process.exit(1);
  }

  try {
    const parsed = JSON.parse(raw);
    const response = await handleXcodeMessage(parsed);
    console.log(JSON.stringify(response, null, 2));
  } catch (err: any) {
    console.error(JSON.stringify({
      error: err.message || String(err)
    }, null, 2));
    process.exit(1);
  }
}

main();
